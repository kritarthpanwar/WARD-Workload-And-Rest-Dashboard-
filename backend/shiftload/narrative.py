"""Weekly summary text (spec 10.2 and 10.4).

Gemini only ever sees placeholder keys, metric names and direction/size enums.
Code substitutes the published values afterwards. Any output containing a
digit, an unknown placeholder or a causal word is rejected and replaced by
the template.
"""
import json
import re

import httpx

from . import config

METRIC_LABELS = {
    "pct_red_low": "red shifts",
    "pct_red_high": "red shifts (upper estimate)",
    "pct_red": "red shifts",
    "pct_insufficient": "unknown shifts",
    "pct_no_break_5h": "shifts with five hours and no break",
    "pct_ratio_met_and_breaks": "shifts with ratio met and breaks",
    "mean_pct_hrr": "physical load",
    "unexplained_hr_min": "stress minutes",
    "phys_load_band": "physical load band",
    "coverage_pct": "coverage",
    "participation_pct": "participation",
}
SHIFT_LABELS = {"day": "Days", "night": "Nights", "all": "All shifts"}
ACTION_LABELS = {
    "called_in_staff": "called in staff",
    "float_for_breaks": "float for breaks",
    "reassigned_patients": "reassigned patients",
    "none": "no action",
}
CHANGE_METRICS = ["pct_red_low", "pct_no_break_5h", "pct_ratio_met_and_breaks", "pct_insufficient"]
PLACEHOLDER = re.compile(r"\{\{([a-z_]+)\}\}")
LETTERS = "abcdefghij"


def direction(delta: float) -> str:
    return "flat" if delta == 0 else ("up" if delta > 0 else "down")


def size(delta: float) -> str:
    d = abs(delta)
    return "small" if d <= 10 else ("moderate" if d <= 20 else "large")


def build_payload(cells: dict, prev: dict, flags: list[dict], actions: list[dict]) -> dict:
    """Everything the summary may mention, from published values only.

    cells / prev: published rows for this and the previous week keyed by shift
    type. actions: rows with action_type plus the no-break share in the action
    week and the week after.
    """
    items, values = [], {}
    live = {st: c for st, c in cells.items() if c["status"] == "released"}
    changes = []
    for st, cell in live.items():
        before = prev.get(st)
        if not before or before["status"] != "released":
            continue
        for m in CHANGE_METRICS:
            delta = cell[m] - before[m]
            if delta:
                changes.append((abs(delta), m, st, delta, f"{before[m]}% → {cell[m]}%"))
    for i, (_, m, st, delta, text) in enumerate(sorted(changes, reverse=True)[:3]):
        key = f"change_{LETTERS[i]}"
        items.append({"key": key, "kind": "change", "metric": METRIC_LABELS[m],
                      "shift_type": st, "direction": direction(delta), "size": size(delta)})
        values[key] = text
    for i, f in enumerate(flags[:5]):
        key = f"flag_{LETTERS[i]}"
        items.append({"key": key, "kind": "flag", "metric": METRIC_LABELS[f["metric"]],
                      "shift_type": f["shift_type"], "direction": f["direction"], "size": None})
        values[key] = f["ratio_rounded"]
    for i, a in enumerate(actions[:3]):
        key = f"action_{LETTERS[i]}"
        delta = a["after"] - a["before"]
        items.append({"key": key, "kind": "action", "metric": ACTION_LABELS[a["action_type"]],
                      "shift_type": "all", "direction": direction(delta), "size": size(delta)})
        values[key] = f"{a['before']}% → {a['after']}%"
    if live:
        coverage = min(c["coverage_pct"] for c in live.values())
        values["coverage"] = f"{coverage}%"
        values["participation"] = f"{next(iter(live.values()))['participation_pct']}%"
        status = "released"
    elif cells:
        status = next(iter(cells.values()))["status"]
    else:
        status = "no_data"
    return {
        "status": status,
        "no_red": bool(live) and all(c["pct_red_high"] == 0 for c in live.values()),
        "items": items,
        "values": values,
    }


def gemini_view(payload: dict) -> dict:
    """What leaves for Gemini: no values, no names, no numbers."""
    return {
        "no_red": payload["no_red"],
        "items": payload["items"],
        "data_keys": [k for k in ("coverage", "participation") if k in payload["values"]],
    }


def template_narrative(payload: dict) -> dict:
    if payload["status"] != "released":
        reason = {
            "suppressed_k": "fewer than five nurses contributed",
            "suppressed_membership": "the group of nurses changed by fewer than five from a neighbouring release",
            "not_representative": "participation is below the floor",
            "quality_gate": "data coverage is below the quality gate",
            "no_data": "no shifts were recorded",
        }[payload["status"]]
        return {"headline": f"No release for this week: {reason}.", "changes": [], "flags": [],
                "actions": [], "data_note": ""}
    by_kind = {k: [i for i in payload["items"] if i["kind"] == k] for k in ("change", "flag", "action")}
    if by_kind["flag"]:
        headline = "Something unusual this week."
    elif payload["no_red"]:
        headline = "No evidence of overload in recorded shifts."
    elif by_kind["change"]:
        headline = "A few things changed since last week."
    else:
        headline = "About the same as last week."

    def cap(s: str) -> str:
        return s[0].upper() + s[1:]

    data_note = ""
    if "coverage" in payload["values"] and "participation" in payload["values"]:
        data_note = "Coverage {{coverage}}, participation {{participation}}."
    return {
        "headline": headline,
        "changes": [
            f"{SHIFT_LABELS[i['shift_type']]}: {i['metric']} went {i['direction']}, {{{{{i['key']}}}}}."
            for i in by_kind["change"]
        ],
        "flags": [
            f"{SHIFT_LABELS[i['shift_type']]}: {i['metric']} unusual, {{{{{i['key']}}}}}."
            for i in by_kind["flag"]
        ],
        "actions": [
            f"After “{i['metric']}”: no-break shifts went {i['direction']}, {{{{{i['key']}}}}}."
            for i in by_kind["action"]
        ],
        "data_note": data_note,
    }


def _strings(narrative: dict) -> list[str]:
    out = [narrative.get("headline", ""), narrative.get("data_note", "")]
    for k in ("changes", "flags", "actions"):
        out.extend(narrative.get(k, []))
    return out


def validate(narrative, payload: dict) -> str | None:
    """Return None when acceptable, else the rejection reason."""
    if not isinstance(narrative, dict) or not isinstance(narrative.get("headline"), str):
        return "wrong shape"
    for k in ("changes", "flags", "actions"):
        if not isinstance(narrative.get(k, []), list) or not all(
            isinstance(s, str) for s in narrative.get(k, [])
        ):
            return "wrong shape"
    if not isinstance(narrative.get("data_note", ""), str):
        return "wrong shape"
    allowed = set(payload["values"])
    for text in _strings(narrative):
        for key in PLACEHOLDER.findall(text):
            if key not in allowed:
                return f"unknown placeholder: {key}"
        bare = PLACEHOLDER.sub("", text)
        if "{{" in bare or "}}" in bare:
            return "malformed placeholder"
        if re.search(r"\d", bare):
            return "contains a digit"
        lowered = bare.lower()
        for word in config.CAUSAL_WORDS:
            if re.search(rf"\b{re.escape(word)}\b", lowered):
                return f"causal wording: {word}"
    return None


def render(narrative: dict, payload: dict) -> dict:
    def sub(text: str) -> str:
        return PLACEHOLDER.sub(lambda m: payload["values"][m.group(1)], text)

    return {
        "headline": sub(narrative["headline"]),
        "changes": [sub(s) for s in narrative.get("changes", [])],
        "flags": [sub(s) for s in narrative.get("flags", [])],
        "actions": [sub(s) for s in narrative.get("actions", [])],
        "data_note": sub(narrative.get("data_note", "")),
    }


PROMPT = """You write a short weekly summary of nurse workload measures for one hospital unit.
You are given items. Each has a placeholder key, a metric name, a direction and a size.
Rules:
- Never write a digit or a number word for a value. Refer to a value only by writing its
  placeholder like {{change_a}}. Use only the placeholder keys you were given.
- Describe what changed, never why. Do not use causal wording.
- If no_red is true, the headline must say there is no evidence of overload in recorded shifts.
- Never give advice.
Return JSON only: {"headline": str, "changes": [str], "flags": [str], "actions": [str], "data_note": str}
One sentence per item, in the list matching the item's kind. data_note mentions each data key.
Items:
"""


def call_gemini(payload: dict) -> dict:
    body = {
        "contents": [{"parts": [{"text": PROMPT + json.dumps(gemini_view(payload))}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent"
    r = httpx.post(url, json=body, headers={"x-goog-api-key": config.GEMINI_API_KEY}, timeout=30)
    r.raise_for_status()
    return json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])


def generate(payload: dict, use_gemini: bool) -> dict:
    """Rendered narrative plus where it came from and any rejection."""
    rejection = None
    if use_gemini and config.GEMINI_API_KEY and payload["status"] == "released":
        try:
            candidate = call_gemini(payload)
            rejection = validate(candidate, payload)
            if rejection is None:
                return {"narrative": render(candidate, payload), "source": "gemini", "rejection": None}
        except Exception as exc:  # network or parse failure: fall back to the template
            rejection = f"call failed: {type(exc).__name__}"
    return {"narrative": render(template_narrative(payload), payload), "source": "template",
            "rejection": rejection}


def validator_demo() -> dict:
    """A canned bad model output, to show the guardrail rejecting it."""
    payload = {
        "status": "released", "no_red": False,
        "items": [{"key": "change_a", "kind": "change", "metric": METRIC_LABELS["pct_no_break_5h"],
                   "shift_type": "night", "direction": "up", "size": "moderate"}],
        "values": {"change_a": "20% → 40%", "coverage": "90%", "participation": "60%"},
    }
    bad = {
        "headline": "Break gaps rose by 20 points because the unit was short-staffed.",
        "changes": ["The no-break share went up: {{change_a}}."],
        "flags": [], "actions": [], "data_note": "Coverage {{coverage}}.",
    }
    return {
        "sent_to_model": gemini_view(payload),
        "model_output": bad,
        "rejection": validate(bad, payload),
        "fallback": render(template_narrative(payload), payload),
    }
