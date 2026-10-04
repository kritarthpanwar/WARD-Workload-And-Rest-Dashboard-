"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Break, LiveChart, Win } from "@/components/LiveChart";
import { BAND_COLOR, BandChip, ErrorLine, Icon, Mode, More, Badge, Panel, Ring, useRole } from "@/components/ui";
import { fmtDay, fmtTime, hm, nurseApi } from "@/lib/api";

type Me = {
  display_name: string;
  unit_name: string;
  onboarded: boolean;
  baseline_status: string;
  relief_recipient: string;
  auto_relief: boolean;
  paused_until: string | null;
  purpose_limit: string;
};

type Current = {
  baseline_status: string;
  replay_running: boolean;
  shift: null | { shift_id: string; start_ts: string; shift_type: string; data_mode: Mode };
  elapsed_min: number;
  hr_rest: number;
  model: { name: string; trained: boolean };
  windows: Win[];
  metrics: { coverage_pct: number; mean_pct_hrr: number | null; unexplained_hr_min: number; time_on_feet_min: number };
  phys_band_so_far: string;
  suggested_breaks: Break[];
  since_break_min: number;
  sleep_before_min: number | null;
  nudge: boolean;
  relief_pending: boolean;
};

type Card = {
  shift_id: string;
  start_ts: string;
  end_ts: string;
  shift_type: string;
  data_mode: Mode;
  band: string;
  phys_band: string;
  recovery_band: string;
  recovery_provisional: boolean;
  mean_pct_hrr: number | null;
  min_above_30_hrr: number;
  longest_no_break_min: number;
  n_breaks_confirmed: number;
  breaks_uncertain: boolean;
  unexplained_hr_min: number;
  time_on_feet_min: number;
  coverage_pct: number;
  max_gap_min: number;
  ratio_status: string;
  sleep_before_min: number | null;
};

type Proposal = { end_ts: string; breaks: { id: string; start_ts: string; end_ts: string }[] };

const RECIPIENTS = [
  ["charge", "Charge nurse"],
  ["buddy", "Break buddy"],
  ["float", "Float nurse"],
] as const;
const recipientLabel = (v: string) => RECIPIENTS.find(([k]) => k === v)?.[1] ?? v;

const LOAD_WORD: Record<string, string> = { green: "Light to moderate", amber: "Heavy", red: "Very heavy", insufficient: "Not enough data" };
const SHIFT_WORD: Record<string, [string, string]> = {
  green: ["Green shift", "Load and breaks were within the usual range."],
  amber: ["Amber shift", "This shift was heavier than usual."],
  red: ["Red shift", "This shift counts as overloaded."],
  insufficient: ["Not enough data", "Too little was recorded to rate this shift. It is never counted as green."],
};

type Tab = "today" | "history" | "settings";

export default function NursePage() {
  const session = useRole("nurse");
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [error, setError] = useState<string | null>(null);

  const loadMe = useCallback(() => {
    nurseApi<Me>("/me").then(setMe, (e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (session) loadMe();
  }, [session, loadMe]);

  if (!session) return <main className="narrow" />;
  if (!me)
    return (
      <main className="narrow">
        <ErrorLine error={error} />
      </main>
    );
  if (!me.onboarded) return <Onboarding me={me} done={loadMe} />;

  return (
    <main className="narrow">
      {tab === "today" && <Today me={me} />}
      {tab === "history" && <History />}
      {tab === "settings" && <Settings me={me} reload={loadMe} />}
      <nav className="tabbar">
        {(
          [
            ["today", "Today", "heart"],
            ["history", "History", "list"],
            ["settings", "Settings", "gear"],
          ] as const
        ).map(([key, label, icon]) => (
          <button key={key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </nav>
    </main>
  );
}

// ------------------------------------------------------------- onboarding

function Onboarding({ me, done }: { me: Me; done: () => void }) {
  const [step, setStep] = useState(0);
  const [birthYear, setBirthYear] = useState("");
  const [pattern, setPattern] = useState("day");
  const [recipient, setRecipient] = useState("charge");
  const [error, setError] = useState<string | null>(null);
  const year = Number(birthYear);

  return (
    <main className="narrow">
      <div className="dots" style={{ marginTop: 12 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i === step ? "on" : ""} />
        ))}
      </div>
      {step === 0 && (
        <div className="fade-in stack">
          <h1>Hi {me.display_name.split(" ")[0]}</h1>
          <p className="sub">ShiftLoad keeps an automatic record of how heavy your shifts are and whether you got a break.</p>
          <div className="list">
            <div>Your manager never sees your data — only weekly totals for groups of five or more.</div>
            <div>Raw heart-rate data is deleted when each shift ends.</div>
            <div>You can pause or withdraw at any time.</div>
            <div className="note">{me.purpose_limit}</div>
          </div>
          <button className="primary big" onClick={() => setStep(1)}>
            I understand — opt in
          </button>
        </div>
      )}
      {step === 1 && (
        <div className="fade-in stack">
          <h1>About you</h1>
          <Panel>
            <div className="stack">
              <label className="field">
                Birth year (to estimate your max heart rate)
                <input type="number" inputMode="numeric" placeholder="e.g. 1994" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
              </label>
              <label className="field">
                Usual shifts
                <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
                  <option value="day">Days, 07:00–19:00</option>
                  <option value="night">Nights, 19:00–07:00</option>
                  <option value="rotating">Rotating</option>
                </select>
              </label>
            </div>
          </Panel>
          <button className="primary big" disabled={!(year >= 1940 && year <= 2010)} onClick={() => setStep(2)}>
            Continue
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="fade-in stack">
          <h1>Who should get your relief requests?</h1>
          <div className="choice">
            {RECIPIENTS.map(([k, label]) => (
              <button key={k} className={recipient === k ? "pressed" : ""} onClick={() => setRecipient(k)}>
                {label}
              </button>
            ))}
          </div>
          <ErrorLine error={error} />
          <button
            className="primary big"
            onClick={() =>
              nurseApi("/onboarding", {
                birth_year: year,
                rotation: { pattern, start_hour: pattern === "night" ? 19 : 7 },
                relief_recipient: recipient,
              }).then(done, (e) => setError(e.message))
            }
          >
            Done
          </button>
        </div>
      )}
    </main>
  );
}

// ------------------------------------------------------------------ today

function Today({ me }: { me: Me }) {
  const [cur, setCur] = useState<Current | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoSent = useRef<string | null>(null);

  const refresh = useCallback(() => {
    nurseApi<Current>("/me/shift/current").then(setCur, (e) => setError(e.message));
  }, []);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [refresh]);

  const shift = cur?.shift ?? null;
  const requestRelief = useCallback(() => {
    nurseApi("/relief", { recipient_type: me.relief_recipient }).then(refresh, (e) => setError(e.message));
  }, [me.relief_recipient, refresh]);

  // pre-enabled auto-request: sent once per shift when the nudge fires
  useEffect(() => {
    if (me.auto_relief && cur?.nudge && shift && autoSent.current !== shift.shift_id) {
      autoSent.current = shift.shift_id;
      requestRelief();
    }
  }, [me.auto_relief, cur?.nudge, shift, requestRelief]);

  if (!cur) return <ErrorLine error={error} />;

  const startReplay = (speed: number) => {
    setCard(null);
    setError(null);
    nurseApi("/replay/start", { speed }).then(refresh, (e) => setError(e.message));
  };

  if (!shift) {
    return (
      <div className="fade-in">
        <h1>{card ? "Shift summary" : "Today"}</h1>
        <p className="sub" style={{ marginBottom: 16 }}>
          {me.display_name} · {me.unit_name}
        </p>
        {card ? (
          <>
            <ShiftCard card={card} />
            <button className="big" onClick={() => setCard(null)}>
              Done
            </button>
          </>
        ) : (
          <>
            <Panel>
              <div className="result">
                <h2>No shift running</h2>
                <p className="sub" style={{ marginTop: 6 }}>Play back a recorded day to see how it works.</p>
              </div>
              <div className="stack">
                <button className="primary big" onClick={() => startReplay(8)}>
                  Play a recorded day
                </button>
                <button className="big" onClick={() => startReplay(60)}>
                  Play it fast (12 seconds)
                </button>
              </div>
            </Panel>
            <ErrorLine error={error} />
          </>
        )}
      </div>
    );
  }

  if (proposal) {
    return (
      <EndFlow
        shiftId={shift.shift_id}
        proposal={proposal}
        cancel={() => setProposal(null)}
        done={(c) => {
          setProposal(null);
          setCard(c);
          refresh();
        }}
      />
    );
  }

  const m = cur.metrics;
  const since = cur.since_break_min;
  const breakColor = since >= 300 ? "var(--critical)" : since >= 240 ? "var(--warning)" : "var(--good)";
  const breakWord = since >= 300 ? "Over 5 hours without a break" : since >= 240 ? "A break is due soon" : "On track";
  const toggle = (k: string) => setOpen(open === k ? null : k);

  return (
    <div>
      <div className="row" style={{ marginBottom: 2 }}>
        <Badge mode={shift.data_mode} note={shift.data_mode === "replay" ? "simulated" : undefined} />
        <span className="muted">
          {shift.shift_type === "day" ? "Day" : "Night"} shift · started {fmtTime(shift.start_ts)}
        </span>
      </div>
      <h1>{hm(cur.elapsed_min)} in</h1>

      <section className="panel hero-card" style={{ marginTop: 14 }}>
        <Ring fraction={since / 300} color={breakColor}>
          <strong style={{ fontSize: 22 }}>{since >= 60 ? `${Math.floor(since / 60)}h ${since % 60}m` : `${since}m`}</strong>
          <span className="muted" style={{ fontSize: 11 }}>
            no break
          </span>
        </Ring>
        <div className="ring-text">
          <div className="kicker muted">Since your last break</div>
          <h2>{breakWord}</h2>
        </div>
      </section>

      <Highlights cur={cur} startIso={shift.start_ts} />

      {cur.relief_pending ? (
        <div className="banner info">
          <strong>Relief requested.</strong> Your {recipientLabel(me.relief_recipient).toLowerCase()} sees only “Relief requested — {me.display_name}”.
        </div>
      ) : (
        <button className={`big ${cur.nudge ? "primary" : ""}`} style={{ marginBottom: 12 }} onClick={requestRelief}>
          Request relief from your {recipientLabel(me.relief_recipient).toLowerCase()}
        </button>
      )}

      <button className="metric" onClick={() => toggle("load")}>
        <div className="kicker">
          <span className="icon" style={{ background: "var(--series-1)" }} />
          Physical load
          <span className="more">{open === "load" ? "Hide" : "Show chart"}</span>
        </div>
        <div className="value">
          {m.mean_pct_hrr === null ? "—" : m.mean_pct_hrr.toFixed(0)}
          <small>% effort</small>
        </div>
        <div className="caption">
          <BandChip band={cur.phys_band_so_far} label={LOAD_WORD[cur.phys_band_so_far]} />
        </div>
      </button>
      {open === "load" && (
        <Panel>
          <LiveChart windows={cur.windows} breaks={cur.suggested_breaks} startIso={shift.start_ts} elapsed={cur.elapsed_min} />
        </Panel>
      )}

      {cur.sleep_before_min !== null && (
        <div className="metric">
          <div className="kicker">
            <span className="icon" style={{ background: "var(--sleep)" }} />
            Sleep
          </div>
          <div className="value">
            {Math.floor(cur.sleep_before_min / 60)}
            <small>h</small> {cur.sleep_before_min % 60}
            <small>min before this shift</small>
          </div>
        </div>
      )}

      <div className="metric">
        <div className="kicker">
          <span className="icon" style={{ background: "var(--series-2)" }} />
          Stress
        </div>
        <div className="value">
          {m.unexplained_hr_min}
          <small>min of high heart rate while still</small>
        </div>
      </div>

      <div className="metric">
        <div className="kicker">
          <span className="icon" style={{ background: "var(--nodata)" }} />
          Recording
        </div>
        <div className="value">
          {m.coverage_pct.toFixed(0)}
          <small>% recorded</small>
        </div>
        <div className="bar-track">
          <div style={{ width: `${m.coverage_pct}%`, background: m.coverage_pct < 70 ? "var(--warning)" : "var(--series-1)" }} />
        </div>
      </div>

      <ErrorLine error={error} />
      <button
        className="big"
        disabled={cur.replay_running}
        onClick={() => nurseApi<Proposal>(`/shifts/${shift.shift_id}/propose`, {}).then(setProposal, (e) => setError(e.message))}
      >
        {cur.replay_running ? "Playing the recorded day…" : "End shift"}
      </button>
    </div>
  );
}

// One question per screen.
function EndFlow({ shiftId, proposal, cancel, done }: { shiftId: string; proposal: Proposal; cancel: () => void; done: (c: Card) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, "confirmed" | "rejected">>(() =>
    Object.fromEntries(proposal.breaks.map((b) => [b.id, "confirmed" as const])),
  );
  const [ratio, setRatio] = useState<string | null>(null);
  const [drained, setDrained] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = (skipped: boolean) =>
    nurseApi<Card>(`/shifts/${shiftId}/end`, {
      breaks: skipped ? [] : Object.entries(answers).map(([id, status]) => ({ id, status })),
      skipped,
      ratio_status: ratio ?? "unknown",
      drained_rating: drained,
    }).then(done, (e) => setError(e.message));

  return (
    <div className="fade-in" key={step}>
      <div className="dots" style={{ marginTop: 12 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i === step ? "on" : ""} />
        ))}
      </div>
      {step === 0 && (
        <div className="stack">
          <h1>{proposal.breaks.length ? "Were these your breaks?" : "We didn’t see any breaks"}</h1>
          {proposal.breaks.map((b) => (
            <Panel key={b.id}>
              <div className="row">
                <strong style={{ flex: 1, fontSize: 19 }}>
                  {fmtTime(b.start_ts)} – {fmtTime(b.end_ts)}
                </strong>
                {(["confirmed", "rejected"] as const).map((s) => (
                  <button key={s} className={answers[b.id] === s ? "pressed" : ""} onClick={() => setAnswers({ ...answers, [b.id]: s })}>
                    {s === "confirmed" ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </Panel>
          ))}
          <button className="primary big" onClick={() => setStep(1)}>
            Continue
          </button>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="link" onClick={cancel}>
              Back to shift
            </button>
            <button className="link" onClick={() => submit(true)}>
              Skip all questions
            </button>
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="stack">
          <h1>Was the nurse-to-patient ratio met?</h1>
          <div className="choice">
            {[
              ["met", "Yes, it was met"],
              ["not_met", "No, it was not met"],
              ["unknown", "I don’t know"],
            ].map(([k, label]) => (
              <button
                key={k}
                className={ratio === k ? "pressed" : ""}
                onClick={() => {
                  setRatio(k);
                  setStep(2);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="link" onClick={() => setStep(0)}>
            Back
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="stack">
          <h1>How drained do you feel?</h1>
          <p className="sub">1 = fine · 10 = completely drained</p>
          <div className="scale">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button key={n} className={drained === n ? "pressed" : ""} onClick={() => setDrained(drained === n ? null : n)}>
                {n}
              </button>
            ))}
          </div>
          <ErrorLine error={error} />
          <button className="primary big" onClick={() => submit(false)}>
            Finish shift
          </button>
          <button className="link" onClick={() => setStep(1)}>
            Back
          </button>
        </div>
      )}
    </div>
  );
}

function ShiftCard({ card }: { card: Card }) {
  const [title, text] = SHIFT_WORD[card.band] ?? SHIFT_WORD.insufficient;
  const reasons: string[] = [];
  if (card.recovery_band === "red") reasons.push(`you went ${hm(card.longest_no_break_min)} without a break`);
  if (card.phys_band === "red") reasons.push("physical load was very heavy");
  if (card.band === "amber" && card.recovery_band === "amber") reasons.push(`your longest stretch without a break was ${hm(card.longest_no_break_min)}`);
  if (card.band === "amber" && card.phys_band === "amber") reasons.push("physical load was heavy");
  return (
    <div className="fade-in">
      <Panel>
        <div className="result">
          <div className="big-dot" style={{ background: BAND_COLOR[card.band] ?? BAND_COLOR.insufficient }} />
          <h2>{title}</h2>
          <p className="sub" style={{ marginTop: 6 }}>
            {reasons.length ? `Why: ${reasons.join(" and ")}.` : text}
          </p>
          <p className="sub">
            {fmtDay(card.start_ts)} · {fmtTime(card.start_ts)}–{fmtTime(card.end_ts)}{" "}
            <Badge mode={card.data_mode} note={card.data_mode === "replay" ? "simulated" : undefined} />
          </p>
        </div>
      </Panel>
      <div className="list">
        <div>
          <span className="grow">
            <strong>Breaks</strong>
            <div className="sub">
              Longest stretch without one: {hm(card.longest_no_break_min)} ·{" "}
              {card.breaks_uncertain ? "not confirmed" : `${card.n_breaks_confirmed} confirmed`}
            </div>
          </span>
          <BandChip band={card.recovery_band} />
        </div>
        <div>
          <span className="grow">
            <strong>Physical load</strong>
            <div className="sub">Average effort {card.mean_pct_hrr === null ? "—" : `${card.mean_pct_hrr}%`}</div>
          </span>
          <BandChip band={card.phys_band} />
        </div>
        <div>
          <span className="grow">
            <strong>Stress</strong>
            <div className="sub">{card.unexplained_hr_min} min of high heart rate while still</div>
          </span>
        </div>
        {card.sleep_before_min !== null && (
          <div>
            <span className="grow">
              <strong>Sleep</strong>
              <div className="sub">{hm(card.sleep_before_min)} in the 24 hours before the shift</div>
            </span>
          </div>
        )}
        <div>
          <span className="grow">
            <strong>Recording</strong>
            <div className="sub">
              {card.coverage_pct}% of the shift · longest gap {card.max_gap_min} min
            </div>
          </span>
        </div>
      </div>
      {card.band === "red" && <ReportDraft shiftId={card.shift_id} />}
    </div>
  );
}

function ReportDraft({ shiftId }: { shiftId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    nurseApi<{ text: string }>(`/me/reports/${shiftId}/draft`).then((d) => setText(d.text), (e) => setError(e.message));
  }, [shiftId]);
  if (!text) return <ErrorLine error={error} />;
  return (
    <More title="Workload report you can send">
      <p className="sub">Attach this to a workload report. Nothing is sent for you.</p>
      <pre className="report">{text}</pre>
      <div className="row">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy text"}
        </button>
        <button className="primary" disabled={sent} onClick={() => nurseApi(`/me/reports/${shiftId}/sent`, {}).then(() => setSent(true), (e) => setError(e.message))}>
          {sent ? "Counted — thank you" : "I sent this report"}
        </button>
      </div>
      <ErrorLine error={error} />
    </More>
  );
}

// One or two big plain sentences about what stood out, with the time it happened.
function Highlights({ cur, startIso }: { cur: Current; startIso: string }) {
  const at = (min: number) => fmtTime(new Date(new Date(startIso).getTime() + min * 60000).toISOString());
  const longest = (pred: (w: Win) => boolean) => {
    let best: [number, number] | null = null;
    let run: [number, number] | null = null;
    for (const w of cur.windows) {
      if (pred(w)) {
        run = run ? [run[0], w.t + 5] : [w.t, w.t + 5];
        if (!best || run[1] - run[0] > best[1] - best[0]) best = run;
      } else run = null;
    }
    return best;
  };
  const lines: { color: string; text: string }[] = [];
  const heavy = longest((w) => (w.pct_hrr ?? 0) >= 30);
  if (heavy && heavy[1] - heavy[0] >= 10) lines.push({ color: "var(--series-1)", text: `Your heart was working hard at ${at(heavy[0])}` });
  const stress = longest((w) => !!w.unexplained);
  if (stress) lines.push({ color: "var(--series-2)", text: `Stress was high at ${at(stress[0])}` });
  if (cur.sleep_before_min !== null && cur.sleep_before_min < 360)
    lines.push({ color: "var(--sleep)", text: `You slept ${hm(cur.sleep_before_min)} before this shift` });
  if (cur.since_break_min >= 300) lines.push({ color: "var(--critical)", text: `No break for ${hm(cur.since_break_min)}` });
  if (!lines.length) return null;
  return (
    <section className="panel insights">
      {lines.map((l) => (
        <div key={l.text} className="insight">
          <span className="icon" style={{ background: l.color }} />
          {l.text}
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------- history

function History() {
  const [shifts, setShifts] = useState<Card[] | null>(null);
  const [redOnly, setRedOnly] = useState(false);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    nurseApi<Card[]>("/me/shifts").then(setShifts, (e) => setError(e.message));
  }, []);
  if (!shifts) return <ErrorLine error={error} />;
  if (openCard)
    return (
      <div>
        <button className="link" onClick={() => setOpenCard(null)} style={{ marginBottom: 10 }}>
          ‹ History
        </button>
        <ShiftCard card={openCard} />
      </div>
    );
  const shown = redOnly ? shifts.filter((s) => s.band === "red") : shifts;
  return (
    <div className="fade-in">
      <h1>History</h1>
      <div className="pills" style={{ margin: "12px 0" }}>
        <button className={redOnly ? "" : "on"} onClick={() => setRedOnly(false)}>
          All shifts ({shifts.length})
        </button>
        <button className={redOnly ? "on" : ""} onClick={() => setRedOnly(true)}>
          Red shifts ({shifts.filter((s) => s.band === "red").length})
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="sub">No shifts here yet.</p>
      ) : (
        <div className="list">
          {shown.map((s) => (
            <button key={s.shift_id} onClick={() => setOpenCard(s)}>
              <span className="grow">
                <strong>{fmtDay(s.start_ts)}</strong>
                <div className="sub">{s.shift_type === "day" ? "Day shift" : "Night shift"}</div>
              </span>
              <BandChip band={s.band} />
              <span className="chev">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------- settings

function Settings({ me, reload }: { me: Me; reload: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const save = (body: object) => nurseApi("/me/settings", body).then(reload, (e) => setError(e.message));
  const paused = !!me.paused_until && new Date(me.paused_until) > new Date();
  return (
    <div className="fade-in">
      <h1>Settings</h1>
      <p className="sub" style={{ marginBottom: 16 }}>
        {me.display_name} · {me.unit_name}
      </p>
      <Panel title="Relief requests">
        <div className="stack">
          <div className="pills">
            {RECIPIENTS.map(([k, label]) => (
              <button key={k} className={me.relief_recipient === k ? "on" : ""} style={{ background: me.relief_recipient === k ? undefined : "var(--wash)" }} onClick={() => save({ relief_recipient: k })}>
                {label}
              </button>
            ))}
          </div>
          <label className="row">
            <input type="checkbox" checked={me.auto_relief} onChange={(e) => save({ auto_relief: e.target.checked })} />
            <span>Ask for relief automatically after 5 hours without a break</span>
          </label>
        </div>
      </Panel>
      <Panel title="Recording">
        <p className="sub">{paused ? `Paused until ${fmtDay(me.paused_until!)}.` : "Recording is on."}</p>
        <div className="row">
          {paused ? (
            <button onClick={() => save({ pause_days: 0 })}>Resume</button>
          ) : (
            <>
              <button onClick={() => save({ pause_days: 1 })}>Pause 1 day</button>
              <button onClick={() => save({ pause_days: 7 })}>Pause 7 days</button>
            </>
          )}
        </div>
      </Panel>
      <More title="What happens to my data">
        <ul className="stack" style={{ paddingLeft: 18, margin: 0 }}>
          <li>A trustee holds the data — not the hospital.</li>
          <li>Managers see weekly unit totals only, for groups of five or more, rounded and with noise added.</li>
          <li>Raw heart-rate and step data is deleted when a shift ends.</li>
          <li>Missing data is never shown as green. Watch-off time never counts as a break.</li>
          <li>A relief request shows only your name, to the person you choose, and is deleted when handled.</li>
          <li>Every manager and committee query is logged for the joint committee.</li>
          <li>No AI model sees your data.</li>
          <li>{me.purpose_limit}</li>
        </ul>
      </More>
      <More title="Withdraw">
        <p className="sub">Deletes every shift and setting held about you. This can’t be undone.</p>
        {confirming ? (
          <div className="row">
            <button className="danger" onClick={() => nurseApi("/me/withdraw", {}).then(reload, (e) => setError(e.message))}>
              Yes, delete all my data
            </button>
            <button onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        ) : (
          <button className="danger" onClick={() => setConfirming(true)}>
            Withdraw and delete my data
          </button>
        )}
      </More>
      <ErrorLine error={error} />
    </div>
  );
}
