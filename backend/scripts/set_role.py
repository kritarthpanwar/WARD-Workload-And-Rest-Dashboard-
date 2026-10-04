"""Give a signed-up account a role.

    python scripts/set_role.py <email> <role> [--unit 4west] [--name "Alex R."]
    python scripts/set_role.py --list

Roles: nurse, charge_nurse, manager, joint_committee, admin. The person must
have created their account and signed in once first; nurses also need --unit.
"""
import argparse

import psycopg

from shiftload import config
from shiftload.common import ROLES


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("email", nargs="?")
    ap.add_argument("role", nargs="?", choices=sorted(ROLES))
    ap.add_argument("--unit")
    ap.add_argument("--name")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    with psycopg.connect(config.ADMIN_DB_URL) as conn:
        if a.list or not a.email:
            for email, role, unit in conn.execute("SELECT email, role, unit_id FROM audit.user_roles ORDER BY created_at"):
                print(f"{email:40} {role or '(no role yet)':18} {unit or ''}")
            return
        if a.role == "nurse" and not a.unit:
            ap.error("a nurse needs --unit (one of: " + ", ".join(r[0] for r in conn.execute("SELECT unit_id FROM core.units")) + ")")
        n = conn.execute(
            "UPDATE audit.user_roles SET role = %s, unit_id = %s, display_name = %s WHERE email = %s",
            (a.role, a.unit, a.name, a.email.lower())).rowcount
        conn.commit()
    print(f"{a.email} is now {a.role}" if n else f"No account found for {a.email}: they need to sign up and sign in once first.")


if __name__ == "__main__":
    main()
