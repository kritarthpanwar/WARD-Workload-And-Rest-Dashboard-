"""Shared FastAPI plumbing: DB pool, sign-in checks, access log."""
import hashlib
import time
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from . import config

ROLES = {"nurse", "charge_nurse", "manager", "joint_committee", "admin"}


@dataclass
class User:
    role: str
    uid: str
    demo: bool = False      # signed in with a demo login, not a real account


def make_pool(url: str) -> ConnectionPool:
    return ConnectionPool(url, min_size=1, max_size=8, kwargs={"row_factory": dict_row}, open=False)


def make_app(title: str, lifespan=None) -> FastAPI:
    app = FastAPI(title=title, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"]
    )
    return app


_verified: dict[str, tuple[float, dict]] = {}     # token -> (expiry, claims)


def verify_firebase(token: str) -> dict:
    """Check a Firebase ID token's signature, audience and expiry. Cached until it expires."""
    hit = _verified.get(token)
    if hit and hit[0] > time.time():
        return hit[1]
    if not config.FIREBASE_PROJECT_ID:
        raise HTTPException(501, "FIREBASE_PROJECT_ID is not set")
    try:
        claims = id_token.verify_firebase_token(token, google_requests.Request(), audience=config.FIREBASE_PROJECT_ID)
    except Exception:
        raise HTTPException(401, "sign-in expired or invalid: please sign in again")
    if not claims.get("email_verified"):
        raise HTTPException(403, "confirm your email address first: check your inbox for the link")
    if len(_verified) > 500:
        _verified.clear()
    _verified[token] = (float(claims["exp"]), claims)
    return claims


def bearer(header: str | None) -> str:
    return (header or "").removeprefix("Bearer ").strip()


def resolve_user(pool: ConnectionPool, header: str | None) -> User:
    """Turn the Authorization header into a role and uid."""
    token = bearer(header)
    if token.startswith("dev:"):
        if config.AUTH_MODE not in ("dev", "both"):
            raise HTTPException(401, "demo sign-in is switched off")
        parts = token.split(":", 2)
        if len(parts) != 3 or parts[1] not in ROLES or not parts[2]:
            raise HTTPException(401, "missing or invalid token")
        return User(role=parts[1], uid=parts[2], demo=True)
    if not token or config.AUTH_MODE == "dev":
        raise HTTPException(401, "missing or invalid token")
    claims = verify_firebase(token)
    with pool.connection() as conn:
        row = conn.execute("SELECT role FROM audit.user_roles WHERE firebase_uid = %s", (claims["user_id"],)).fetchone()
    if not row or row["role"] not in ROLES:
        raise HTTPException(403, "no role has been assigned to this account yet")
    return User(role=row["role"], uid=claims["user_id"])


def require(pool: ConnectionPool, service: str, *roles: str):
    """Dependency: check the role claim and append to the access log."""

    async def dep(request: Request) -> User:
        user = await run_in_threadpool(resolve_user, pool, request.headers.get("authorization"))
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
