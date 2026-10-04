"""Drop and recreate all ShiftLoad schemas. Destroys the data in the target database."""
from pathlib import Path
from urllib.parse import unquote, urlparse

import psycopg
from psycopg import sql

from shiftload import config

SCHEMA = Path(__file__).resolve().parents[2] / "db" / "schema.sql"
ROLE_URLS = {"app_rw": config.APP_DB_URL, "release": config.RELEASE_DB_URL, "published_ro": config.PUBLISHED_DB_URL}


def main() -> None:
    with psycopg.connect(config.ADMIN_DB_URL, autocommit=True) as conn:
        # each role logs in with the password from its own URL, not the dev default
        for role, url in ROLE_URLS.items():
            password = unquote(urlparse(url).password or "")
            exists = conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role,)).fetchone()
            verb = "ALTER" if exists else "CREATE"
            conn.execute(sql.SQL("{} ROLE {} LOGIN PASSWORD {}").format(sql.SQL(verb), sql.Identifier(role), sql.Literal(password)))
        conn.execute(SCHEMA.read_text(encoding="utf-8"))
    print("schema applied to", urlparse(config.ADMIN_DB_URL).hostname)


if __name__ == "__main__":
    main()
