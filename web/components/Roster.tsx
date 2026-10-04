"use client";

import { useState } from "react";

export type Win = { t: number; pct_hrr: number | null; excess: number | null; unexplained: boolean | null; scored: boolean };
export type Break = { start_min: number; end_min: number };
export type Span = { from: number; to: number; hl: string };

const CELLS = 144; // twelve hours of five-minute cells

function clock(startIso: string, offsetMin: number): string {
  return new Date(new Date(startIso).getTime() + offsetMin * 60000).toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Vancouver",
  });
}

/** Load step for a cell: 1 (light) to 5 (very heavy), in % of heart-rate range. */
export const loadStep = (pct: number) => (pct < 10 ? 1 : pct < 20 ? 2 : pct < 30 ? 3 : pct < 45 ? 4 : 5);

/**
 * The shift as a roster row: hour columns, a load row of five-minute cells,
 * a stress row and a break row. `swipe` lays a highlighter over one stretch.
 */
export function Roster({ windows, breaks, startIso, swipe }: { windows: Win[]; breaks: Break[]; startIso: string; swipe: Span | null }) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const byIndex = new Map(windows.map((w) => [Math.floor(w.t / 5), w]));
  const startHour = Number(clock(startIso, 0).slice(0, 2));
  const hw = hover ? byIndex.get(hover.i) : undefined;
  // watch-off stretches, each drawn as one struck empty box
  const gapRuns: [number, number][] = [];
  for (let i = 0; i < CELLS; i++) {
    const w = byIndex.get(i);
    if (!w || w.pct_hrr !== null) continue;
    const last = gapRuns[gapRuns.length - 1];
    if (last && last[1] === i) last[1] = i + 1;
    else gapRuns.push([i, i + 1]);
  }
  const pct = (min: number) => `${(Math.min(Math.max(min, 0), CELLS * 5) / (CELLS * 5)) * 100}%`;

  return (
    <div
      className="roster"
      role="img"
      aria-label="Shift roster: physical load, stress and breaks in five-minute cells"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const track = e.currentTarget.querySelector<HTMLElement>(".track.load");
        if (!track) return;
        const r = track.getBoundingClientRect();
        const i = Math.floor(((e.clientX - r.left) / r.width) * CELLS);
        setHover(i >= 0 && i < CELLS ? { i, x: e.clientX, y: e.clientY } : null);
      }}
    >
      <span />
      <div className="hours" aria-hidden>
        {Array.from({ length: 12 }, (_, h) => (
          <span key={h}>{String((startHour + h) % 24).padStart(2, "0")}</span>
        ))}
      </div>

      <span className="rlabel">Load</span>
      <div className="track load">
        {Array.from({ length: CELLS }, (_, i) => {
          const w = byIndex.get(i);
          return w && w.pct_hrr !== null ? <i key={i} className={`c${loadStep(w.pct_hrr)}`} style={{ gridColumn: i + 1, gridRow: 1 }} /> : null;
        })}
        {gapRuns.map(([a, b]) => (
          <i key={`gap-${a}`} className="gap" style={{ gridColumn: `${a + 1} / ${b + 1}`, gridRow: 1 }} />
        ))}
        {swipe && <span key={`${swipe.from}-${swipe.hl}`} className="swipe" style={{ left: pct(swipe.from), width: `calc(${pct(swipe.to)} - ${pct(swipe.from)})`, ["--hl" as string]: swipe.hl }} />}
        {hover && <span className="cursor" style={{ left: `${((hover.i + 0.5) / CELLS) * 100}%` }} />}
      </div>

      <span className="rlabel">Stress</span>
      <div className="track thin">
        {Array.from({ length: CELLS }, (_, i) => (
          <i key={i} className={byIndex.get(i)?.unexplained ? "stress-on" : ""} />
        ))}
      </div>

      <span className="rlabel">Break</span>
      <div className="track thin">
        {breaks.map((b) => (
          <i key={b.start_min} className="break-span" style={{ gridRow: 1, gridColumn: `${Math.floor(b.start_min / 5) + 1} / ${Math.min(Math.ceil(b.end_min / 5), CELLS) + 1}` }} />
        ))}
      </div>

      {hover && (
        <div className="tooltip" style={{ left: Math.min(hover.x + 14, window.innerWidth - 220), top: hover.y + 16 }}>
          <b>
            {clock(startIso, hover.i * 5)}–{clock(startIso, hover.i * 5 + 5)}
          </b>
          {!hw ? (
            <span>Not reached yet.</span>
          ) : hw.pct_hrr === null ? (
            <span>Watch off: no data.</span>
          ) : (
            <>
              <div>Load {hw.pct_hrr.toFixed(0)}% effort</div>
              <div>Stress: {hw.unexplained ? "high" : "no"}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function RosterKey() {
  return (
    <div className="roster-key">
      <span>
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className="sw" style={{ background: `var(--load-${s})`, marginRight: s === 5 ? 5 : 0, borderRight: s === 5 ? undefined : "none" }} />
        ))}
        lighter to heavier load
      </span>
      <span>
        <span className="sw" style={{ background: "var(--stress)" }} />
        high heart rate while still
      </span>
      <span>
        <span className="sw" style={{ background: "var(--ink)" }} />
        break
      </span>
      <span>
        <span className="sw" style={{ background: "linear-gradient(to top right, transparent calc(50% - 0.5px), var(--nodata) calc(50% - 0.5px) calc(50% + 0.5px), transparent calc(50% + 0.5px))" }} />
        watch off
      </span>
    </div>
  );
}
