"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BandChip, ErrorLine, More, Panel, useRole } from "@/components/ui";
import { Cell, STATUS_TEXT, WeeklyReport, redRange } from "@/components/WeeklyReport";
import { addWeeks, fmtWeek, managerApi } from "@/lib/api";

export type Meta = {
  units: { unit_id: string; name: string; hospital: string }[];
  weeks: string[];
  scenarios: number[];
  default_scenario: number;
  purpose_limit: string;
};

type Flag = { unit_id: string; week_start: string; shift_type: string; metric: string; direction: string; ratio_rounded: string; label: string };

const MEASURES = [
  { key: "pct_red_high", label: "Red shifts", help: "Share of shifts rated overloaded", goodDown: true },
  { key: "pct_no_break_5h", label: "5 hours, no break", help: "Share of shifts with 5+ hours without a break", goodDown: true },
  { key: "pct_ratio_met_and_breaks", label: "Ratio met + breaks", help: "Share of shifts with ratio met and breaks taken", goodDown: false },
  { key: "pct_insufficient", label: "Unknown", help: "Share of shifts with too little data to rate", goodDown: true },
] as const;
type MeasureKey = (typeof MEASURES)[number]["key"];

const HIDDEN_SHORT: Record<string, string> = {
  suppressed_k: "Too few nurses",
  suppressed_membership: "Group changed",
  not_representative: "Low participation",
  quality_gate: "Low coverage",
};

const step = (v: number) => (v <= 10 ? 1 : v <= 30 ? 2 : v <= 50 ? 3 : v <= 70 ? 4 : 5);
const show = (c: Cell, m: MeasureKey) => (m === "pct_red_high" ? redRange(c) : `${c[m]}%`);

export default function ManagerPage() {
  const session = useRole("manager");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [scenario, setScenario] = useState(60);
  const [cells, setCells] = useState<Cell[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [measure, setMeasure] = useState<MeasureKey>("pct_red_high");
  const [unit, setUnit] = useState("");
  const [week, setWeek] = useState("");
  const [allUnits, setAllUnits] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    managerApi<Meta>("/meta").then((m) => {
      setMeta(m);
      setScenario(m.default_scenario);
      setUnit(m.units[0]?.unit_id ?? "");
      setWeek(m.weeks[m.weeks.length - 1] ?? "");
    }, (e) => setError(e.message));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      managerApi<Cell[]>(`/manager/weekly?scenario=${scenario}`),
      managerApi<Flag[]>(`/manager/flags?scenario=${scenario}`),
    ]).then(([c, f]) => {
      setCells(c);
      setFlags(f);
    }, (e) => setError(e.message));
  }, [session, scenario]);

  const byKey = useMemo(() => new Map(cells.map((c) => [`${c.unit_id}|${c.week_start}|${c.shift_type}`, c])), [cells]);

  if (!session) return <main />;
  if (!meta) return <main><ErrorLine error={error} /></main>;
  if (!meta.weeks.length)
    return (
      <main>
        <h1>Unit workload</h1>
        <p className="sub">Nothing has been published yet. The trustee publishes the weekly numbers.</p>
      </main>
    );

  const wi = meta.weeks.indexOf(week);
  const unitName = meta.units.find((u) => u.unit_id === unit)?.name ?? unit;
  const unitFlags = flags.filter((f) => f.unit_id === unit);
  const weekFlags = unitFlags.filter((f) => f.week_start === week);
  const m = MEASURES.find((x) => x.key === measure)!;

  return (
    <main>
      <div className="row">
        <h1 style={{ flex: 1 }}>Unit workload</h1>
        <span className="badge">SYNTHETIC DATA</span>
      </div>
      <p className="sub">Weekly totals. No names.</p>
      <ErrorLine error={error} />

      <div className="row" style={{ margin: "16px 0 14px" }}>
        <div className="pills" style={{ flex: 1 }}>
          {meta.units.map((u) => (
            <button key={u.unit_id} className={u.unit_id === unit ? "on" : ""} onClick={() => setUnit(u.unit_id)}>
              {u.name}
            </button>
          ))}
        </div>
        <div className="stepper">
          <button disabled={wi <= 0} onClick={() => setWeek(meta.weeks[wi - 1])} aria-label="Previous week">
            ‹
          </button>
          <span>Week of {fmtWeek(week)}</span>
          <button disabled={wi >= meta.weeks.length - 1} onClick={() => setWeek(meta.weeks[wi + 1])} aria-label="Next week">
            ›
          </button>
        </div>
      </div>

      <Panel>
        <WeeklyReport unit={unit} week={week} scenario={scenario} />
        {weekFlags.length > 0 && (
          <div className="stack" style={{ marginTop: 12 }}>
            {weekFlags.map((f) => (
              <div key={f.shift_type + f.metric} className="row">
                <span className="legend" style={{ margin: 0 }}>
                  <span className="flagdot" />
                </span>
                <span>
                  <strong>Unusual on {f.shift_type === "day" ? "days" : "nights"}:</strong> {f.label} — {f.ratio_rounded}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid-4">
        {MEASURES.map((ms) => (
          <button key={ms.key} className={`metric ${measure === ms.key ? "on" : ""}`} onClick={() => setMeasure(ms.key)} title={ms.help}>
            <div className="kicker">{ms.label}</div>
            {(["day", "night"] as const).map((s) => {
              const c = byKey.get(`${unit}|${week}|${s}`);
              const p = byKey.get(`${unit}|${addWeeks(week, -1)}|${s}`);
              const ok = c?.status === "released";
              const delta = ok && p?.status === "released" ? (c[ms.key] as number) - (p[ms.key] as number) : null;
              return (
                <div key={s} style={{ marginTop: 8 }}>
                  <div className="muted">{s === "day" ? "Days" : "Nights"}</div>
                  <div className="value" style={{ fontSize: ok ? 26 : 16, color: ok ? undefined : "var(--muted)" }}>
                    {ok ? show(c, ms.key) : c ? HIDDEN_SHORT[c.status] : "No shifts"}
                  </div>
                  {delta !== null && delta !== 0 && (
                    <div className="muted">
                      <span className={delta > 0 ? "arrow-up" : "arrow-down"}>{Math.abs(delta)} points</span> vs last week
                    </div>
                  )}
                </div>
              );
            })}
          </button>
        ))}
      </div>

      <div className="section-title">{m.label} — last {meta.weeks.length} weeks</div>
      <Panel>
        <div className="pills" style={{ marginBottom: 12 }}>
          <button className={allUnits ? "" : "on"} style={{ background: allUnits ? "var(--wash)" : undefined }} onClick={() => setAllUnits(false)}>
            {unitName}
          </button>
          <button className={allUnits ? "on" : ""} style={{ background: allUnits ? undefined : "var(--wash)" }} onClick={() => setAllUnits(true)}>
            All units
          </button>
        </div>
        <Heatmap
          meta={meta}
          units={allUnits ? meta.units : meta.units.filter((u) => u.unit_id === unit)}
          byKey={byKey}
          flags={flags}
          measure={measure}
          sel={{ unit, week }}
          onSelect={(u, w) => {
            setUnit(u);
            setWeek(w);
          }}
        />
        <div className="legend">
          <span>{m.help}:</span>
          {["0–10%", "20–30%", "40–50%", "60–70%", "80–100%"].map((label, i) => (
            <span key={label}>
              <span className="sw" style={{ background: `var(--seq-${i + 1})` }} />
              {label}
            </span>
          ))}
          <span>
            <span className="flagdot" />
            unusual week
          </span>
        </div>
      </Panel>
      <More title="Why are some weeks striped?">
        <p className="sub">They are held back to protect nurses, or the data is too thin.</p>
        <ul style={{ margin: 0, paddingLeft: 18 }} className="stack">
          <li><strong>Too few nurses</strong> — fewer than five contributed.</li>
          <li><strong>Group changed</strong> — the group changed by one to four people since last week.</li>
          <li><strong>Low participation</strong> — under 40% of the roster took part.</li>
          <li><strong>Low coverage</strong> — under 50% of shift time was recorded.</li>
        </ul>
      </More>

      <div className="section-title">Compare</div>
      <Compare meta={meta} unit={unit} scenario={scenario} />

      <div className="section-title">More</div>
      <More title={`Unusual weeks for ${unitName} (${unitFlags.length})`}>
        <FlagList flags={unitFlags} />
      </More>
      <More title="Log an action you took">
        <Actions unit={unit} week={week} />
      </More>
      <More title="Demo: what if fewer nurses took part?">
        <label className="field">
          Participation: {scenario}% of each roster
          <input type="range" min={meta.scenarios[0]} max={meta.scenarios[meta.scenarios.length - 1]} step={10} value={scenario} onChange={(e) => setScenario(Number(e.target.value))} />
        </label>
      </More>
      <More title="How the written summary is kept honest">
        <Guardrail />
      </More>
    </main>
  );
}

// ---------------------------------------------------------------- heatmap

function Heatmap({ meta, units, byKey, flags, measure, sel, onSelect }: {
  meta: Meta;
  units: Meta["units"];
  byKey: Map<string, Cell>;
  flags: Flag[];
  measure: MeasureKey;
  sel: { unit: string; week: string };
  onSelect: (unit: string, week: string) => void;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; key: string; title: string } | null>(null);
  const flagsBy = useMemo(() => {
    const m = new Map<string, Flag[]>();
    for (const f of flags) {
      const k = `${f.unit_id}|${f.week_start}|${f.shift_type}`;
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return m;
  }, [flags]);
  const tipCell = tip ? byKey.get(tip.key) : undefined;

  return (
    <>
      <div className="scroll-x">
        <table className="heat">
          <thead>
            <tr>
              {units.length > 1 && <th />}
              <th />
              {meta.weeks.map((w) => (
                <th key={w} className="week">
                  {fmtWeek(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map((u, ui) =>
              (["day", "night"] as const).map((shift) => {
                const pad = ui && shift === "day" ? { paddingTop: 10 } : undefined;
                return (
                  <tr key={u.unit_id + shift}>
                    {units.length > 1 && shift === "day" && (
                      <th className="unit" rowSpan={2} style={pad}>
                        {u.name}
                      </th>
                    )}
                    <th className="shift" style={pad}>
                      {shift === "day" ? "Days" : "Nights"}
                    </th>
                    {meta.weeks.map((w) => {
                      const key = `${u.unit_id}|${w}|${shift}`;
                      const c = byKey.get(key);
                      const released = c?.status === "released";
                      const selected = sel.unit === u.unit_id && sel.week === w;
                      const title = `${u.name} · ${shift === "day" ? "days" : "nights"} · week of ${fmtWeek(w)}`;
                      const move = (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, key, title });
                      return (
                        <td key={w} style={pad}>
                          <button
                            className={`cell ${released ? `s${step(c[measure] as number)}` : "hidden-cell"}${selected ? " selected" : ""}`}
                            onClick={() => onSelect(u.unit_id, w)}
                            onMouseEnter={move}
                            onMouseMove={move}
                            onMouseLeave={() => setTip(null)}
                            aria-label={title}
                          >
                            {released ? show(c, measure).replace("%", "") : ""}
                            {flagsBy.has(key) && <span className="flag" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      {tip && (
        <div className="tooltip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 280), top: tip.y + 14 }}>
          <b>{tip.title}</b>
          {!tipCell && <div>No shifts recorded.</div>}
          {tipCell && tipCell.status !== "released" && <div>{STATUS_TEXT[tipCell.status]}.</div>}
          {tipCell && tipCell.status === "released" && (
            <>
              <div>Red shifts: {redRange(tipCell)}</div>
              <div>5 hours, no break: {tipCell.pct_no_break_5h}%</div>
              <div>Ratio met + breaks: {tipCell.pct_ratio_met_and_breaks}%</div>
              <div>Unknown: {tipCell.pct_insufficient}%</div>
              <div>Physical load: {tipCell.phys_load_band}</div>
              <div className="muted">
                Coverage {tipCell.coverage_pct}% · participation {tipCell.participation_pct}%
              </div>
            </>
          )}
          {(flagsBy.get(tip.key) ?? []).map((f) => (
            <div key={f.metric}>
              ● {f.label}: {f.ratio_rounded}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FlagList({ flags }: { flags: Flag[] }) {
  if (!flags.length) return <p className="sub">Nothing unusual was flagged for this unit.</p>;
  return (
    <>
      <table>
        <tbody>
          {flags.slice(0, 12).map((f) => (
            <tr key={f.week_start + f.shift_type + f.metric}>
              <td style={{ whiteSpace: "nowrap" }}>
                {fmtWeek(f.week_start)} · {f.shift_type === "day" ? "days" : "nights"}
              </td>
              <td>{f.label[0].toUpperCase() + f.label.slice(1)}</td>
              <td className="num">
                <span className={`arrow-${f.direction}`}>{f.ratio_rounded}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ---------------------------------------------------------------- compare

type Side = { phys_load_band: string | null; cells_expected: number; cells_released: number };
type CompareResult = {
  labels: [string, string];
  scope: string;
  a: Side;
  b: Side;
  rows: { metric: string; label: string; a: number | null; b: number | null; delta: number | null; arrow: string | null }[];
  warnings: { code: string; text: string }[];
  interpretation: string;
};

const ROW_NAME: Record<string, string> = {
  pct_red_low: "Red shifts (lower estimate)",
  pct_red_high: "Red shifts (upper estimate)",
  pct_insufficient: "Unknown",
  pct_no_break_5h: "5 hours, no break",
  pct_ratio_met_and_breaks: "Ratio met + breaks",
  coverage_pct: "Recording coverage",
  participation_pct: "Participation",
};

function Compare({ meta, unit, scenario }: { meta: Meta; unit: string; scenario: number }) {
  const [result, setResult] = useState<CompareResult | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const others = meta.units.filter((u) => u.unit_id !== unit);
  const [other, setOther] = useState(others[0]?.unit_id ?? "");
  const latest = meta.weeks[meta.weeks.length - 1];

  useEffect(() => {
    setResult(null);
    setActive(null);
    if (!others.some((u) => u.unit_id === other)) setOther(others[0]?.unit_id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, scenario]);

  const presets: { key: string; label: string; body: object }[] = [
    { key: "week", label: "This week vs last", body: { compare_by: "period", units: [unit], period_a: { week_start: latest, n_weeks: 1 }, period_b: { week_start: addWeeks(latest, -1), n_weeks: 1 } } },
    { key: "shift", label: "Nights vs days", body: { compare_by: "shift_type", units: [unit], period_a: { week_start: addWeeks(latest, -3), n_weeks: 4 } } },
    { key: "month", label: "This month vs last", body: { compare_by: "period", units: [unit], period_a: { week_start: addWeeks(latest, -3), n_weeks: 4 }, period_b: { week_start: addWeeks(latest, -7), n_weeks: 4 } } },
    { key: "unit", label: `vs ${meta.units.find((u) => u.unit_id === other)?.name ?? "another unit"}`, body: { compare_by: "unit", units: [unit, other], period_a: { week_start: addWeeks(latest, -3), n_weeks: 4 } } },
  ];

  const run = (p: (typeof presets)[number]) => {
    setActive(p.key);
    setError(null);
    managerApi<CompareResult>("/manager/compare", { ...p.body, participation_scenario: scenario }).then(setResult, (e) => {
      setResult(null);
      setError(e.message);
    });
  };

  return (
    <Panel>
      <div className="pills" style={{ marginBottom: 12 }}>
        {presets.map((p) => (
          <button key={p.key} className={active === p.key ? "on" : ""} style={{ background: active === p.key ? undefined : "var(--wash)" }} onClick={() => run(p)}>
            {p.label}
          </button>
        ))}
        <select value={other} onChange={(e) => setOther(e.target.value)} aria-label="Unit to compare with" style={{ borderRadius: 99 }}>
          {others.map((u) => (
            <option key={u.unit_id} value={u.unit_id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <ErrorLine error={error} />
      {!result && !error && <p className="sub">Pick a comparison. A “month” is four whole weeks.</p>}
      {result && (
        <div className="fade-in" key={active}>
          <div className="muted">{result.scope}</div>
          <h3 style={{ fontSize: 18, margin: "4px 0 10px" }}>{result.interpretation}</h3>
          <div className="row" style={{ fontSize: 14, marginBottom: 4 }}>
            <span>
              <span className="legend" style={{ display: "inline", margin: 0 }}>
                <span className="sw" style={{ background: "var(--series-1)" }} />
              </span>
              <strong>A</strong> {result.labels[0]}
            </span>
            <span>
              <span className="legend" style={{ display: "inline", margin: 0 }}>
                <span className="sw" style={{ background: "var(--series-2)" }} />
              </span>
              <strong>B</strong> {result.labels[1]}
            </span>
          </div>
          {result.rows
            .filter((r) => r.metric !== "participation_pct")
            .map((r) => (
              <div className="pair" key={r.metric}>
                <div className="name">
                  {ROW_NAME[r.metric] ?? r.label}
                  {r.delta !== null && (
                    <span className="delta">
                      {r.delta === 0 ? "same" : `A is ${Math.abs(r.delta)} ${Math.abs(r.delta) === 1 ? "point" : "points"} ${r.delta > 0 ? "higher" : "lower"}`}
                    </span>
                  )}
                </div>
                {([["A", r.a, "var(--series-1)"], ["B", r.b, "var(--series-2)"]] as const).map(([name, v, color]) => (
                  <div className="line" key={name}>
                    <span className="who-label">{name}</span>
                    <span className="track">{v !== null && <div className="fill" style={{ width: `${v}%`, background: color }} />}</span>
                    <span className="val">{v === null ? "—" : `${v}%`}</span>
                  </div>
                ))}
              </div>
            ))}
          <div className="row" style={{ marginTop: 12 }}>
            <span className="sub">Physical load:</span>
            <strong>A</strong> {result.a.phys_load_band ? <BandChip band={result.a.phys_load_band} /> : "—"}
            <strong>B</strong> {result.b.phys_load_band ? <BandChip band={result.b.phys_load_band} /> : "—"}
          </div>
          {result.warnings.map((w) => (
            <p key={w.text} className="muted" style={{ marginTop: 8 }}>
              ⚠ {w.text}
            </p>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- actions

type ActionRow = { week_start: string; note: string; created_at: string; label: string };

const ACTION_TYPES = [
  ["float_for_breaks", "Float for breaks"],
  ["called_in_staff", "Called in staff"],
  ["reassigned_patients", "Reassigned patients"],
  ["none", "No action"],
];

function Actions({ unit, week }: { unit: string; week: string }) {
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [type, setType] = useState("float_for_breaks");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    managerApi<ActionRow[]>(`/manager/actions?unit=${unit}`).then(setRows, (e) => setError(e.message));
  }, [unit]);
  useEffect(load, [load]);
  return (
    <div className="stack">
      <p className="sub">For the week of {fmtWeek(week)}</p>
      <div className="pills">
        {ACTION_TYPES.map(([k, label]) => (
          <button key={k} className={type === k ? "on" : ""} style={{ background: type === k ? undefined : "var(--wash)" }} onClick={() => setType(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="row">
        <input type="text" placeholder="Note (optional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <button
          className="primary"
          onClick={() =>
            managerApi("/manager/actions", { unit_id: unit, week_start: week, action_type: type, note }).then(() => {
              setNote("");
              load();
            }, (e) => setError(e.message))
          }
        >
          Log it
        </button>
      </div>
      <ErrorLine error={error} />
      {rows.length > 0 && (
        <table>
          <tbody>
            {rows.map((r) => (
              <tr key={r.created_at}>
                <td style={{ whiteSpace: "nowrap" }}>{fmtWeek(r.week_start)}</td>
                <td>{r.label[0].toUpperCase() + r.label.slice(1)}</td>
                <td>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// -------------------------------------------------------------- guardrail

type Demo = { sent_to_model: object; model_output: { headline: string }; rejection: string; fallback: { headline: string; changes: string[] } };

function Guardrail() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="stack">
      <p className="sub">The AI never sees a number or a name. Bad drafts are thrown away.</p>
      <div>
        <button onClick={() => managerApi<Demo>("/manager/validator-demo", {}).then(setDemo, (e) => setError(e.message))}>Try it with a bad draft</button>
      </div>
      <ErrorLine error={error} />
      {demo && (
        <div className="fade-in stack">
          <div>
            <h3>1. A bad draft (canned example)</h3>
            <pre className="report">{demo.model_output.headline}</pre>
          </div>
          <div className="banner bad" style={{ boxShadow: "none", background: "var(--wash)" }}>
            <strong>2. Rejected:</strong> {demo.rejection}
          </div>
          <div>
            <h3>3. Template used instead</h3>
            <pre className="report">{[demo.fallback.headline, ...demo.fallback.changes].join("\n")}</pre>
          </div>
          <More title="What the AI would have been sent">
            <pre className="report">{JSON.stringify(demo.sent_to_model, null, 1)}</pre>
          </More>
        </div>
      )}
    </div>
  );
}
