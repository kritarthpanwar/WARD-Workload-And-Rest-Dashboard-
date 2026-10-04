"""Write data/replay/recorded_day.json: a SIMULATED 12-hour shift recording.

This stands in for the real watch recording described in the spec (brisk
walks, still periods, real breaks, a stationary-effort block). Replace the
file with a real Health Connect export when one exists; the format is one
entry per minute: {"m": minute offset, "hr": bpm or null, "steps": count},
plus optional sleep sessions as minute offsets from shift start.
"""
import json
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parents[2] / "data" / "replay" / "recorded_day.json"

# (start minute, end minute, kind)
SEGMENTS = [
    (90, 105, "brisk"),          # brisk walk
    (150, 175, "effort"),        # stationary effort: lifting and holding, no steps
    (230, 250, "still_high"),    # standing still with a raised heart rate
    (340, 370, "break"),         # first break, 5 h 40 min in
    (430, 470, "off"),           # watch not worn
    (550, 580, "break"),
    (640, 655, "brisk"),
]


def main() -> None:
    rng = np.random.default_rng(11)
    minutes = []
    kind_at = {}
    for a, b, kind in SEGMENTS:
        for m in range(a, b):
            kind_at[m] = kind
    walking = False
    left = 0
    for m in range(720):
        kind = kind_at.get(m)
        if kind is None:
            # routine work: walking bouts and short charting spells (never 20 still minutes)
            if left == 0:
                walking = not walking
                left = int(rng.integers(6, 14)) if walking else int(rng.integers(5, 12))
            left -= 1
            if walking:
                hr, steps = rng.normal(100, 4), int(rng.integers(55, 105))
            else:
                hr, steps = rng.normal(76, 3), int(rng.integers(0, 4))
        elif kind == "brisk":
            hr, steps = rng.normal(119, 3), int(rng.integers(108, 124))
        elif kind == "effort":
            hr, steps = rng.normal(124, 3), int(rng.integers(0, 3))
        elif kind == "still_high":
            hr, steps = rng.normal(90, 2), int(rng.integers(0, 2))
        elif kind == "break":
            hr, steps = rng.normal(66, 2), 0
        else:  # off
            hr, steps = None, 0
        minutes.append({"m": m, "hr": None if hr is None else round(float(hr), 1), "steps": steps})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "note": "Simulated recording, not real watch data.",
        "source_device": "simulated-watch",
        "start_hour_local": 7,
        "resting_hr": 62,
        # night before the shift, minutes relative to the 07:00 start: 23:40 to 05:30
        "sleep": [{"start_min": -440, "end_min": -90}],
        "minutes": minutes,
    }))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
