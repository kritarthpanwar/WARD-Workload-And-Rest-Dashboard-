"use client";

import { useState } from "react";
import { ErrorLine, Panel, useRole } from "@/components/ui";
import { nurseApi } from "@/lib/api";

type Result = { cells: number; released: number; by_status: Record<string, number>; flags: number; reports: number; gemini_reports: number };

const STATUS: Record<string, string> = {
  released: "Released",
  suppressed_k: "Suppressed: fewer than five nurses",
  suppressed_membership: "Suppressed: nurse group changed by fewer than five",
  not_representative: "Not representative: participation below 40%",
  quality_gate: "Held back: coverage below 50%",
};

export default function TrusteePage() {
  const session = useRole("admin");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session) return <main className="narrow" />;
  return (
    <main className="narrow">
      <h1>Trustee</h1>
      <p className="sub">The trustee holds the database. This job is the only thing that writes what managers can read.</p>
      <Panel title="Weekly release">
        <div className="stack">
          <p className="sub">
            Weekly aggregates → groups under five and small membership changes suppressed → proportions rounded to
            10%, counts noised → anomaly flags → weekly reports.
          </p>
          <button
            className="primary big"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              nurseApi<Result>("/jobs/release/run", {})
                .then(setResult, (e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Running…" : "Run weekly release"}
          </button>
          <ErrorLine error={error} />
          {result && (
            <table>
              <tbody>
                {Object.entries(result.by_status).map(([k, v]) => (
                  <tr key={k}>
                    <td>{STATUS[k] ?? k}</td>
                    <td className="num">{v} cells</td>
                  </tr>
                ))}
                <tr>
                  <td>Weekly flags published</td>
                  <td className="num">{result.flags}</td>
                </tr>
                <tr>
                  <td>Weekly reports written</td>
                  <td className="num">
                    {result.reports} ({result.gemini_reports} worded by Gemini)
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="muted">Counts are for the default participation setting. Noise is fixed per cell, so running the job again gives the same published numbers.</p>
        </div>
      </Panel>
    </main>
  );
}
