"""Blind evaluation of the anomaly detector on synthetic cohorts (spec 10.1).

The detector only ever sees the shifts. The answer key is compared afterwards.
Writes data/eval/anomaly_eval.json.
"""
import json
import sys
from datetime import date
from pathlib import Path

from shiftload import anomaly, config, synthetic

OUT = Path(__file__).resolve().parents[2] / "data" / "eval" / "anomaly_eval.json"
END = date(2026, 9, 27)


def run_detector(cohort: dict):
    keep = synthetic.participants(cohort["nurses"], config.DEFAULT_SCENARIO)
    shifts = cohort["shifts"][cohort["shifts"]["nurse_pid"].isin(keep)]
    daily = anomaly.daily_series(shifts)
    return daily, anomaly.detect(daily)


def main(n_seeds: int = 50) -> None:
    planted = {s: 0 for s in ("small", "moderate", "large")}
    caught = dict(planted)
    not_evaluable = 0
    for seed in range(n_seeds):
        cohort = synthetic.generate(seed, END, n_anomalies=8, drift=False)
        daily, found = run_detector(cohort)
        flagged = set(zip(found["unit_id"], found["shift_type"], found["day"], found["metric"]))
        eligible = set(zip(
            *[daily[(daily["n"] >= config.ANOMALY_MIN_N)][c] for c in ("unit_id", "shift_type", "day")]
        ))
        for a in cohort["answer_key"]:
            if (a["unit_id"], a["shift_type"], a["day"]) not in eligible:
                not_evaluable += 1      # fewer than 5 nurses that day: detector skips it
                continue
            planted[a["size"]] += 1
            if (a["unit_id"], a["shift_type"], a["day"], a["metric"]) in flagged:
                caught[a["size"]] += 1

    null_flag_cells, null_unit_days = 0, 0
    for seed in range(1000, 1000 + n_seeds):
        cohort = synthetic.generate(seed, END, n_anomalies=0, drift=False)
        daily, found = run_detector(cohort)
        null_flag_cells += len(found[["unit_id", "shift_type", "day"]].drop_duplicates())
        null_unit_days += int((daily["n"] >= config.ANOMALY_MIN_N).sum())

    result = {
        "n_seeds": n_seeds,
        "z_threshold": config.ANOMALY_Z,
        "participation_scenario": config.DEFAULT_SCENARIO,
        "recall_by_size": {
            s: {"planted": planted[s], "caught": caught[s],
                "recall": round(caught[s] / planted[s], 3) if planted[s] else None}
            for s in planted
        },
        "planted_but_cell_below_n5": not_evaluable,
        "null_cohort": {
            "unit_days": null_unit_days,
            "flagged_unit_days": null_flag_cells,
            "false_alarms_per_100_unit_days": round(100 * null_flag_cells / null_unit_days, 2),
        },
        "note": "Synthetic data. Shows method behaviour on assumed data shapes, not real units.",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 50)
