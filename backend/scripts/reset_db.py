"""Drop and recreate all ShiftLoad schemas. Destroys local data."""
from pathlib import Path

import psycopg

from shiftload import config

SCHEMA = Path(__file__).resolve().parents[2] / "db" / "schema.sql"


def main() -> None:
    with psycopg.connect(config.ADMIN_DB_URL, autocommit=True) as conn:
        conn.execute(SCHEMA.read_text(encoding="utf-8"))
    print("schema applied")


if __name__ == "__main__":
    main()
