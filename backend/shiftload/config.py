"""Settings and every tunable marked (default) in the spec."""
import os

_HOST = os.environ.get("SHIFTLOAD_DB_HOST", "localhost:5433/shiftload")

ADMIN_DB_URL = os.environ.get("ADMIN_DB_URL", f"postgresql://postgres:postgres@{_HOST}")
APP_DB_URL = os.environ.get("APP_DB_URL", f"postgresql://app_rw:app_rw_dev@{_HOST}")
RELEASE_DB_URL = os.environ.get("RELEASE_DB_URL", f"postgresql://release:release_dev@{_HOST}")
PUBLISHED_DB_URL = os.environ.get(
    "PUBLISHED_DB_URL", f"postgresql://published_ro:published_ro_dev@{_HOST}"
)

# "dev" accepts tokens of the form dev:<role>:<uid>. Firebase is not wired yet.
AUTH_MODE = os.environ.get("AUTH_MODE", "dev")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
COHORT_HASH_SALT = os.environ.get("COHORT_HASH_SALT", "dev-salt")

# --- coverage (spec section 8)
WINDOW_MIN = 5
WINDOW_MIN_VALID = 4
COVERAGE_MIN_PCT = 70.0
MAX_GAP_MIN = 60

# --- physical domain: mean %HRR
PHYS_AMBER = 24.5
PHYS_RED = 33.0
HRR_HIGH = 30.0

# --- recovery domain
NO_BREAK_RED_MIN = 300
NO_BREAK_AMBER_PERCENTILE = 80
NO_BREAK_AMBER_COLD_START = 240   # used until a nurse or cohort history exists
MAX_SHIFT_HOURS = 12.5
RELIEF_NUDGE_MIN = 300

# --- on feet / breaks
SEDENTARY_STEPS = 5
SEDENTARY_GAP_MIN = 10
BREAK_MIN_LEN = 20                # suggested break: this many sedentary minutes...
BREAK_MAX_PCT_HRR = 20.0          # ...with mean %HRR below this

# --- unexplained HR
RESIDUAL_THRESHOLD_BPM = 12.0     # placeholder until LOSO residuals exist
LOW_MOTION_STEPS = 5
UNEXPLAINED_MIN_OF_5 = 3

# --- release
K_MIN = 5
PARTICIPATION_FLOOR_PCT = 40
QUALITY_GATE_COVERAGE_PCT = 50
LAPLACE_EPSILON = 1.0
SCENARIOS = [20, 30, 40, 50, 60, 70, 80, 90, 100]
DEFAULT_SCENARIO = 60

# --- anomaly detection
ANOMALY_Z = 3.0
ANOMALY_HISTORY_DAYS = 28
ANOMALY_MIN_HISTORY = 14
ANOMALY_MIN_N = 5
ANOMALY_MIN_COVERAGE = 50.0

# --- compare
MAX_COMPARE_WEEKS = 13
COVERAGE_MISMATCH_POINTS = 20

CAUSAL_WORDS = ["because", "caused", "due to", "led to"]

FOOTER = "Workload documentation tool — not a medical device."
PURPOSE_LIMIT = (
    "This data may not be used for discipline, performance review or "
    "fitness-for-duty decisions. Aggregates may not be cited to deny a "
    "workload report or grievance."
)
