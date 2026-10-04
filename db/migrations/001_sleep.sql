-- Sleep sessions from the watch (Health Connect SleepSessionRecord). Only the
-- session start and end are kept, never sleep stages. A session is folded into
-- the next shift's sleep_before_min and deleted when that shift is finalized.
CREATE TABLE IF NOT EXISTS core.sleep_sessions (
  nurse_pid     uuid NOT NULL,
  start_ts      timestamptz NOT NULL,
  end_ts        timestamptz NOT NULL,
  source_device text,
  PRIMARY KEY (nurse_pid, start_ts)
);
ALTER TABLE core.shifts ADD COLUMN IF NOT EXISTS sleep_before_min int;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.sleep_sessions TO app_rw;
