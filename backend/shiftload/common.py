"""Shared FastAPI plumbing: DB pool, dev auth, access log."""
import hashlib
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from . import config

ROLES = {"nurse", "charge_nurse", "manager", "joint_committee", "admin"}


@dataclass
class User:
    role: str
    uid: str


def make_pool(url: str) -> ConnectionPool:
    return ConnectionPool(url, min_size=1, max_size=8, kwargs={"row_factory": dict_row}, open=False)


def make_app(title: str, lifespan=None) -> FastAPI:
    app = FastAPI(title=title, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"]
    )
    return app


def parse_token(header: str | None) -> User:
    """Dev tokens look like `Bearer dev:<role>:<uid>`. Firebase is not wired yet."""
    if config.AUTH_MODE != "dev":
        raise HTTPException(501, "only AUTH_MODE=dev is implemented")
    parts = (header or "").removeprefix("Bearer ").split(":", 2)
    if len(parts) != 3 or parts[0] != "dev" or parts[1] not in ROLES or not parts[2]:
        raise HTTPException(401, "missing or invalid token")
    return User(role=parts[1], uid=parts[2])


def require(pool: ConnectionPool, service: str, *roles: str):
    """Dependency: check the role claim and append to the access log."""

    async def dep(request: Request) -> User:
        user = parse_token(request.headers.get("authorization"))
        if user.role not in roles:
            raise HTTPException(403, f"role {user.role} may not call this endpoint")
        body = await request.body()
        digest = hashlib.sha256(
            request.url.path.encode() + b"?" + request.url.query.encode() + b"#" + body
        ).hexdigest()[:16]
        route = request.scope.get("route")
        endpoint = f"{request.method} {getattr(route, 'path', request.url.path)}"

        def write():
            with pool.connection() as conn:
                conn.execute(
                    "INSERT INTO audit.access_log (service, role, endpoint, params_hash) VALUES (%s, %s, %s, %s)",
                    (service, user.role, endpoint, digest),
                )

        await run_in_threadpool(write)
        return user

    return dep
