"use client";

import { useEffect, useRef, useState } from "react";

export type Win = { t: number; pct_hrr: number | null; excess: number | null; unexplained: boolean | null; scored: boolean };
export type Break = { start_min: number; end_min: number };

const M = { left: 38, right: 22, top: 8 };
const PLOT_H = 150;
const STRIP_GAP = 34;
const STRIP_H = 16;
const AXIS_H = 22;

function clock(startIso: string, offsetMin: number): string {
  return new Date(new Date(startIso).getTime() + offsetMin * 60000).toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Vancouver",
  });
}

/**
 * Two plots on one time axis: physical load (% heart-rate reserve) as a line,
 * and stress-indicator windows as a strip. They are separate measures,
 * so they get separate plots rather than a shared y-axis.
 */
export function LiveChart({ windows, breaks, startIso, elapsed }: { windows: Win[]; breaks: Break[]; startIso: string; elapsed: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(280, entries[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const span = Math.max(720, elapsed);
  const plotW = width - M.left - M.right;
  const x = (min: number) => M.left + (min / span) * plotW;
  const yMax = Math.max(60, ...windows.map((w) => w.pct_hrr ?? 0));
  const y = (v: number) => M.top + PLOT_H - (v / yMax) * PLOT_H;
  const stripY = M.top + PLOT_H + STRIP_GAP;
  const height = stripY + STRIP_H + AXIS_H;

  // line broken wherever a window could not be scored
  let path = "";
  let pen = false;
  for (const w of windows) {
    if (w.pct_hrr === null) {
      pen = false;
      continue;
    }
    path += `${pen ? "L" : "M"}${x(w.t + 2.5).toFixed(1)},${y(w.pct_hrr).toFixed(1)}`;
    pen = true;
  }
  const gaps: [number, number][] = [];
  for (const w of windows) {
    if (w.scored) continue;
    const last = gaps[gaps.length - 1];
    if (last && last[1] === w.t) last[1] = w.t + 5;
    else gaps.push([w.t, w.t + 5]);
  }
  const ticks = [];
  for (let m = 0; m <= span; m += 120) ticks.push(m);
  const hw = hover ? windows[hover.i] : null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Physical load and stress-indicator windows over the shift"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const min = ((e.clientX - rect.left - M.left) / plotW) * span;
          const i = Math.floor(min / 5);
          if (i >= 0 && i < windows.length) setHover({ i, x: e.clientX, y: e.clientY });
          else setHover(null);
        }}
      >
        <defs>
          <pattern id="nodata" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--wash)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--axis)" strokeWidth="1.5" />
          </pattern>
        </defs>

        {[0, 20, 40, 60].filter((v) => v <= yMax).map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--axis)" : "var(--grid)"} />
            <text x={M.left - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {v}%
            </text>
          </g>
        ))}

        {breaks.map((b) => (
          <g key={b.start_min}>
            <rect x={x(b.start_min)} y={M.top} width={x(b.end_min) - x(b.start_min)} height={PLOT_H} fill="var(--wash)" />
            <text x={(x(b.start_min) + x(b.end_min)) / 2} y={M.top + 12} textAnchor="middle" fontSize="10.5" fill="var(--ink-2)">
              break?
            </text>
          </g>
        ))}
        {gaps.map(([a, b]) => (
          <g key={a}>
            <rect x={x(a)} y={M.top} width={x(b) - x(a)} height={PLOT_H} fill="url(#nodata)" />
            <rect x={x(a)} y={stripY} width={x(b) - x(a)} height={STRIP_H} fill="url(#nodata)" />
            {x(b) - x(a) > 44 && (
              <text x={(x(a) + x(b)) / 2} y={M.top + 12} textAnchor="middle" fontSize="10.5" fill="var(--ink-2)">
                no data
              </text>
            )}
          </g>
        ))}

        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        <text x={M.left} y={stripY - 8} fontSize="12" fill="var(--ink-2)">
          Stress indicator (high heart rate while still)
        </text>
        <line x1={M.left} x2={width - M.right} y1={stripY + STRIP_H} y2={stripY + STRIP_H} stroke="var(--axis)" />
        {windows
          .filter((w) => w.unexplained)
          .map((w) => (
            <rect key={w.t} x={x(w.t) + 1} y={stripY} width={Math.max(2, x(w.t + 5) - x(w.t) - 2)} height={STRIP_H} rx="2" fill="var(--series-2)" />
          ))}

        {ticks.map((m) => (
          <text key={m} x={x(m)} y={height - 5} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {clock(startIso, m)}
          </text>
        ))}

        {hw && (
          <g pointerEvents="none">
            <line x1={x(hw.t + 2.5)} x2={x(hw.t + 2.5)} y1={M.top} y2={stripY + STRIP_H} stroke="var(--axis)" />
            {hw.pct_hrr !== null && (
              <circle cx={x(hw.t + 2.5)} cy={y(hw.pct_hrr)} r="4.5" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
            )}
          </g>
        )}
      </svg>
      {hw && hover && (
        <div className="tooltip" style={{ left: Math.min(hover.x + 14, window.innerWidth - 200), top: hover.y + 14 }}>
          <b>
            {clock(startIso, hw.t)}–{clock(startIso, hw.t + 5)}
          </b>
          {hw.pct_hrr === null ? (
            <span>Not enough heart-rate data to score this window.</span>
          ) : (
            <>
              <div>Physical load: {hw.pct_hrr.toFixed(0)}% of heart-rate reserve</div>
              <div>Stress indicator: {hw.unexplained ? "yes" : "no"}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
