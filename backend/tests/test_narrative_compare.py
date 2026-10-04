import json
from datetime import date

import pytest

from shiftload import narrative
from shiftload.compare import ComparisonRequest, compare


def cell(**kw):
    base = dict(status="released", participation_pct=60, coverage_pct=90, pct_red_low=20,
                pct_red_high=30, pct_insufficient=10, pct_no_break_5h=20,
                pct_ratio_met_and_breaks=50, phys_load_band="green")
    base.update(kw)
    return base


def payload():
    return narrative.build_payload(
        {"day": cell(pct_no_break_5h=40), "night": cell()},
        {"day": cell(), "night": cell()},
        [{"metric": "pct_red", "shift_type": "night", "direction": "up", "ratio_rounded": "about 3× usual"}],
        [{"action_type": "float_for_breaks", "before": 40, "after": 20}],
    )


def test_nothing_numeric_leaves_for_the_model():
    sent = json.dumps(narrative.gemini_view(payload()))
    assert not any(ch.isdigit() for ch in sent)
    assert "→" not in sent and "usual" not in sent


def test_template_passes_its_own_validator_and_renders_values():
    p = payload()
    t = narrative.template_narrative(p)
    assert narrative.validate(t, p) is None
    out = narrative.render(t, p)
    assert "20% → 40%" in out["changes"][0]
    assert "about 3× usual" in out["flags"][0]
    assert "40% → 20%" in out["actions"][0]


@pytest.mark.parametrize("headline,reason", [
    ("Break gaps rose by 20 points.", "contains a digit"),
    ("Break gaps rose because of staffing.", "causal wording: because"),
    ("Break gaps rose due to staffing.", "causal wording: due to"),
    ("Break gaps rose: {{change_z}}.", "unknown placeholder: change_z"),
])
def test_validator_rejects(headline, reason):
    p = payload()
    bad = {"headline": headline, "changes": [], "flags": [], "actions": [], "data_note": ""}
    assert narrative.validate(bad, p) == reason


def test_validator_rejects_wrong_shape():
    assert narrative.validate("just text", payload()) == "wrong shape"
    assert narrative.validate({"headline": "ok", "changes": "x"}, payload()) == "wrong shape"


def test_generate_without_key_uses_template():
    out = narrative.generate(payload(), use_gemini=True)
    assert out["source"] == "template"


def test_green_week_wording_is_not_unit_is_fine():
    p = narrative.build_payload({"day": cell(pct_red_low=0, pct_red_high=0)}, {}, [], [])
    out = narrative.render(narrative.template_narrative(p), p)
    assert out["headline"] == "No evidence of overload in recorded shifts."
    assert "Coverage 90%" in out["data_note"]


def test_suppressed_week_says_so():
    p = narrative.build_payload({"day": {"status": "suppressed_k"}}, {}, [], [])
    assert "fewer than five" in narrative.template_narrative(p)["headline"]


def test_validator_demo_is_rejected():
    assert narrative.validator_demo()["rejection"] == "contains a digit"


def req(**kw):
    base = dict(compare_by="period", units=["4west"], period_a={"week_start": "2026-09-23"},
                period_b={"week_start": "2026-09-14"})
    base.update(kw)
    return ComparisonRequest(**base)


def test_dates_snap_to_whole_weeks():
    assert req().period_a.week_start == date(2026, 9, 21)


def test_request_validation():
    with pytest.raises(ValueError):
        req(compare_by="unit")                       # needs two units
    with pytest.raises(ValueError):
        req(period_b=None)                           # period compare needs B
    with pytest.raises(ValueError):
        req(period_a={"week_start": "2026-09-21", "n_weeks": 14})
    with pytest.raises(ValueError):
        req(metrics=["salary"])


def test_compare_counts_suppressed_cells_and_warns():
    a = [cell(unit_id="4west", pct_no_break_5h=40), {"status": "suppressed_k"}]
    b = [cell(unit_id="4west"), cell(unit_id="4west", coverage_pct=60)]
    out = compare(req(), [a, b], ["week of Sep 21", "week of Sep 14"])
    row = next(r for r in out["rows"] if r["metric"] == "pct_no_break_5h")
    assert (row["a"], row["b"], row["delta"], row["arrow"]) == (40, 20, 20, "up")
    assert any(w["code"] == "suppressed" and w["side"] == "A" for w in out["warnings"])
    assert "20 points higher" in out["interpretation"]
    assert not any(w in out["interpretation"].lower() for w in ("because", "caused", "due to"))


def test_compare_coverage_mismatch_warning():
    out = compare(req(), [[cell(coverage_pct=90)], [cell(coverage_pct=60)]], ["A", "B"])
    assert any(w["code"] == "coverage_mismatch" for w in out["warnings"])


def test_compare_with_nothing_released():
    out = compare(req(), [[{"status": "suppressed_k"}], [cell()]], ["A", "B"])
    assert out["interpretation"].startswith("No comparison")
