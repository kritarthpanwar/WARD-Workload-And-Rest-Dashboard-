"""Pure comparison logic for "Ask your unit" (spec 10.3). Works on published rows only."""
from datetime import date, timedelta
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from . import config
from .narrative import METRIC_LABELS

METRICS = ["pct_red_low", "pct_red_high", "pct_insufficient", "pct_no_break_5h",
           "pct_ratio_met_and_breaks", "coverage_pct", "participation_pct"]
# for these, a higher value is the better direction
HIGHER_IS_BETTER = {"pct_ratio_met_and_breaks", "coverage_pct", "participation_pct"}
BAND_ORDER = ["green", "amber", "red"]


class Period(BaseModel):
    week_start: date
    n_weeks: int = Field(default=1, ge=1, le=config.MAX_COMPARE_WEEKS)

    @model_validator(mode="after")
    def snap(self):
        # fixed calendar weeks only: snap to the Monday
        self.week_start = self.week_start - timedelta(days=self.week_start.weekday())
        return self

    def weeks(self) -> list[date]:
        return [self.week_start + timedelta(days=7 * i) for i in range(self.n_weeks)]


class ComparisonRequest(BaseModel):
    compare_by: Literal["period", "unit", "shift_type"]
    units: list[str] = Field(min_length=1, max_length=2)
    shift_type: Literal["day", "night", "all"] = "all"
    metrics: list[str] | Literal["all"] = "all"
    period_a: Period
    period_b: Period | None = None
    participation_scenario: int = config.DEFAULT_SCENARIO

    @model_validator(mode="after")
    def check(self):
        if self.compare_by == "unit" and len(self.units) != 2:
            raise ValueError("compare_by=unit needs two units")
        if self.compare_by != "unit" and len(self.units) != 1:
            raise ValueError("this comparison takes one unit")
        if self.compare_by == "period" and self.period_b is None:
            raise ValueError("compare_by=period needs period_b")
        if self.metrics != "all" and not set(self.metrics) <= set(METRICS):
            raise ValueError("unknown metric")
        if self.participation_scenario not in config.SCENARIOS:
            raise ValueError("unknown participation scenario")
        return self

    def sides(self) -> list[dict]:
        """The two (unit, shift types, weeks) selections being compared."""
        types = ["day", "night"] if self.shift_type == "all" else [self.shift_type]
        a = {"unit": self.units[0], "shift_types": types, "weeks": self.period_a.weeks()}
        if self.compare_by == "period":
            b = {**a, "weeks": self.period_b.weeks()}
        elif self.compare_by == "unit":
            b = {**a, "unit": self.units[1]}
        else:
            a = {**a, "shift_types": ["day"]}
            b = {**a, "shift_types": ["night"]}
        return [a, b]


def summarise(cells: list[dict], expected: int) -> dict:
    """Average the released cells of one side. Suppressed cells stay out and are counted."""
    released = [c for c in cells if c["status"] == "released"]
    statuses = {}
    for c in cells:
        statuses[c["status"]] = statuses.get(c["status"], 0) + 1
    values = {m: (round(sum(c[m] for c in released) / len(released)) if released else None)
              for m in METRICS}
    band = None
    if released:
        counts = {b: sum(c["phys_load_band"] == b for c in released) for b in BAND_ORDER}
        band = max(BAND_ORDER, key=lambda b: (counts[b], BAND_ORDER.index(b)))
    return {"values": values, "phys_load_band": band, "cells_expected": expected,
            "cells_released": len(released), "statuses": statuses}


def compare(req: ComparisonRequest, side_cells: list[list[dict]], labels: list[str]) -> dict:
    sides = req.sides()
    a, b = (summarise(cells, len(s["weeks"]) * len(s["shift_types"]))
            for cells, s in zip(side_cells, sides))
    wanted = METRICS if req.metrics == "all" else req.metrics
    rows = []
    for m in wanted:
        va, vb = a["values"][m], b["values"][m]
        delta = None if va is None or vb is None else va - vb
        rows.append({"metric": m, "label": METRIC_LABELS[m], "a": va, "b": vb, "delta": delta,
                     "arrow": None if delta is None else ("up" if delta > 0 else "down" if delta < 0 else "flat"),
                     "higher_is_better": m in HIGHER_IS_BETTER})

    warnings = []
    for name, side in (("A", a), ("B", b)):
        hidden = side["statuses"].get("suppressed_k", 0) + side["statuses"].get("suppressed_membership", 0)
        missing = side["cells_expected"] - sum(side["statuses"].values())
        if hidden or missing:
            warnings.append({"code": "suppressed", "side": name,
                             "text": f"{name}: {hidden + missing} of {side['cells_expected']} cells are suppressed or have no data."})
        if side["statuses"].get("not_representative"):
            warnings.append({"code": "not_representative", "side": name,
                             "text": f"{name}: {side['statuses']['not_representative']} cells are below the participation floor."})
        if side["statuses"].get("quality_gate"):
            warnings.append({"code": "quality_gate", "side": name,
                             "text": f"{name}: {side['statuses']['quality_gate']} cells are below the coverage gate."})
    ca, cb = a["values"]["coverage_pct"], b["values"]["coverage_pct"]
    if ca is not None and cb is not None and abs(ca - cb) > config.COVERAGE_MISMATCH_POINTS:
        warnings.append({"code": "coverage_mismatch", "side": None,
                         "text": "Coverage differs by more than 20 points between the two sides."})

    return {"labels": labels, "a": a, "b": b, "rows": rows, "warnings": warnings,
            "interpretation": interpret(rows, a, b, labels)}


def interpret(rows: list[dict], a: dict, b: dict, labels: list[str]) -> str:
    """Written by code. Describes differences; never says why."""
    if not a["cells_released"] or not b["cells_released"]:
        return "No comparison: at least one side has no released cells."
    parts = []
    for r in rows:
        if r["metric"] in ("coverage_pct", "participation_pct") or not r["delta"]:
            continue
        word = "higher" if r["delta"] > 0 else "lower"
        parts.append((abs(r["delta"]), f"{r['label']} is {abs(r['delta'])} points {word} in {labels[0]} than in {labels[1]}"))
    if not parts:
        return f"No difference in the released measures between {labels[0]} and {labels[1]}."
    top = [p for _, p in sorted(parts, reverse=True)[:2]]
    text = "; ".join(top) + "."
    return text[0].upper() + text[1:]
