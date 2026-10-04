"use client";

import { useEffect, useState } from "react";
import { Badge, ErrorLine, More, PageHeading, Panel, useRole } from "@/components/ui";
import { WeeklyReport } from "@/components/WeeklyReport";
import { fmtWeek, managerApi } from "@/lib/api";
import type { Meta } from "../manager/page";

type Gap = {
  weeks: { week_start: string; red_shifts_noised: number; reports_sent_noised: number; relief_requests_noised: number }[];
  red_shifts_about: number;
  reports_sent_about: number;
  relief_requests_about: number;
};
type Log = { total: number; purpose_limit: string; rows: { ts: string; service: string; role: string; endpoint: string; params_hash: string }[] };

export default function CommitteePage() {
  const session = useRole("joint_committee");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [unit, setUnit] = useState("");
  const [week, setWeek] = useState("");
  const [gap, setGap] = useState<Gap | null>(null);
  const [log, setLog] = useState<Log | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    managerApi<Meta>("/meta").then((m) => {
      setMeta(m);
      setUnit(m.units[0]?.unit_id ?? "");
      setWeek(m.weeks[m.weeks.length - 1] ?? "");
    }, (e) => setError(e.message));
  }, [session]);

  useEffect(() => {
    if (!session || !unit) return;
    managerApi<Gap>(`/committee/gap?unit=${unit}`).then(setGap, (e) => setError(e.message));
    managerApi<Log>("/committee/access-log?limit=50").then(setLog, (e) => setError(e.message));
  }, [session, unit, week]);

  if (!session) return <main />;
  if (!meta) return <main><ErrorLine error={error} /></main>;
  if (!meta.weeks.length)
    return (
      <main>
        <h1>Joint committee</h1>
        <p className="sub">Nothing has been published yet.</p>
      </main>
    );
  const maxRed = Math.max(1, ...(gap?.weeks.map((w) => w.red_shifts_noised) ?? [1]));

  return (
    <main>
      <PageHeading eyebrow="Joint committee" title="Reporting gap" sub="Unit totals only." right={<Badge mode="synthetic" />} />
      <div className="pills" style={{ margin: "0 0 18px" }}>
        {meta.units.map((u) => (
          <button key={u.unit_id} className={u.unit_id === unit ? "on" : ""} onClick={() => setUnit(u.unit_id)}>
            {u.name}
          </button>
        ))}
      </div>
      <ErrorLine error={error} />

      <Panel>
        {gap && (
          <>
            <div className="muted">Reporting gap</div>
            <div className="hero">
              About {gap.red_shifts_about} red shifts, about {gap.reports_sent_about} reported.
            </div>
            <p className="sub">
              Over {gap.weeks.length} weeks · about {gap.relief_requests_about} relief requests
            </p>
            <div className="bar-track" style={{ height: 14, marginBottom: 6 }} title="Share of red shifts that were reported">
              <div style={{ width: `${Math.min(100, (100 * gap.reports_sent_about) / Math.max(1, gap.red_shifts_about))}%`, background: "var(--series-1)" }} />
            </div>
          </>
        )}
      </Panel>

      <More title="Week by week">
        {gap && (
          <>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Week of</th>
                    <th style={{ width: "40%" }} aria-label="Red shifts bar" />
                    <th className="num">Red shifts</th>
                    <th className="num">Reports sent</th>
                    <th className="num">Relief requests</th>
                  </tr>
                </thead>
                <tbody>
                  {gap.weeks.map((w) => (
                    <tr key={w.week_start}>
                      <td>{fmtWeek(w.week_start)}</td>
                      <td>
                        <div
                          title={`${w.red_shifts_noised} red shifts`}
                          style={{ height: 12, marginTop: 4, borderRadius: "0 4px 4px 0", background: "var(--series-1)", width: `${(100 * w.red_shifts_noised) / maxRed}%`, minWidth: w.red_shifts_noised ? 2 : 0 }}
                        />
                      </td>
                      <td className="num">{w.red_shifts_noised}</td>
                      <td className="num">{w.reports_sent_noised}</td>
                      <td className="num">{w.relief_requests_noised}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </More>

      <div className="section-title" id="report">Weekly report</div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="stepper">
          <button disabled={meta.weeks.indexOf(week) <= 0} onClick={() => setWeek(meta.weeks[meta.weeks.indexOf(week) - 1])} aria-label="Previous week">
            ‹
          </button>
          <span>Week of {fmtWeek(week)}</span>
          <button disabled={meta.weeks.indexOf(week) >= meta.weeks.length - 1} onClick={() => setWeek(meta.weeks[meta.weeks.indexOf(week) + 1])} aria-label="Next week">
            ›
          </button>
        </div>
      </div>
      {unit && week && (
        <Panel>
          <WeeklyReport unit={unit} week={week} scenario={meta.default_scenario} full />
        </Panel>
      )}

      <div className="section-title" id="access">Who looked at what</div>
      <div className="banner info">
        <strong>Purpose limit.</strong> {meta.purpose_limit}
      </div>
      <More title={`Access log${log ? ` (${log.total} requests)` : ""}`}>
        {log && (
          <>
            <p className="sub">Nobody can change or delete a row. Showing the latest {log.rows.length}.</p>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Role</th>
                    <th>Service</th>
                    <th>Request</th>
                    <th>Parameters (hash)</th>
                  </tr>
                </thead>
                <tbody>
                  {log.rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(r.ts).toLocaleString("en-CA", { hour12: false })}</td>
                      <td>{r.role}</td>
                      <td>{r.service}</td>
                      <td>{r.endpoint}</td>
                      <td style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>{r.params_hash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </More>
    </main>
  );
}
