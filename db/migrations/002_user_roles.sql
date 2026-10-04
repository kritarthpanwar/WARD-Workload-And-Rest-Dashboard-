-- Who may sign in as what. One row per Firebase account, created on first
-- sign-in with no role; scripts/set_role.py assigns the role afterwards.
CREATE TABLE IF NOT EXISTS audit.user_roles (
  firebase_uid text PRIMARY KEY,
  email        text NOT NULL,
  role         text,                 -- NULL until an admin assigns one
  unit_id      text,                 -- nurses only
  display_name text,                 -- nurses only
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON audit.user_roles TO app_rw, published_ro;
GRANT INSERT ON audit.user_roles TO app_rw;
