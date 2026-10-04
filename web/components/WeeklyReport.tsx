"use client";

import { useEffect, useState } from "react";
import { BandChip, ErrorLine } from "@/components/ui";
import { fmtWeek, managerApi } from "@/lib/api";

export type Cell = {
  unit_id: string;
  week_start: string;
  shift_type: "day" | "night";
  status: string;
  participation_pct: number | null;
  coverage_pct: number | null;
  pct_red_low: number | null;
  pct_red_high: number | null;
  pct_insufficient: number | null;
  pct_no_break_5h: number | null;
  pct_ratio_met_and_breaks: number | null;
  phys_load_band: string | null;
  red_shifts_noised: number | null;
  data_mode: string;
};

type Report = {
  unit_id: string;
  week_start: string;
  payload_json: { cells: Record<string, Cell>; rejection: string | null };
  narrative: { headline: string; changes: string[]; flags: string[]; actions: string[]; data_note: string };
  source: string;
  counts: null | { red_shifts_noised: number; reports_sent_noised: number; relief_requests_noised: number };
  actions: { action_type: string; note: string; created_at: string }[];
};

export const STATUS_TEXT: Record<string, string> = {
  released: "Released",
  suppressed_k: "Suppressed: fewer than five nurses",
  suppressed_membership: "Suppressed: the nurse group differs from last week’s release by fewer than five",
  not_representative: "Not representative: participation below 40%",
  quality_gate: "Held back: coverage below 50%",
};

export function redRange(c: Cell): string {
  if (c.pct_red_low === null || c.pct_red_high === null) return "—";
  return c.pct_red_low === c.pct_red_high ? `${c.pct_red_high}%` : `${c.pct_red_low}–${c.pct_red_high}%`;
}

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

/** The weekly summary and report: one artifact per unit per week. */
export function WeeklyReport({ unit, week, scenario, full }: { unit: string; week: string; scenario: number; full?: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!unit || !week) return;
    managerApi<Report>(`/reports/weekly/${unit}/${week}?scenario=${scenario}`).then((r) => {
      setReport(r);
      setError(null);
    }, (e) => {
      setReport(null);
      setError(e.status === 404 ? "No report for this unit and week." : e.message);
    });
  }, [unit, week, scenario]);

  if (!report) return <ErrorLine error={error} />;
  const n = report.narrative;
  const lines = [...n.flags, ...n.changes, ...n.actions];
  const cells = (["day", "night"] as const).map((s) => report.payload_json.cells[s]).filter(Boolean);
  return (
    <div className="stack">
      <div>
        <div className="muted">Week of {fmtWeek(report.week_start)} · summary</div>
        <h2 style={{ marginTop: 2 }}>{n.headline}</h2>
      </div>
      {lines.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {n.data_note && <p className="sub">{n.data_note}</p>}
      {full && (
        <>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Shift</th>
                  <th>Status</th>
                  <th className="num">Red-shift rate</th>
                  <th className="num">Unknown</th>
                  <th className="num">5 h no break</th>
                  <th className="num">Ratio met + breaks</th>
                  <th>Physical load</th>
                  <th className="num">Coverage</th>
                  <th className="num">Participation</th>
                </tr>
              </thead>
              <tbody>
                {cells.map((c) => (
                  <tr key={c.shift_type}>
                    <td>{c.shift_type === "day" ? "Days" : "Nights"}</td>
                    <td>{STATUS_TEXT[c.status] ?? c.status}</td>
                    <td className="num">{redRange(c)}</td>
                    <td className="num">{pct(c.pct_insufficient)}</td>
                    <td className="num">{pct(c.pct_no_break_5h)}</td>
                    <td className="num">{pct(c.pct_ratio_met_and_breaks)}</td>
                    <td>{c.phys_load_band ? <BandChip band={c.phys_load_band} /> : "—"}</td>
                    <td className="num">{pct(c.coverage_pct)}</td>
                    <td className="num">{pct(c.participation_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.counts && (
            <p className="sub">
              About {report.counts.red_shifts_noised} red shifts, {report.counts.reports_sent_noised} workload reports
              sent, {report.counts.relief_requests_noised} relief requests (counts carry added noise).
            </p>
          )}
          {report.actions.length > 0 && (
            <p className="sub">
              Actions logged: {report.actions.map((a) => a.action_type.replaceAll("_", " ") + (a.note ? ` (${a.note})` : "")).join("; ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
