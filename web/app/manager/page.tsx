"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BandChip, ErrorLine, Panel, useRole } from "@/components/ui";
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

const HEAT_METRICS = [
  { key: "pct_red_high", label: "Red-shift rate" },
  { key: "pct_no_break_5h", label: "Shifts with 5 h without a break" },
  { key: "pct_insufficient", label: "Shifts with unknown band" },
  { key: "pct_ratio_met_and_breaks", label: "Ratio met and breaks taken" },
] as const;
type HeatKey = (typeof HEAT_METRICS)[number]["key"];

const HIDDEN_CODE: Record<string, string> = {
  suppressed_k: "k<5",
  suppressed_membership: "Δ<5",
  not_representative: "part.",
  quality_gate: "cov.",
};

const step = (v: number) => (v <= 10 ? 1 : v <= 30 ? 2 : v <= 50 ? 3 : v <= 70 ? 4 : 5);

export default function ManagerPage() {
  const session = useRole("manager");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [scenario, setScenario] = useState(60);
  const [cells, setCells] = useState<Cell[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [metric, setMetric] = useState<HeatKey>("pct_red_high");
  const [sel, setSel] = useState<{ unit: string; week: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    managerApi<Meta>("/meta").then((m) => {
      setMeta(m);
      setScenario(m.default_scenario);
      if (m.units.length && m.weeks.length) setSel({ unit: m.units[0].unit_id, week: m.weeks[m.weeks.length - 1] });
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

  if (!session) return <main />;
  if (!meta) return <main><ErrorLine error={error} /></main>;
  if (!meta.weeks.length)
    return (
      <main>
        <h1>Unit workload</h1>
        <p className="sub">Nothing has been published yet. The trustee runs the weekly release.</p>
      </main>
    );

  const unitName = (id: string) => meta.units.find((u) => u.unit_id === id)?.name ?? id;
  return (
    <main>
      <h1>Unit workload — weekly release</h1>
      <p className="sub">
        You see published weekly cells only: groups of five or more nurses, proportions rounded to 10%, counts with
        noise added. No names, no single shifts, no daily data.
      </p>
      <ErrorLine error={error} />

      <Panel title="Weekly heatmap" mode="synthetic">
        <div className="row" style={{ marginBottom: 12 }}>
          <label className="field" style={{ minWidth: 240 }}>
            Measure
            <select value={metric} onChange={(e) => setMetric(e.target.value as HeatKey)}>
              {HEAT_METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ minWidth: 260 }}>
            Participation: {scenario}% of each roster (demo only, synthetic cohort)
            <input
              type="range"
              min={meta.scenarios[0]}
              max={meta.scenarios[meta.scenarios.length - 1]}
              step={10}
              value={scenario}
              onChange={(e) => setScenario(Number(e.target.value))}
            />
          </label>
        </div>
        <Heatmap meta={meta} cells={cells} flags={flags} metric={metric} sel={sel} onSelect={setSel} />
      </Panel>

      {sel && (
        <div className="grid-2">
          <Panel title={`Weekly summary — ${unitName(sel.unit)}`} mode="synthetic">
            <WeeklyReport unit={sel.unit} week={sel.week} scenario={scenario} full />
          </Panel>
          <Panel title={`Flags — ${unitName(sel.unit)}`} mode="synthetic">
            <FlagList flags={flags.filter((f) => f.unit_id === sel.unit)} />
          </Panel>
        </div>
      )}

      {sel && <Compare meta={meta} unit={sel.unit} scenario={scenario} />}

      <div className="grid-2">
        {sel && <Actions meta={meta} unit={sel.unit} week={sel.week} />}
        <Guardrail />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- heatmap

function Heatmap({ meta, cells, flags, metric, sel, onSelect }: {
  meta: Meta;
  cells: Cell[];
  flags: Flag[];
  metric: HeatKey;
  sel: { unit: string; week: string } | null;
  onSelect: (s: { unit: string; week: string }) => void;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; unit: string; week: string; shift: string } | null>(null);
  const byKey = useMemo(() => new Map(cells.map((c) => [`${c.unit_id}|${c.week_start}|${c.shift_type}`, c])), [cells]);
  const flagsBy = useMemo(() => {
    const m = new Map<string, Flag[]>();
    for (const f of flags) {
      const k = `${f.unit_id}|${f.week_start}|${f.shift_type}`;
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return m;
  }, [flags]);
  const metricLabel = HEAT_METRICS.find((m) => m.key === metric)!.label;
  const tipCell = tip ? byKey.get(`${tip.unit}|${tip.week}|${tip.shift}`) : undefined;
  const tipFlags = tip ? flagsBy.get(`${tip.unit}|${tip.week}|${tip.shift}`) ?? [] : [];

  return (
    <>
      <div className="scroll-x">
        <table className="heat">
          <thead>
            <tr>
              <th />
              <th />
              {meta.weeks.map((w) => (
                <th key={w} className="week">
                  {fmtWeek(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meta.units.map((u, ui) =>
              (["day", "night"] as const).map((shift) => (
                <tr key={u.unit_id + shift}>
                  {shift === "day" && (
                    <th className="unit" rowSpan={2} style={ui ? { borderTop: "8px solid transparent" } : undefined}>
                      {u.name}
                    </th>
                  )}
                  <th className="shift" style={ui && shift === "day" ? { borderTop: "8px solid transparent" } : undefined}>
                    {shift === "day" ? "Days" : "Nights"}
                  </th>
                  {meta.weeks.map((w) => {
                    const key = `${u.unit_id}|${w}|${shift}`;
                    const c = byKey.get(key);
                    const flagged = flagsBy.has(key);
                    const selected = sel?.unit === u.unit_id && sel?.week === w;
                    const hover = {
                      onMouseEnter: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, unit: u.unit_id, week: w, shift }),
                      onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, unit: u.unit_id, week: w, shift }),
                      onMouseLeave: () => setTip(null),
                    };
                    let cls = "cell hidden-cell";
                    let text = "–";
                    if (c && c.status === "released") {
                      const v = c[metric] as number;
                      cls = `cell s${step(v)}`;
                      text = metric === "pct_red_high" ? redRange(c).replace("%", "") : String(v);
                    } else if (c) {
                      text = HIDDEN_CODE[c.status] ?? "–";
                    }
                    return (
                      <td key={w} style={ui && shift === "day" ? { paddingTop: 8 } : undefined}>
                        <button
                          className={`${cls}${selected ? " selected" : ""}`}
                          onClick={() => onSelect({ unit: u.unit_id, week: w })}
                          aria-label={`${u.name}, ${shift}, week of ${fmtWeek(w)}`}
                          {...hover}
                        >
                          {text}
                          {flagged && <span className="flag" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <div className="legend">
        <span>{metricLabel}, % of shifts:</span>
        {["0–10", "20–30", "40–50", "60–70", "80–100"].map((label, i) => (
          <span key={label}>
            <span className="sw" style={{ background: `var(--seq-${i + 1})` }} />
            {label}
          </span>
        ))}
        <span>
          <span className="flagdot" />
          unusual vs the previous 28 days
        </span>
      </div>
      <div className="legend">
        <span>
          <b>k&lt;5</b> fewer than five nurses
        </span>
        <span>
          <b>Δ&lt;5</b> nurse group changed by fewer than five since the last release
        </span>
        <span>
          <b>part.</b> participation below 40%
        </span>
        <span>
          <b>cov.</b> coverage below 50%
        </span>
        <span>
          <b>–</b> no shifts
        </span>
      </div>
      {tip && (
        <div className="tooltip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 280), top: tip.y + 14 }}>
          <b>
            {meta.units.find((u) => u.unit_id === tip.unit)?.name} · {tip.shift === "day" ? "days" : "nights"} · week of{" "}
            {fmtWeek(tip.week)}
          </b>
          {!tipCell && <div>No shifts recorded.</div>}
          {tipCell && tipCell.status !== "released" && <div>{STATUS_TEXT[tipCell.status]}.</div>}
          {tipCell && tipCell.status === "released" && (
            <>
              <div>Red-shift rate: {redRange(tipCell)}</div>
              <div>Band unknown: {tipCell.pct_insufficient}%</div>
              <div>5 h without a break: {tipCell.pct_no_break_5h}%</div>
              <div>Ratio met and breaks taken: {tipCell.pct_ratio_met_and_breaks}%</div>
              <div>Physical load band: {tipCell.phys_load_band}</div>
              <div>
                Coverage {tipCell.coverage_pct}% · participation {tipCell.participation_pct}%
              </div>
            </>
          )}
          {tipFlags.map((f) => (
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
  if (!flags.length) return <p className="sub">No weekly flags for this unit.</p>;
  return (
    <div className="scroll-x">
      <table>
        <thead>
          <tr>
            <th>Week of</th>
            <th>Shift</th>
            <th>Measure</th>
            <th>Compared with usual</th>
          </tr>
        </thead>
        <tbody>
          {flags.slice(0, 12).map((f) => (
            <tr key={f.week_start + f.shift_type + f.metric}>
              <td>{fmtWeek(f.week_start)}</td>
              <td>{f.shift_type === "day" ? "Days" : "Nights"}</td>
              <td>{f.label}</td>
              <td>
                <span className={`arrow-${f.direction}`}>{f.ratio_rounded}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 8 }}>
        A flag means a day in that week sat far from the unit’s previous 28 days. It says something is unusual, not why.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- compare

type Side = { values: Record<string, number | null>; phys_load_band: string | null; cells_expected: number; cells_released: number };
type CompareResult = {
  labels: [string, string];
  scope: string;
  a: Side;
  b: Side;
  rows: { metric: string; label: string; a: number | null; b: number | null; delta: number | null; arrow: string | null }[];
  warnings: { code: string; text: string }[];
  interpretation: string;
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
    {
      key: "week",
      label: "This week vs last",
      body: { compare_by: "period", units: [unit], period_a: { week_start: latest, n_weeks: 1 }, period_b: { week_start: addWeeks(latest, -1), n_weeks: 1 } },
    },
    {
      key: "shift",
      label: "Nights vs days",
      body: { compare_by: "shift_type", units: [unit], period_a: { week_start: addWeeks(latest, -3), n_weeks: 4 } },
    },
    {
      key: "month",
      label: "This month vs last",
      body: { compare_by: "period", units: [unit], period_a: { week_start: addWeeks(latest, -3), n_weeks: 4 }, period_b: { week_start: addWeeks(latest, -7), n_weeks: 4 } },
    },
    {
      key: "unit",
      label: `This unit vs ${meta.units.find((u) => u.unit_id === other)?.name ?? "another"}`,
      body: { compare_by: "unit", units: [unit, other], period_a: { week_start: addWeeks(latest, -3), n_weeks: 4 } },
    },
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
    <Panel title={`Ask your unit — ${meta.units.find((u) => u.unit_id === unit)?.name}`} mode="synthetic">
      <div className="row" style={{ marginBottom: 12 }}>
        {presets.map((p) => (
          <button key={p.key} className={active === p.key ? "pressed" : ""} onClick={() => run(p)}>
            {p.label}
          </button>
        ))}
        <label className="row sub">
          other unit
          <select value={other} onChange={(e) => setOther(e.target.value)}>
            {others.map((u) => (
              <option key={u.unit_id} value={u.unit_id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorLine error={error} />
      {!result && !error && <p className="sub">Pick a comparison. “Month” means four whole weeks. Comparisons read the published release only.</p>}
      {result && (
        <div className="stack">
          <div className="muted">{result.scope}</div>
          <h3 style={{ fontSize: 16 }}>{result.interpretation}</h3>
          {result.warnings.map((w) => (
            <div key={w.text} className="banner" style={{ marginBottom: 0 }}>
              {w.text}
            </div>
          ))}
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Measure</th>
                  <th className="num">A · {result.labels[0]}</th>
                  <th className="num">B · {result.labels[1]}</th>
                  <th className="num">A compared with B</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.metric}>
                    <td>{r.label[0].toUpperCase() + r.label.slice(1)}</td>
                    <td className="num">{r.a === null ? "—" : `${r.a}%`}</td>
                    <td className="num">{r.b === null ? "—" : `${r.b}%`}</td>
                    <td className="num">
                      {r.delta === null ? "—" : <span className={`arrow-${r.arrow}`}>{r.delta === 0 ? "same" : `${Math.abs(r.delta)} ${Math.abs(r.delta) === 1 ? "point" : "points"}`}</span>}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>Physical load band (most common)</td>
                  <td className="num">{result.a.phys_load_band ? <BandChip band={result.a.phys_load_band} /> : "—"}</td>
                  <td className="num">{result.b.phys_load_band ? <BandChip band={result.b.phys_load_band} /> : "—"}</td>
                  <td />
                </tr>
                <tr>
                  <td>Cells released</td>
                  <td className="num">
                    {result.a.cells_released} of {result.a.cells_expected}
                  </td>
                  <td className="num">
                    {result.b.cells_released} of {result.b.cells_expected}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted">Each side is the average of its released unit-week cells. The sentence above is written by code and describes a difference, not a cause.</p>
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- actions

type ActionRow = { unit_id: string; week_start: string; action_type: string; note: string; created_at: string; label: string };

const ACTION_TYPES = [
  ["float_for_breaks", "Float for breaks"],
  ["called_in_staff", "Called in staff"],
  ["reassigned_patients", "Reassigned patients"],
  ["none", "No action"],
];

function Actions({ meta, unit, week }: { meta: Meta; unit: string; week: string }) {
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [type, setType] = useState("float_for_breaks");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    managerApi<ActionRow[]>(`/manager/actions?unit=${unit}`).then(setRows, (e) => setError(e.message));
  }, [unit]);
  useEffect(load, [load]);
  return (
    <Panel title={`Action log — ${meta.units.find((u) => u.unit_id === unit)?.name}`} mode="live">
      <div className="stack">
        <div className="row">
          <span className="sub">For the week of {fmtWeek(week)}:</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {ACTION_TYPES.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <input type="text" placeholder="Note (optional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        <div>
          <button
            className="primary"
            onClick={() =>
              managerApi("/manager/actions", { unit_id: unit, week_start: week, action_type: type, note }).then(() => {
                setNote("");
                load();
              }, (e) => setError(e.message))
            }
          >
            Log action
          </button>
        </div>
        <ErrorLine error={error} />
        {rows.length === 0 ? (
          <p className="sub">No actions logged for this unit.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Week of</th>
                <th>Action</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.created_at}>
                  <td>{fmtWeek(r.week_start)}</td>
                  <td>{r.label[0].toUpperCase() + r.label.slice(1)}</td>
                  <td>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted">The next weekly release reports what the no-break share did in the week after each action.</p>
      </div>
    </Panel>
  );
}

// -------------------------------------------------------------- guardrail

type Demo = {
  sent_to_model: object;
  model_output: { headline: string };
  rejection: string;
  fallback: { headline: string; changes: string[] };
};

function Guardrail() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel title="Summary guardrail">
      <div className="stack">
        <p className="sub">
          The language model only receives placeholder keys, measure names and direction labels — never a number or
          a name. Its output is rejected if it contains a digit, an unknown placeholder or causal wording.
        </p>
        <div>
          <button onClick={() => managerApi<Demo>("/manager/validator-demo", {}).then(setDemo, (e) => setError(e.message))}>
            Run the validator on a bad draft
          </button>
        </div>
        <ErrorLine error={error} />
        {demo && (
          <>
            <div>
              <h3>What would be sent to the model</h3>
              <pre className="report">{JSON.stringify(demo.sent_to_model, null, 1)}</pre>
            </div>
            <div>
              <h3>A bad draft (canned example, not a live model call)</h3>
              <pre className="report">{demo.model_output.headline}</pre>
            </div>
            <div className="banner bad" style={{ marginBottom: 0 }}>
              <strong>Rejected:</strong> {demo.rejection}
            </div>
            <div>
              <h3>Template used instead</h3>
              <pre className="report">{[demo.fallback.headline, ...demo.fallback.changes].join("\n")}</pre>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
