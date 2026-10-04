"use client";

import { useState } from "react";
import { ErrorLine, PageHeading, Panel, useRole } from "@/components/ui";
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
  if (!session) return <main />;
  return (
    <main>
      <PageHeading title="Weekly release" sub="Publishes the weekly numbers managers can see." />
      <Panel className="trustee-panel">
        <div className="stack">
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
        </div>
      </Panel>
    </main>
  );
}
