"""End-to-end check against the running services (8001 nurse API, 8002 manager service).

Spine: one shift in -> one card out -> one relief request -> one weekly release.
"""
import json
import time

import httpx

N = "http://localhost:8001"
M = "http://localhost:8002"


def h(role: str, uid: str = "x") -> dict:
    return {"Authorization": f"Bearer dev:{role}:{uid}"}


def ok(r: httpx.Response):
    assert r.status_code == 200, f"{r.request.method} {r.request.url} -> {r.status_code} {r.text[:300]}"
    return r.json()


def main() -> None:
    nurse = h("nurse", "demo-nurse")
    c = httpx.Client(timeout=120)

    ok(c.post(f"{N}/onboarding", headers=nurse, json={
        "birth_year": 1994, "rotation": {"pattern": "day", "start_hour": 7}, "relief_recipient": "charge"}))
    print("me:", ok(c.get(f"{N}/me", headers=nurse))["onboarded"])

    shift_id = ok(c.post(f"{N}/replay/start", headers=nurse, json={"speed": 30}))["shift_id"]
    nudged = False
    while True:
        cur = ok(c.get(f"{N}/me/shift/current", headers=nurse))
        if cur["nudge"] and not nudged:
            nudged = True
            print(f"nudge at minute {cur['elapsed_min']} (since break {cur['since_break_min']})")
            ok(c.post(f"{N}/relief", headers=nurse, json={"recipient_type": "charge"}))
            print("recipient sees:", ok(c.get(f"{N}/relief", headers=h("charge_nurse"))))
        if not cur["replay_running"]:
            break
        time.sleep(0.2)
    print("live metrics:", cur["metrics"], "elapsed", cur["elapsed_min"])
    print("suggested breaks:", cur["suggested_breaks"])
    assert c.get(f"{N}/relief", headers=nurse).status_code == 403

    reqs = ok(c.get(f"{N}/relief", headers=h("charge_nurse")))
    ok(c.post(f"{N}/relief/{reqs[0]['request_id']}/handled", headers=h("charge_nurse")))
    assert ok(c.get(f"{N}/relief", headers=h("charge_nurse"))) == []

    prop = ok(c.post(f"{N}/shifts/{shift_id}/propose", headers=nurse))
    card = ok(c.post(f"{N}/shifts/{shift_id}/end", headers=nurse, json={
        "breaks": [{"id": b["id"], "status": "confirmed"} for b in prop["breaks"]],
        "ratio_status": "not_met", "drained_rating": 8}))
    print("card:", json.dumps(card, default=str))
    assert card["band"] == "red" and card["recovery_band"] == "red"
    draft = ok(c.get(f"{N}/me/reports/{shift_id}/draft", headers=nurse))
    print(draft["text"])
    ok(c.post(f"{N}/me/reports/{shift_id}/sent", headers=nurse))
    print("history:", len(ok(c.get(f"{N}/me/shifts", headers=nurse))))

    print("release:", ok(c.post(f"{N}/jobs/release/run", headers=h("admin"))))

    mgr = h("manager")
    meta = ok(c.get(f"{M}/meta", headers=mgr))
    week = meta["weeks"][-1]
    cells = ok(c.get(f"{M}/manager/weekly", headers=mgr, params={"unit": "er"}))
    print("er cells:", len(cells), "flags:", len(ok(c.get(f"{M}/manager/flags", headers=mgr))))
    print("summary:", ok(c.get(f"{M}/manager/summary", headers=mgr, params={"unit": "er", "week": week}))["narrative"])
    cmp_ = ok(c.post(f"{M}/manager/compare", headers=mgr, json={
        "compare_by": "unit", "units": ["4west", "5east"], "period_a": {"week_start": week, "n_weeks": 4}}))
    print("compare:", cmp_["interpretation"], cmp_["warnings"])
    ok(c.post(f"{M}/manager/actions", headers=mgr, json={
        "unit_id": "er", "week_start": week, "action_type": "float_for_breaks", "note": "smoke"}))
    print("demo:", ok(c.post(f"{M}/manager/validator-demo", headers=mgr))["rejection"])
    print("gap:", {k: v for k, v in ok(c.get(f"{M}/committee/gap", headers=h("joint_committee"),
                                             params={"unit": "er"})).items() if k != "weeks"})
    log = ok(c.get(f"{M}/committee/access-log", headers=h("joint_committee")))
    print("access log rows:", log["total"])
    assert c.get(f"{M}/committee/access-log", headers=mgr).status_code == 403
    print("SMOKE OK")


if __name__ == "__main__":
    main()
