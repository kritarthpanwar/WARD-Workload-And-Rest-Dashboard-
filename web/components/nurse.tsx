"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Copy, Play, Send, ShieldCheck, Zap } from "lucide-react";
import { Break, ShiftChart, Span, Win } from "@/components/ShiftChart";
import { BAND_COLOR, Badge, BandChip, ErrorLine, Mode, More, PageHeading, Panel, Ring, Toggle, useRole } from "@/components/ui";
import { fmtDay, fmtTime, hm, nurseApi } from "@/lib/api";

export type Me = {
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
  mean_pct_hrr: number | null;
  longest_no_break_min: number;
  n_breaks_confirmed: number;
  breaks_uncertain: boolean;
  unexplained_hr_min: number;
  coverage_pct: number;
  max_gap_min: number;
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

/** Loads the signed-in nurse and shows onboarding until they have opted in. */
export function NurseGate({ children }: { children: (me: Me, reload: () => void) => ReactNode }) {
  const session = useRole("nurse");
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    nurseApi<Me>("/me").then(setMe, (e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (session) load();
  }, [session, load]);
  if (!session) return <main />;
  if (!me)
    return (
      <main>
        <ErrorLine error={error} />
      </main>
    );
  return <main>{me.onboarded ? children(me, load) : <Onboarding me={me} done={load} />}</main>;
}

// ------------------------------------------------------------- onboarding

function Onboarding({ me, done }: { me: Me; done: () => void }) {
  const [step, setStep] = useState(0);
  const [birthYear, setBirthYear] = useState("");
  const [pattern, setPattern] = useState("day");
  const [recipient, setRecipient] = useState("charge");
  const [error, setError] = useState<string | null>(null);
  const year = Number(birthYear);
  const steps = ["Consent", "About you", "Relief"];

  return (
    <div style={{ maxWidth: 620 }}>
      <PageHeading title={`Welcome, ${me.display_name.split(" ")[0]}`} sub={me.unit_name} />
      <Panel>
        <div className="steps">
          {steps.map((s, i) => (
            <span key={s} className={i === step ? "on" : ""}>
              {i + 1} · {s}
            </span>
          ))}
        </div>
        {step === 0 && (
          <div className="stack">
            <h2>An automatic record of your shifts</h2>
            <div className="notice">
              <ShieldCheck size={20} />
              Your manager never sees your data — only weekly totals for groups of five or more.
            </div>
            <p className="sub">Raw heart-rate data is deleted when each shift ends. You can pause or withdraw any time.</p>
            <p className="sub">{me.purpose_limit}</p>
            <button className="primary big" onClick={() => setStep(1)}>
              I understand — opt in <ArrowRight size={18} />
            </button>
          </div>
        )}
        {step === 1 && (
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
            <button className="primary big" disabled={!(year >= 1940 && year <= 2010)} onClick={() => setStep(2)}>
              Continue <ArrowRight size={18} />
            </button>
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <h2>Who should get your relief requests?</h2>
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
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------ today

export function Today({ me }: { me: Me }) {
  const [cur, setCur] = useState<Current | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
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
      <>
        <PageHeading title={card ? "Shift summary" : "My shift"} sub={`${me.display_name} · ${me.unit_name}`} />
        {card ? (
          <div style={{ maxWidth: 720 }}>
            <ShiftCard card={card} />
            <button className="big" onClick={() => setCard(null)}>
              Done
            </button>
          </div>
        ) : (
          <Panel className="empty">
            <h2>No shift running</h2>
            <p className="sub" style={{ margin: "6px auto 20px" }}>
              Play back a recorded day to see how it works.
            </p>
            <div className="row">
              <button className="primary" onClick={() => startReplay(8)}>
                <Play size={17} /> Play a recorded day
              </button>
              <button onClick={() => startReplay(60)}>
                <Zap size={17} /> Play it fast
              </button>
            </div>
            <ErrorLine error={error} />
          </Panel>
        )}
      </>
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
  const breakColor = since >= 300 ? "var(--critical)" : since >= 240 ? "var(--warning)" : "var(--teal-bright)";
  const breakWord = since >= 300 ? "Over 5 hours — ask for relief" : since >= 240 ? "A break is due soon" : "On track";
  const lines = highlightLines(cur, shift.start_ts);
  const active = picked === null ? null : lines.find((l) => l.key === picked) ?? null;
  const nowLoad = [...cur.windows].reverse().find((w) => w.pct_hrr !== null)?.pct_hrr ?? null;
  const simulated = shift.data_mode === "replay" ? "simulated" : undefined;
  const recorded = shift.data_mode === "recorded";   // uploaded after the shift ended

  return (
    <>
      <PageHeading
        title="My shift"
        sub={
          <>
            {me.display_name} · {fmtDay(shift.start_ts)} · {shift.shift_type === "day" ? "day" : "night"} shift from {fmtTime(shift.start_ts)} · <strong>{hm(cur.elapsed_min)}</strong> {recorded ? "long" : "in"}
          </>
        }
        right={
          <>
            <Badge mode={shift.data_mode} note={simulated} />
            <button disabled={cur.replay_running} onClick={() => nurseApi<Proposal>(`/shifts/${shift.shift_id}/propose`, {}).then(setProposal, (e) => setError(e.message))}>
              {cur.replay_running ? "Playing the recorded day…" : recorded ? "Review and finish" : "End shift"} <ArrowRight size={16} />
            </button>
          </>
        }
      />

      <div className="split">
        <div>
          <section className="panel hero-chart">
            <div className="head">
              <div>
                <div className="sub" style={{ fontWeight: 700 }}>{recorded ? "Physical load at the end" : "Physical load right now"}</div>
                <div className="kpi">
                  {nowLoad === null ? "—" : nowLoad.toFixed(0)}
                  <small>% effort</small>
                </div>
              </div>
              <div className="chart-legend">
                <span>
                  <i style={{ background: "var(--teal-bright)" }} />
                  Load
                </span>
                <span>
                  <i style={{ background: "var(--stress)" }} />
                  Stress
                </span>
                <span>
                  <i style={{ background: "var(--sleep)" }} />
                  Break
                </span>
              </div>
            </div>
            <ShiftChart windows={cur.windows} breaks={cur.suggested_breaks} startIso={shift.start_ts} focus={active?.span ?? null} />
          </section>

          {lines.length > 0 && (
            <div className="moments">
              {lines.map((l) => (
                <button key={l.key} className={active?.key === l.key ? "on" : ""} aria-pressed={active?.key === l.key} onClick={() => setPicked(picked === l.key ? null : l.key)}>
                  <i style={{ background: l.dot }} />
                  {l.text}
                </button>
              ))}
            </div>
          )}

          <div className="grid-4">
            <div className="metric">
              <div className="name">
                <i style={{ background: "var(--teal-bright)" }} />
                Average load
              </div>
              <div className="val">
                {m.mean_pct_hrr === null ? "—" : m.mean_pct_hrr.toFixed(0)}
                <small>%</small>
              </div>
              <div className="meter">
                <b style={{ background: "var(--teal-bright)", transform: `scaleX(${Math.min((m.mean_pct_hrr ?? 0) / 60, 1)})` }} />
              </div>
            </div>
            <div className="metric">
              <div className="name">
                <i style={{ background: "var(--stress)" }} />
                Stress
              </div>
              <div className="val">
                {m.unexplained_hr_min}
                <small>min</small>
              </div>
              <div className="meter">
                <b style={{ background: "var(--stress)", transform: `scaleX(${Math.min(m.unexplained_hr_min / 60, 1)})` }} />
              </div>
            </div>
            <div className="metric">
              <div className="name">
                <i style={{ background: "var(--sleep)" }} />
                Sleep before
              </div>
              {cur.sleep_before_min === null ? (
                <div className="val quiet">No sleep data</div>
              ) : (
                <div className="val">
                  {Math.floor(cur.sleep_before_min / 60)}
                  <small>h</small> {cur.sleep_before_min % 60}
                  <small>min</small>
                </div>
              )}
              <div className="meter">
                <b style={{ background: "var(--sleep)", transform: `scaleX(${Math.min((cur.sleep_before_min ?? 0) / 480, 1)})` }} />
              </div>
            </div>
            <div className="metric">
              <div className="name">
                <i style={{ background: "var(--muted)" }} />
                Recorded
              </div>
              <div className="val">
                {m.coverage_pct.toFixed(0)}
                <small>%</small>
              </div>
              <div className="meter">
                <b style={{ background: m.coverage_pct < 70 ? "var(--warning)" : "var(--muted)", transform: `scaleX(${m.coverage_pct / 100})` }} />
              </div>
            </div>
          </div>
          <ErrorLine error={error} />
        </div>

        <aside>
          <section className="panel ring-card">
            <div className="sub" style={{ fontWeight: 700 }}>{recorded ? "From your last break to the end" : "Since your last break"}</div>
            <Ring fraction={since / 300} color={breakColor}>
              <b>{since >= 60 ? `${Math.floor(since / 60)}h ${since % 60}m` : `${since}m`}</b>
              <span className="muted">of 5 hours</span>
            </Ring>
            <h2 style={{ color: since >= 300 ? "var(--critical)" : undefined }}>{breakWord}</h2>
          </section>

          {!recorded && (
          <section className="panel relief-card">
            {cur.relief_pending ? (
              <>
                <h2>Help is on the way</h2>
                <p>Your {recipientLabel(me.relief_recipient).toLowerCase()} has been told. They see your name only.</p>
              </>
            ) : (
              <>
                <h2>Need a break?</h2>
                <p>Your {recipientLabel(me.relief_recipient).toLowerCase()} sees your name only.</p>
                <button className="big" onClick={requestRelief}>
                  Request relief <ArrowRight size={18} />
                </button>
              </>
            )}
          </section>
          )}
        </aside>
      </div>
    </>
  );
}

type Line = { key: string; text: string; dot: string; span: Span | null };

// One to four plain sentences about what stood out; each can light up its stretch of the chart.
function highlightLines(cur: Current, startIso: string): Line[] {
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
  const lines: Line[] = [];
  const heavy = longest((w) => (w.pct_hrr ?? 0) >= 30);
  if (heavy && heavy[1] - heavy[0] >= 10)
    lines.push({ key: "load", text: `Heart working hard at ${at(heavy[0])}`, dot: "var(--teal-bright)", span: { from: heavy[0], to: heavy[1], color: "var(--hl-load)" } });
  const stress = longest((w) => !!w.unexplained);
  if (stress) lines.push({ key: "stress", text: `Stress was high at ${at(stress[0])}`, dot: "var(--stress)", span: { from: stress[0], to: stress[1], color: "var(--hl-stress)" } });
  if (cur.sleep_before_min !== null && cur.sleep_before_min < 360)
    lines.push({ key: "sleep", text: `You slept ${hm(cur.sleep_before_min)} before this shift`, dot: "var(--sleep)", span: null });
  if (cur.since_break_min >= 300)
    lines.push({ key: "break", text: `No break for ${hm(cur.since_break_min)}`, dot: "var(--critical)", span: { from: cur.elapsed_min - cur.since_break_min, to: cur.elapsed_min, color: "var(--hl-alert)" } });
  return lines;
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
    <div style={{ maxWidth: 720 }}>
      <PageHeading title="Finish your shift" />
      <Panel>
        <div className="steps">
          {["Confirm breaks", "Ratio", "How you feel"].map((s, i) => (
            <span key={s} className={i === step ? "on" : ""}>
              {i + 1} · {s}
            </span>
          ))}
        </div>
        <div className="stack" key={step}>
          {step === 0 && (
            <>
              <h2>{proposal.breaks.length ? "Were these your breaks?" : "We didn’t see any breaks"}</h2>
              {proposal.breaks.map((b) => (
                <div key={b.id} className="stack" style={{ paddingBottom: 14, borderBottom: "1px solid var(--rule)" }}>
                  <strong style={{ fontSize: 17 }}>
                    {fmtTime(b.start_ts)} – {fmtTime(b.end_ts)}
                  </strong>
                  <div className="yesno" role="radiogroup">
                    <button className={answers[b.id] === "confirmed" ? "yes-on" : ""} onClick={() => setAnswers({ ...answers, [b.id]: "confirmed" })}>
                      Yes, I took a break
                    </button>
                    <button className={answers[b.id] === "rejected" ? "no-on" : ""} onClick={() => setAnswers({ ...answers, [b.id]: "rejected" })}>
                      No
                    </button>
                  </div>
                </div>
              ))}
              <button className="primary big" onClick={() => setStep(1)}>
                Confirm breaks <ArrowRight size={18} />
              </button>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <button className="link" onClick={cancel}>
                  Back to shift
                </button>
                <button className="link" onClick={() => submit(true)}>
                  Skip all questions
                </button>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h2>Was the nurse-to-patient ratio met?</h2>
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
            </>
          )}
          {step === 2 && (
            <>
              <h2>How drained do you feel?</h2>
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
            </>
          )}
        </div>
      </Panel>
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
    <div>
      <Panel>
        <div className="verdict">
          <span className={`swatch dot ${card.band}`} style={card.band === "insufficient" ? undefined : { background: BAND_COLOR[card.band] }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2>{title}</h2>
            <p className="sub" style={{ margin: "4px 0 0" }}>
              {reasons.length ? `Why: ${reasons.join(" and ")}.` : text}
            </p>
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <span className="muted">
            {fmtDay(card.start_ts)} · {fmtTime(card.start_ts)}–{fmtTime(card.end_ts)}
          </span>
          <Badge mode={card.data_mode} note={card.data_mode === "replay" ? "simulated" : undefined} />
        </div>
      </Panel>
      <div className="list">
        <div>
          <span className="grow">
            <strong>Breaks</strong>
            <div className="sub">
              Longest stretch without one: {hm(card.longest_no_break_min)} · {card.breaks_uncertain ? "not confirmed" : `${card.n_breaks_confirmed} confirmed`}
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
            <strong>Recorded</strong>
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
    <section className="report-card">
      <h2 style={{ color: "var(--critical)", marginBottom: 6 }}>Workload report</h2>
      <p className="sub">Attach this to a workload report. Nothing is sent for you.</p>
      <pre className="report">{text}</pre>
      <div className="row">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(text);
            setCopied(true);
          }}
        >
          <Copy size={16} /> {copied ? "Copied" : "Copy text"}
        </button>
        <button className="primary" disabled={sent} onClick={() => nurseApi(`/me/reports/${shiftId}/sent`, {}).then(() => setSent(true), (e) => setError(e.message))}>
          <Send size={16} /> {sent ? "Counted — thank you" : "I sent this report"}
        </button>
      </div>
      <ErrorLine error={error} />
    </section>
  );
}

// ---------------------------------------------------------------- history

export function History() {
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
      <div style={{ maxWidth: 720 }}>
        <button className="link" onClick={() => setOpenCard(null)} style={{ marginBottom: 14 }}>
          <ArrowLeft size={16} /> My shifts
        </button>
        <ShiftCard card={openCard} />
      </div>
    );
  const shown = redOnly ? shifts.filter((s) => s.band === "red") : shifts;
  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeading
       
        title="My shifts"
        right={
          <div className="pills">
            <button className={redOnly ? "" : "on"} onClick={() => setRedOnly(false)}>
              All ({shifts.length})
            </button>
            <button className={redOnly ? "on" : ""} onClick={() => setRedOnly(true)}>
              Red ({shifts.filter((s) => s.band === "red").length})
            </button>
          </div>
        }
      />
      {shown.length === 0 ? (
        <Panel className="empty">
          <h2>No shifts yet</h2>
          <p className="sub" style={{ margin: "6px auto 0" }}>Finished shifts appear here with their colour.</p>
        </Panel>
      ) : (
        <div className="list">
          {shown.map((s) => (
            <button key={s.shift_id} onClick={() => setOpenCard(s)}>
              <span className="grow">
                <strong>{fmtDay(s.start_ts)}</strong>
                <div className="sub">{s.shift_type === "day" ? "Day shift" : "Night shift"}</div>
              </span>
              <BandChip band={s.band} />
              <span className="chev">
                <ChevronRight size={18} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------- settings

export function Settings({ me, reload }: { me: Me; reload: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const save = (body: object) => nurseApi("/me/settings", body).then(reload, (e) => setError(e.message));
  const paused = !!me.paused_until && new Date(me.paused_until) > new Date();
  return (
    <>
      <PageHeading title="Settings & privacy" sub={`${me.display_name} · ${me.unit_name}`} />
      <div className="grid-2">
        <div>
          <Panel title="Shift recording">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="sub">{paused ? `Paused until ${fmtDay(me.paused_until!)}` : "Recording your shifts"}</span>
              <Toggle value={!paused} label="Shift recording" onChange={() => save({ pause_days: paused ? 0 : 1 })} />
            </div>
            {!paused && (
              <div className="row" style={{ marginTop: 12 }}>
                <button onClick={() => save({ pause_days: 7 })}>Pause for 7 days</button>
              </div>
            )}
          </Panel>
          <Panel title="Relief requests">
            <div className="stack">
              <div className="pills">
                {RECIPIENTS.map(([k, label]) => (
                  <button key={k} className={me.relief_recipient === k ? "on" : ""} onClick={() => save({ relief_recipient: k })}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="sub">Ask automatically after 5 hours without a break</span>
                <Toggle value={me.auto_relief} label="Automatic relief requests" onChange={() => save({ auto_relief: !me.auto_relief })} />
              </div>
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Your data">
            <ul className="stack" style={{ paddingLeft: 18, margin: 0 }}>
              <li>A trustee holds your data — not the hospital.</li>
              <li>Managers see weekly unit totals only, for groups of five or more.</li>
              <li>Raw heart-rate and sleep data is deleted when a shift ends.</li>
              <li>Watch-off time never counts as a break.</li>
              <li>No AI model sees your data.</li>
            </ul>
            <div className="notice">
              <ShieldCheck size={18} /> {me.purpose_limit}
            </div>
          </Panel>
          <More title="Withdraw and delete my data">
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
                Withdraw and delete
              </button>
            )}
          </More>
        </div>
      </div>
      <ErrorLine error={error} />
    </>
  );
}
