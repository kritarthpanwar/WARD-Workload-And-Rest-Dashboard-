"use client";

import { useEffect, useState } from "react";
import { ErrorLine, Panel, useRole } from "@/components/ui";
import { NURSE_API, authHeader, nurseApi } from "@/lib/api";

type Req = { request_id: string; display_name: string; recipient_type: string; unit_name: string };

const TO: Record<string, string> = { charge: "charge nurse", buddy: "break buddy", float: "float nurse" };

export default function ReliefPage() {
  const session = useRole("charge_nurse");
  const [reqs, setReqs] = useState<Req[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Server-sent events read through fetch, so the token travels in a header and never in the URL.
  useEffect(() => {
    if (!session) return;
    const ctl = new AbortController();
    let stopped = false;
    (async () => {
      while (!stopped) {
        try {
          const res = await fetch(`${NURSE_API}/relief/stream`, { headers: authHeader(), signal: ctl.signal });
          if (!res.ok || !res.body) throw new Error(`stream failed (${res.status})`);
          setError(null);
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let cut;
            while ((cut = buf.indexOf("\n\n")) >= 0) {
              const event = buf.slice(0, cut);
              buf = buf.slice(cut + 2);
              if (event.startsWith("data: ")) setReqs(JSON.parse(event.slice(6)));
            }
          }
        } catch {
          if (stopped) return;
          setError("Connection lost. Retrying…");
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    })();
    return () => {
      stopped = true;
      ctl.abort();
    };
  }, [session]);

  if (!session) return <main className="narrow" />;
  return (
    <main className="narrow">
      <h1>Relief requests</h1>
      <p className="sub">You see who asked for relief. No heart rate, steps, hours, location or history.</p>
      <Panel title="Waiting now" mode="live">
        <ErrorLine error={error} />
        {reqs === null && !error && <p className="sub">Connecting…</p>}
        {reqs?.length === 0 && <p className="sub">Nobody is waiting for relief.</p>}
        {reqs?.map((r) => (
          <div className="relief-item" key={r.request_id}>
            <div className="name">
              Relief requested — {r.display_name}
              <div className="muted" style={{ fontWeight: 400 }}>
                {r.unit_name} · sent to {TO[r.recipient_type] ?? r.recipient_type}
              </div>
            </div>
            <button
              className="primary"
              onClick={() => nurseApi(`/relief/${r.request_id}/handled`, {}).catch((e) => setError(e.message))}
            >
              Handled
            </button>
          </div>
        ))}
        <p className="muted">A request is deleted as soon as it is marked handled. Only a weekly unit count remains.</p>
      </Panel>
    </main>
  );
}
