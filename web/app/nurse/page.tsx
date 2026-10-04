"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Break, LiveChart, Win } from "@/components/LiveChart";
import { BandChip, ErrorLine, Mode, Panel, useRole } from "@/components/ui";
import { fmtDay, fmtTime, hm, nurseApi } from "@/lib/api";

type Me = {
  display_name: string;
  unit_name: string;
  onboarded: boolean;
  birth_year: number | null;
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
  drained_rating: number | null;
};

type Proposal = { end_ts: string; breaks: { id: string; start_ts: string; end_ts: string }[] };

const RECIPIENTS = [
  ["charge", "Charge nurse"],
  ["buddy", "Break buddy"],
  ["float", "Float nurse"],
] as const;

const recipientLabel = (v: string) => RECIPIENTS.find(([k]) => k === v)?.[1] ?? v;

export default function NursePage() {
  const session = useRole("nurse");
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<"shift" | "history" | "settings" | "privacy">("shift");
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
      <h1>{me.display_name}</h1>
      <p className="sub">
        {me.unit_name} · baseline: {me.baseline_status}
      </p>
      <div className="tabs">
        {(["shift", "history", "settings", "privacy"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {{ shift: "Shift", history: "History", settings: "Settings", privacy: "Privacy" }[t]}
          </button>
        ))}
      </div>
      {tab === "shift" && <ShiftTab me={me} />}
      {tab === "history" && <History />}
      {tab === "settings" && <Settings me={me} reload={loadMe} />}
      {tab === "privacy" && <Privacy me={me} />}
    </main>
  );
}

// ------------------------------------------------------------- onboarding

function Onboarding({ me, done }: { me: Me; done: () => void }) {
  const [consent, setConsent] = useState(false);
  const [birthYear, setBirthYear] = useState("");
  const [pattern, setPattern] = useState("day");
  const [recipient, setRecipient] = useState("charge");
  const [error, setError] = useState<string | null>(null);
  const year = Number(birthYear);
  const valid = consent && year >= 1940 && year <= 2010;

  return (
    <main className="narrow">
      <h1>Welcome, {me.display_name}</h1>
      <p className="sub">{me.unit_name}</p>
      <Panel title="Before you opt in">
        <div className="stack">
          <p>
            ShiftLoad records heart rate and steps during your shifts and turns them into a workload record:
            physical load and how long you went without a break. It does not diagnose anything.
          </p>
          <p className="note">{me.purpose_limit}</p>
          <p className="sub">
            Your manager never sees your data — only weekly unit totals from groups of five or more nurses. Raw
            heart-rate data is deleted when each shift is finalized. You can pause or withdraw at any time.
          </p>
          <label className="row">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I understand and want to opt in.</span>
          </label>
        </div>
      </Panel>
      <Panel title="About you">
        <div className="stack">
          <label className="field">
            Birth year (used to estimate maximum heart rate)
            <input type="number" inputMode="numeric" placeholder="e.g. 1994" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
          </label>
          <label className="field">
            Usual rotation (sets default shift times)
            <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
              <option value="day">Days, 07:00–19:00</option>
              <option value="night">Nights, 19:00–07:00</option>
              <option value="rotating">Rotating days and nights</option>
            </select>
          </label>
          <label className="field">
            Who should get your relief requests?
            <select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              {RECIPIENTS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            The phone app that reads Health Connect and imports your last 30 days is not built yet. Until then your
            resting heart rate comes from your first recording and your baseline stays provisional.
          </p>
          <ErrorLine error={error} />
          <button
            className="primary big"
            disabled={!valid}
            onClick={() =>
              nurseApi("/onboarding", {
                birth_year: year,
                rotation: { pattern, start_hour: pattern === "night" ? 19 : 7 },
                relief_recipient: recipient,
              }).then(done, (e) => setError(e.message))
            }
          >
            Opt in
          </button>
        </div>
      </Panel>
    </main>
  );
}

// ------------------------------------------------------------------ shift

function ShiftTab({ me }: { me: Me }) {
  const [cur, setCur] = useState<Current | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipient, setRecipient] = useState(me.relief_recipient);
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
    nurseApi("/relief", { recipient_type: recipient }).then(refresh, (e) => setError(e.message));
  }, [recipient, refresh]);

  // pre-enabled auto-request: sent once per shift when the nudge fires
  useEffect(() => {
    if (me.auto_relief && cur?.nudge && shift && autoSent.current !== shift.shift_id) {
      autoSent.current = shift.shift_id;
      requestRelief();
    }
  }, [me.auto_relief, cur?.nudge, shift, requestRelief]);

  if (!cur) return <ErrorLine error={error} />;

  if (!shift) {
    return (
      <>
        {card && <ShiftCard card={card} />}
        <Panel title="No shift running">
          <div className="stack">
            <p className="sub">
              Shifts normally start by themselves from your rotation once the phone app is connected. For now you
              can replay a recorded day through the same pipeline.
            </p>
            <button
              className="primary big"
              onClick={() => {
                setCard(null);
                setError(null);
                nurseApi("/replay/start", { speed: 8 }).then(refresh, (e) => setError(e.message));
              }}
            >
              Replay a recorded day
            </button>
            <button
              onClick={() => {
                setCard(null);
                setError(null);
                nurseApi("/replay/start", { speed: 60 }).then(refresh, (e) => setError(e.message));
              }}
            >
              Replay fast (about 12 seconds)
            </button>
            <p className="muted">
              The recorded day is a simulated recording, not real watch data: brisk walks, still periods, two breaks,
              a block of lifting with no steps, and 40 minutes with the watch off.
            </p>
            <ErrorLine error={error} />
          </div>
        </Panel>
      </>
    );
  }

  if (proposal) {
    return (
      <EndPrompt
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
  return (
    <>
      {cur.nudge && (
        <div className="banner">
          <strong>{hm(cur.since_break_min)} without a break.</strong> You can ask for relief below.
        </div>
      )}
      <Panel
        title={`${shift.shift_type === "day" ? "Day" : "Night"} shift · started ${fmtTime(shift.start_ts)}`}
        mode={shift.data_mode}
        modeNote={shift.data_mode === "replay" ? "simulated recording" : undefined}
      >
        <p className="sub">
          {hm(cur.elapsed_min)} in{cur.replay_running ? " · replay running" : ""}
        </p>
        <div className="tiles">
          <div className="tile">
            <div className="label">Physical load so far</div>
            <div className="value">
              {m.mean_pct_hrr === null ? "—" : m.mean_pct_hrr.toFixed(0)}
              <span className="unit">% reserve</span>
            </div>
            <BandChip band={cur.phys_band_so_far} />
          </div>
          <div className="tile">
            <div className="label">Since last break</div>
            <div className="value">{hm(cur.since_break_min)}</div>
          </div>
          <div className="tile">
            <div className="label">Stress indicator</div>
            <div className="value">
              {m.unexplained_hr_min}
              <span className="unit"> min</span>
            </div>
          </div>
          <div className="tile">
            <div className="label">Recording coverage</div>
            <div className="value">
              {m.coverage_pct.toFixed(0)}
              <span className="unit">%</span>
            </div>
          </div>
        </div>
        <h3>Physical load (% of heart-rate reserve)</h3>
        <LiveChart windows={cur.windows} breaks={cur.suggested_breaks} startIso={shift.start_ts} elapsed={cur.elapsed_min} />
        <p className="note" style={{ marginTop: 10 }}>
          Stress indicator: minutes when your heart rate was well above what your steps would predict while you
          were still. A high heart rate while stationary points to a stressful situation. Hard physical effort
          without steps counts as physical load instead. This is not a diagnosis and it does not set the band.
        </p>
        <p className="muted">
          Expected-heart-rate model: {cur.model.name}
          {cur.model.trained ? "" : " (not trained yet)"} · baseline: {cur.baseline_status} · resting HR{" "}
          {cur.hr_rest.toFixed(0)} bpm
        </p>
      </Panel>

      <Panel title="Relief">
        {cur.relief_pending ? (
          <p>
            <strong>Relief requested.</strong> Your {recipientLabel(recipient).toLowerCase()} sees “Relief requested —{" "}
            {me.display_name}” and nothing else. It disappears when they mark it handled.
          </p>
        ) : (
          <div className="stack">
            <label className="field">
              Send to
              <select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
                {RECIPIENTS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary big" onClick={requestRelief}>
              Request relief
            </button>
          </div>
        )}
      </Panel>

      <ErrorLine error={error} />
      <button
        className="big"
        disabled={cur.replay_running}
        onClick={() => nurseApi<Proposal>(`/shifts/${shift.shift_id}/propose`, {}).then(setProposal, (e) => setError(e.message))}
      >
        {cur.replay_running ? "Replay still running…" : "End shift"}
      </button>
    </>
  );
}

function EndPrompt({ shiftId, proposal, cancel, done }: { shiftId: string; proposal: Proposal; cancel: () => void; done: (c: Card) => void }) {
  const [answers, setAnswers] = useState<Record<string, "confirmed" | "rejected">>(() =>
    Object.fromEntries(proposal.breaks.map((b) => [b.id, "confirmed" as const])),
  );
  const [ratio, setRatio] = useState("unknown");
  const [drained, setDrained] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = (skipped: boolean) =>
    nurseApi<Card>(`/shifts/${shiftId}/end`, {
      breaks: skipped ? [] : Object.entries(answers).map(([id, status]) => ({ id, status })),
      skipped,
      ratio_status: ratio,
      drained_rating: drained,
    }).then(done, (e) => setError(e.message));

  return (
    <Panel title="End of shift">
      <div className="stack">
        <h3>
          {proposal.breaks.length
            ? `We think you had breaks at ${proposal.breaks.map((b) => fmtTime(b.start_ts)).join(" and ")} — correct?`
            : "We did not see any breaks. Time with the watch off is never counted as a break."}
        </h3>
        {proposal.breaks.map((b) => (
          <div className="row" key={b.id}>
            <span style={{ flex: 1 }}>
              {fmtTime(b.start_ts)}–{fmtTime(b.end_ts)}
            </span>
            {(["confirmed", "rejected"] as const).map((s) => (
              <button key={s} className={answers[b.id] === s ? "pressed" : ""} onClick={() => setAnswers({ ...answers, [b.id]: s })}>
                {s === "confirmed" ? "Yes, a break" : "Not a break"}
              </button>
            ))}
          </div>
        ))}
        <h3>Was the nurse-to-patient ratio met?</h3>
        <div className="row">
          {[
            ["met", "Met"],
            ["not_met", "Not met"],
            ["unknown", "Don’t know"],
          ].map(([k, label]) => (
            <button key={k} className={ratio === k ? "pressed" : ""} onClick={() => setRatio(k)}>
              {label}
            </button>
          ))}
        </div>
        <h3>How drained do you feel? (optional)</h3>
        <div className="row">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button key={n} className={drained === n ? "pressed" : ""} style={{ padding: "6px 10px" }} onClick={() => setDrained(drained === n ? null : n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="muted">The rating is used to check the bands against how shifts feel. It never changes your band.</p>
        <ErrorLine error={error} />
        <button className="primary big" onClick={() => submit(false)}>
          Finish shift
        </button>
        <div className="row">
          <button className="link" onClick={() => submit(true)}>
            Skip the break questions
          </button>
          <span className="spacer" style={{ flex: 1 }} />
          <button className="link" onClick={cancel}>
            Back to shift
          </button>
        </div>
      </div>
    </Panel>
  );
}

function ShiftCard({ card }: { card: Card }) {
  return (
    <>
      <Panel
        title={`${fmtDay(card.start_ts)} · ${fmtTime(card.start_ts)}–${fmtTime(card.end_ts)}`}
        mode={card.data_mode}
        modeNote={card.data_mode === "replay" ? "simulated recording" : undefined}
      >
        <div className="row" style={{ marginBottom: 12 }}>
          <BandChip band={card.band} big />
          <span className="sub">shift band = the worse of the two below</span>
        </div>
        <table>
          <tbody>
            <tr>
              <th>Physical load</th>
              <td>
                <BandChip band={card.phys_band} />
              </td>
              <td>
                mean {card.mean_pct_hrr === null ? "—" : `${card.mean_pct_hrr}%`} of heart-rate reserve ·{" "}
                {card.min_above_30_hrr} min at 30% or more
              </td>
            </tr>
            <tr>
              <th>Recovery opportunity</th>
              <td>
                <BandChip band={card.recovery_band} />
              </td>
              <td>
                longest stretch without a break {hm(card.longest_no_break_min)} ·{" "}
                {card.breaks_uncertain ? "breaks not confirmed" : `${card.n_breaks_confirmed} breaks confirmed`}
                {card.recovery_provisional ? " · amber threshold provisional" : ""}
              </td>
            </tr>
            <tr>
              <th>Coverage</th>
              <td colSpan={2}>
                {card.coverage_pct}% of the shift recorded · longest gap {card.max_gap_min} min
              </td>
            </tr>
            <tr>
              <th>Context</th>
              <td colSpan={2}>
                {card.time_on_feet_min} min on feet · {card.unexplained_hr_min} min on the stress indicator (does not set
                the band)
              </td>
            </tr>
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 10 }}>
          Raw heart-rate and step data for this shift has been deleted. Only this card is kept.
        </p>
      </Panel>
      {card.band === "red" && <ReportDraft shiftId={card.shift_id} />}
    </>
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
    <Panel title="Workload report draft">
      <p className="sub">
        This shift was red. Below is a record you can attach to a Professional Responsibility Process form. Nothing
        is sent in your name — you decide.
      </p>
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
        <button
          className="primary"
          disabled={sent}
          onClick={() => nurseApi(`/me/reports/${shiftId}/sent`, {}).then(() => setSent(true), (e) => setError(e.message))}
        >
          {sent ? "Counted — thank you" : "I sent this report"}
        </button>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        “I sent this report” adds one to your unit’s weekly count of reports. It is not linked to you.
      </p>
      <ErrorLine error={error} />
    </Panel>
  );
}

// ---------------------------------------------------------------- history

function History() {
  const [shifts, setShifts] = useState<Card[] | null>(null);
  const [redOnly, setRedOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    nurseApi<Card[]>("/me/shifts").then(setShifts, (e) => setError(e.message));
  }, []);
  if (!shifts) return <ErrorLine error={error} />;
  const shown = redOnly ? shifts.filter((s) => s.band === "red") : shifts;
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className={redOnly ? "" : "pressed"} onClick={() => setRedOnly(false)}>
          All shifts ({shifts.length})
        </button>
        <button className={redOnly ? "pressed" : ""} onClick={() => setRedOnly(true)}>
          Red shifts ({shifts.filter((s) => s.band === "red").length})
        </button>
      </div>
      {shown.length === 0 && <p className="sub">No shifts here yet.</p>}
      {shown.map((s) =>
        open === s.shift_id ? (
          <ShiftCard key={s.shift_id} card={s} />
        ) : (
          <button key={s.shift_id} className="relief-item" style={{ width: "100%", textAlign: "left" }} onClick={() => setOpen(s.shift_id)}>
            <span style={{ flex: 1 }}>
              {fmtDay(s.start_ts)} · {s.shift_type}
            </span>
            <BandChip band={s.band} />
          </button>
        ),
      )}
      <p className="muted">A finished shift cannot be deleted on its own. You can pause recording or withdraw in Settings.</p>
    </>
  );
}

// --------------------------------------------------------------- settings

function Settings({ me, reload }: { me: Me; reload: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const save = (body: object) => nurseApi("/me/settings", body).then(reload, (e) => setError(e.message));
  const paused = me.paused_until && new Date(me.paused_until) > new Date();
  return (
    <>
      <Panel title="Relief requests">
        <div className="stack">
          <label className="field">
            Default recipient
            <select value={me.relief_recipient} onChange={(e) => save({ relief_recipient: e.target.value })}>
              {RECIPIENTS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="row">
            <input type="checkbox" checked={me.auto_relief} onChange={(e) => save({ auto_relief: e.target.checked })} />
            <span>Send a relief request automatically after five hours without a break</span>
          </label>
        </div>
      </Panel>
      <Panel title="Pause recording">
        <p className="sub">
          {paused ? `Paused until ${fmtDay(me.paused_until!)}.` : "Recording is on. Pause before a shift if you don’t want it recorded."}
        </p>
        <div className="row">
          <button onClick={() => save({ pause_days: 1 })}>Pause 1 day</button>
          <button onClick={() => save({ pause_days: 7 })}>Pause 7 days</button>
          {paused && <button onClick={() => save({ pause_days: 0 })}>Resume</button>}
        </div>
      </Panel>
      <Panel title="Withdraw">
        <p className="sub">Deletes every shift and setting held about you. This cannot be undone.</p>
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
      </Panel>
      <ErrorLine error={error} />
    </>
  );
}

function Privacy({ me }: { me: Me }) {
  return (
    <Panel title="What happens to your data">
      <ul className="stack" style={{ paddingLeft: 18, margin: 0 }}>
        <li>A trustee holds the database — not the health authority. The hospital has no login to it.</li>
        <li>Managers see weekly unit totals only, from groups of five or more nurses, rounded and with noise added. Never names, never single shifts, never daily data.</li>
        <li>Raw heart-rate and step data is deleted when a shift is finalized. Only the shift card is kept.</li>
        <li>Missing data is never shown as green, and time with the watch off never counts as a break.</li>
        <li>A relief request shows only your name to the person you choose, and is deleted when handled.</li>
        <li>Every manager and committee query is written to an access log the joint committee can read.</li>
        <li>No AI model sees your data. Your screens are written from templates.</li>
        <li>{me.purpose_limit}</li>
      </ul>
    </Panel>
  );
}
