-- ShiftLoad schema. Applied by backend/scripts/reset_db.py as the database owner.
-- Three schemas: core (trustee side), published (manager-readable), audit.
-- Passwords here are for local development only.

CREATE EXTENSION IF NOT EXISTS timescaledb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    CREATE ROLE app_rw LOGIN PASSWORD 'app_rw_dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'release') THEN
    CREATE ROLE release LOGIN PASSWORD 'release_dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'published_ro') THEN
    CREATE ROLE published_ro LOGIN PASSWORD 'published_ro_dev';
  END IF;
END $$;

DROP SCHEMA IF EXISTS core CASCADE;
DROP SCHEMA IF EXISTS published CASCADE;
DROP SCHEMA IF EXISTS audit CASCADE;
CREATE SCHEMA core;
CREATE SCHEMA published;
CREATE SCHEMA audit;

-- ---------------------------------------------------------------- core

CREATE TABLE core.units (
  unit_id     text PRIMARY KEY,
  name        text NOT NULL,
  hospital    text NOT NULL,
  roster_size int  NOT NULL            -- denominator for participation
);

-- Firebase UID -> pseudonymous id. Readable only by app_rw.
CREATE TABLE core.nurse_identity (
  firebase_uid text PRIMARY KEY,
  nurse_pid    uuid NOT NULL UNIQUE,
  display_name text NOT NULL
);

CREATE TABLE core.nurses (
  nurse_pid           uuid PRIMARY KEY,
  unit_id             text NOT NULL REFERENCES core.units,
  birth_year          int,
  hr_rest             real,
  hr_steps_model_json jsonb,
  baseline_status     text NOT NULL DEFAULT 'provisional',
  rotation_json       jsonb,
  relief_recipient    text NOT NULL DEFAULT 'charge',
  auto_relief         boolean NOT NULL DEFAULT false,
  opted_in_at         timestamptz,
  paused_until        timestamptz,
  withdrawn_at        timestamptz,
  is_synthetic        boolean NOT NULL DEFAULT false,
  -- synthetic only: nurse takes part in participation scenario p when rank < p/100
  participation_rank  real NOT NULL DEFAULT 0
);

CREATE TABLE core.shifts (
  shift_id             uuid NOT NULL,
  nurse_pid            uuid NOT NULL,
  unit_id              text NOT NULL,
  start_ts             timestamptz NOT NULL,
  end_ts               timestamptz,
  planned_end_ts       timestamptz,
  finalized            boolean NOT NULL DEFAULT false,
  shift_type           text NOT NULL,
  source_device        text,
  data_mode            text NOT NULL DEFAULT 'live',   -- live / replay / synthetic
  time_on_feet_min     int,
  longest_on_feet_min  int,
  mean_pct_hrr         real,
  min_above_30_hrr     int,
  longest_no_break_min int,
  n_breaks_confirmed   int,
  breaks_uncertain     boolean,
  unexplained_hr_min   int,
  coverage_pct         real,
  max_gap_min          int,
  phys_band            text,
  recovery_band        text,
  band                 text,
  recovery_provisional boolean,
  ratio_status         text,
  drained_rating       int,
  is_synthetic         boolean NOT NULL DEFAULT false,
  PRIMARY KEY (shift_id, start_ts)
);
SELECT create_hypertable('core.shifts', 'start_ts');
CREATE INDEX ON core.shifts (nurse_pid, start_ts DESC);
CREATE INDEX ON core.shifts (unit_id, start_ts);

-- Raw per-minute data. Deleted at shift finalization.
CREATE TABLE core.minutes (
  ts        timestamptz NOT NULL,
  nurse_pid uuid NOT NULL,
  hr_sum    real NOT NULL DEFAULT 0,
  hr_n      int  NOT NULL DEFAULT 0,
  steps     int  NOT NULL DEFAULT 0,
  PRIMARY KEY (nurse_pid, ts)
);
SELECT create_hypertable('core.minutes', 'ts');

-- 5-minute windows. Deleted at shift finalization.
CREATE TABLE core.windows (
  ts            timestamptz NOT NULL,
  nurse_pid     uuid NOT NULL,
  shift_id      uuid NOT NULL,
  hr_mean       real,
  steps         int,
  valid_minutes int,
  pct_hrr       real,
  hr_expected   real,
  hr_excess     real,
  unexplained   boolean,
  PRIMARY KEY (nurse_pid, ts)
);
SELECT create_hypertable('core.windows', 'ts');

CREATE TABLE core.break_events (
  break_id uuid PRIMARY KEY,
  shift_id uuid NOT NULL,
  start_ts timestamptz NOT NULL,
  end_ts   timestamptz NOT NULL,
  source   text NOT NULL,                      -- suggested / manual
  status   text NOT NULL DEFAULT 'unanswered'  -- confirmed / rejected / unanswered
);
CREATE INDEX ON core.break_events (shift_id);

-- Rows are deleted when handled.
CREATE TABLE core.relief_requests (
  request_id     uuid PRIMARY KEY,
  unit_id        text NOT NULL,
  nurse_pid      uuid NOT NULL,
  recipient_type text NOT NULL,                -- charge / buddy / float
  created_ts     timestamptz NOT NULL DEFAULT now()
);

-- No nurse id in either counter table.
CREATE TABLE core.relief_counts (
  unit_id    text NOT NULL,
  week_start date NOT NULL,
  n          int  NOT NULL DEFAULT 0,
  PRIMARY KEY (unit_id, week_start)
);
CREATE TABLE core.report_counts (
  unit_id      text NOT NULL,
  week_start   date NOT NULL,
  reports_sent int  NOT NULL DEFAULT 0,
  PRIMARY KEY (unit_id, week_start)
);

-- Exact daily anomaly results. Internal: never published as-is.
CREATE TABLE core.unit_anomalies_daily (
  participation_scenario int  NOT NULL,
  unit_id    text NOT NULL,
  shift_type text NOT NULL,
  day        date NOT NULL,
  metric     text NOT NULL,
  value      real NOT NULL,
  median     real NOT NULL,
  z          real NOT NULL,
  ratio      real,
  PRIMARY KEY (participation_scenario, unit_id, shift_type, day, metric)
);

-- ----------------------------------------------------------- published

CREATE VIEW published.units AS
  SELECT unit_id, name, hospital FROM core.units;

-- One row per unit x week x shift type (day / night) x scenario. Cells never
-- overlap: there is no combined day+night cell to difference against.
-- status: released / suppressed_k / suppressed_membership /
--         not_representative / quality_gate
-- Metric columns are NULL unless status = 'released'.
CREATE TABLE published.unit_weekly (
  participation_scenario  int  NOT NULL,
  unit_id                 text NOT NULL,
  week_start              date NOT NULL,
  shift_type              text NOT NULL,
  status                  text NOT NULL,
  participation_pct       int,
  coverage_pct            int,
  pct_red_low             int,
  pct_red_high            int,
  pct_insufficient        int,
  pct_no_break_5h         int,
  pct_ratio_met_and_breaks int,
  phys_load_band          text,
  red_shifts_noised       int,
  data_mode               text NOT NULL DEFAULT 'synthetic',
  PRIMARY KEY (participation_scenario, unit_id, week_start, shift_type)
);

-- Unit-week counters (no cohort behind them). Present only when at least one
-- cell of the week was released.
CREATE TABLE published.unit_week_counts (
  participation_scenario int  NOT NULL,
  unit_id                text NOT NULL,
  week_start             date NOT NULL,
  red_shifts_noised      int  NOT NULL,
  reports_sent_noised    int  NOT NULL,
  relief_requests_noised int  NOT NULL,
  PRIMARY KEY (participation_scenario, unit_id, week_start)
);

CREATE TABLE published.flags (
  participation_scenario int  NOT NULL,
  unit_id       text NOT NULL,
  week_start    date NOT NULL,
  shift_type    text NOT NULL,
  metric        text NOT NULL,
  direction     text NOT NULL,     -- up / down
  ratio_rounded text NOT NULL,     -- e.g. "about 3x usual"
  PRIMARY KEY (participation_scenario, unit_id, week_start, shift_type, metric)
);

-- Hashed nurse sets behind each released cell. Not readable by published_ro.
CREATE TABLE published.released_cohorts (
  participation_scenario int  NOT NULL,
  unit_id         text NOT NULL,
  week_start      date NOT NULL,
  shift_type      text NOT NULL,
  cohort_hash_set text[] NOT NULL,
  PRIMARY KEY (participation_scenario, unit_id, week_start, shift_type)
);

CREATE TABLE published.weekly_reports (
  participation_scenario int  NOT NULL,
  unit_id      text NOT NULL,
  week_start   date NOT NULL,
  payload_json jsonb NOT NULL,
  narrative    jsonb NOT NULL,
  source       text NOT NULL,      -- gemini / template
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participation_scenario, unit_id, week_start)
);

CREATE TABLE published.manager_actions (
  action_id   uuid PRIMARY KEY,
  unit_id     text NOT NULL,
  week_start  date NOT NULL,
  action_type text NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- audit

-- Append-only: roles get INSERT and SELECT, never UPDATE or DELETE.
CREATE TABLE audit.access_log (
  id          bigserial PRIMARY KEY,
  ts          timestamptz NOT NULL DEFAULT now(),
  service     text NOT NULL,
  role        text NOT NULL,
  endpoint    text NOT NULL,
  params_hash text NOT NULL
);

-- --------------------------------------------------------------- grants

REVOKE ALL ON SCHEMA core, published, audit FROM PUBLIC;

GRANT USAGE ON SCHEMA core TO app_rw, release;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO app_rw;
GRANT SELECT ON core.units, core.nurses, core.shifts, core.relief_counts,
                core.report_counts, core.unit_anomalies_daily TO release;
GRANT INSERT, UPDATE, DELETE ON core.unit_anomalies_daily TO release;

GRANT USAGE ON SCHEMA published TO release, published_ro;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA published TO release;
GRANT SELECT ON published.units, published.unit_weekly, published.unit_week_counts, published.flags,
                published.weekly_reports, published.manager_actions TO published_ro;
GRANT INSERT ON published.manager_actions TO published_ro;

GRANT USAGE ON SCHEMA audit TO app_rw, release, published_ro;
GRANT INSERT ON audit.access_log TO app_rw, release, published_ro;
GRANT USAGE ON SEQUENCE audit.access_log_id_seq TO app_rw, release, published_ro;
GRANT SELECT ON audit.access_log TO published_ro;
