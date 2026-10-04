"""Load the synthetic unit cohort and the demo logins. Run after reset_db.py.

The answer key for planted anomalies goes to data/eval/answer_key.json, which
no detector code reads.
"""
import json
import sys
import uuid
from datetime import date
from pathlib import Path

import psycopg

from shiftload import config, synthetic

ROOT = Path(__file__).resolve().parents[2]
DEMO_NURSES = [
    # firebase uid, display name, unit
    ("demo-nurse", "Alex R.", "4west"),
    ("demo-nurse-2", "Sam K.", "4west"),
]


def main(seed: int = 7) -> None:
    end = synthetic.last_complete_week_end(date.today())
    c = synthetic.generate(seed, end)
    with psycopg.connect(config.ADMIN_DB_URL) as conn:
        cur = conn.cursor()
        cur.executemany(
            "INSERT INTO core.units (unit_id, name, hospital, roster_size) VALUES (%s, %s, %s, %s)",
            c["units"].values.tolist(),
        )
        cur.executemany(
            """INSERT INTO core.nurses (nurse_pid, unit_id, birth_year, hr_rest, rotation_json,
                   baseline_status, opted_in_at, is_synthetic, participation_rank)
               VALUES (%s, %s, %s, %s, %s, 'ready', now(), true, %s)""",
            [(n.nurse_pid, n.unit_id, n.birth_year, n.hr_rest,
              json.dumps({"pattern": n.rotation}), n.participation_rank)
             for n in c["nurses"].itertuples()],
        )
        cols = ["shift_id", "nurse_pid", "unit_id", "start_ts", "end_ts", "shift_type",
                "time_on_feet_min", "longest_on_feet_min", "mean_pct_hrr", "min_above_30_hrr",
                "longest_no_break_min", "n_breaks_confirmed", "breaks_uncertain",
                "unexplained_hr_min", "coverage_pct", "max_gap_min", "phys_band", "recovery_band",
                "band", "ratio_status", "drained_rating"]
        s = c["shifts"]
        rows = [
            [None if (isinstance(v, float) and v != v) else v for v in row]
            for row in s[cols].astype(object).values.tolist()
        ]
        cur.executemany(
            f"""INSERT INTO core.shifts ({', '.join(cols)}, finalized, source_device, data_mode, is_synthetic)
                VALUES ({', '.join(['%s'] * len(cols))}, true, 'synthetic', 'synthetic', true)""",
            rows,
        )
        cur.executemany(
            "INSERT INTO core.report_counts (unit_id, week_start, reports_sent) VALUES (%s, %s, %s)",
            c["report_counts"].astype(object).values.tolist(),
        )
        cur.executemany(
            "INSERT INTO core.relief_counts (unit_id, week_start, n) VALUES (%s, %s, %s)",
            c["relief_counts"].astype(object).values.tolist(),
        )
        for uid, name, unit in DEMO_NURSES:
            pid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"shiftload:{uid}"))
            cur.execute(
                "INSERT INTO core.nurse_identity (firebase_uid, nurse_pid, display_name) VALUES (%s, %s, %s)",
                (uid, pid, name),
            )
            cur.execute("INSERT INTO core.nurses (nurse_pid, unit_id) VALUES (%s, %s)", (pid, unit))
        conn.commit()

    key_path = ROOT / "data" / "eval" / "answer_key.json"
    key_path.parent.mkdir(parents=True, exist_ok=True)
    key_path.write_text(json.dumps(c["answer_key"], indent=2, default=str))
    print(f"seeded {len(c['nurses'])} synthetic nurses, {len(s)} shifts, ending {end}")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 7)
