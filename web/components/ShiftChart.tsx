"use client";

import { useEffect, useRef, useState } from "react";

export type Win = { t: number; pct_hrr: number | null; excess: number | null; unexplained: boolean | null; scored: boolean };
export type Break = { start_min: number; end_min: number };
export type Span = { from: number; to: number; color: string };

const H = 280;
const PAD = { l: 14, r: 14, t: 26, b: 30 };

function clock(startIso: string, offsetMin: number): string {
  return new Date(new Date(startIso).getTime() + offsetMin * 60000).toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Vancouver",
  });
}

/**
 * Physical load over the shift as a smooth area chart. The line draws itself
 * in on arrival; stress shows as amber points, breaks as violet bands, and
 * `focus` lights up the stretch a highlight refers to.
 */
export function ShiftChart({ windows, breaks, startIso, focus }: { windows: Win[]; breaks: Break[]; startIso: string; focus: Span | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<{ i: number; px: number } | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver((e) => setWidth(Math.max(280, e[0].contentRect.width)));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const span = Math.max(720, (windows[windows.length - 1]?.t ?? 0) + 5);
  const x = (min: number) => PAD.l + (min / span) * (width - PAD.l - PAD.r);
  const yMax = Math.max(60, ...windows.map((w) => w.pct_hrr ?? 0));
  const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);
  const base = H - PAD.b;

  // line and area, broken wherever a window has no data
  let line = "";
  let area = "";
  let run: Win[] = [];
  const gaps: [number, number][] = [];
  const flush = () => {
    if (run.length > 1) {
      const pts = run.map((w) => `${x(w.t + 2.5).toFixed(1)},${y(w.pct_hrr!).toFixed(1)}`);
      line += `M${pts.join("L")}`;
      area += `M${x(run[0].t + 2.5).toFixed(1)},${base}L${pts.join("L")}L${x(run[run.length - 1].t + 2.5).toFixed(1)},${base}Z`;
    }
    run = [];
  };
  for (const w of windows) {
    if (w.pct_hrr === null) {
      flush();
      const last = gaps[gaps.length - 1];
      if (last && last[1] === w.t) last[1] = w.t + 5;
      else gaps.push([w.t, w.t + 5]);
    } else run.push(w);
  }
  flush();

  const last = [...windows].reverse().find((w) => w.pct_hrr !== null);
  const ticks = [0, 120, 240, 360, 480, 600, 720].filter((m) => m <= span);
  const hw = hover ? windows[hover.i] : null;

  return (
    <div
      ref={box}
      className="chart-box"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const min = ((e.clientX - r.left - 10 - PAD.l) / (width - PAD.l - PAD.r)) * span;
        const i = Math.floor(min / 5);
        setHover(i >= 0 && i < windows.length ? { i, px: e.clientX - r.left } : null);
      }}
    >
      <svg width={width} height={H} role="img" aria-label="Physical load over the shift, with stress points and breaks">
        <defs>
          <linearGradient id="loadFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--teal-bright)" stopOpacity="0.36" />
            <stop offset="1" stopColor="var(--teal-bright)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 20, 40, 60].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
            <text x={PAD.l} y={y(v) - 6} fontSize="13" fontWeight="600" fill="var(--muted)">
              {v}%
            </text>
          </g>
        ))}
        {ticks.map((m) => (
          <text key={m} x={Math.min(Math.max(x(m), PAD.l + 18), width - PAD.r - 18)} y={H - 8} fontSize="13" fontWeight="600" fill="var(--muted)" textAnchor="middle">
            {clock(startIso, m)}
          </text>
        ))}

        {breaks.map((b) => (
          <rect key={b.start_min} x={x(b.start_min)} y={PAD.t - 8} width={x(b.end_min) - x(b.start_min)} height={base - PAD.t + 8} rx="10" fill="var(--sleep)" opacity="0.16" />
        ))}
        {gaps.map(([a, b]) => (
          <g key={a}>
            <rect x={x(a)} y={PAD.t - 8} width={x(b) - x(a)} height={base - PAD.t + 8} rx="10" fill="none" stroke="var(--nodata)" strokeWidth="2" strokeDasharray="5 5" />
            {x(b) - x(a) > 64 && (
              <text x={(x(a) + x(b)) / 2} y={PAD.t + 12} fontSize="13" fontWeight="700" fill="var(--muted)" textAnchor="middle">
                watch off
              </text>
            )}
          </g>
        ))}
        {focus && (
          <rect key={`${focus.from}-${focus.color}`} className="chart-area" x={x(focus.from) - 6} y={PAD.t - 12} width={x(focus.to) - x(focus.from) + 12} height={base - PAD.t + 16} rx="12" fill={focus.color} />
        )}

        <path className="chart-area" d={area} fill="url(#loadFill)" />
        <path className="chart-line" d={line} pathLength={1} fill="none" stroke="var(--teal-bright)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />

        {windows
          .filter((w) => w.unexplained && w.pct_hrr !== null)
          .map((w) => (
            <circle key={w.t} cx={x(w.t + 2.5)} cy={y(w.pct_hrr!)} r="6" fill="var(--stress)" stroke="var(--sheet)" strokeWidth="2.5" />
          ))}
        {last && <circle className="now-dot" cx={x(last.t + 2.5)} cy={y(last.pct_hrr!)} r="6.5" fill="var(--teal-bright)" stroke="var(--sheet)" strokeWidth="3" />}

        {hw && hw.pct_hrr !== null && (
          <g pointerEvents="none">
            <line x1={x(hw.t + 2.5)} x2={x(hw.t + 2.5)} y1={PAD.t - 8} y2={base} stroke="var(--nodata)" strokeDasharray="4 4" />
            <circle cx={x(hw.t + 2.5)} cy={y(hw.pct_hrr)} r="6" fill="var(--sheet)" stroke="var(--teal-bright)" strokeWidth="3" />
          </g>
        )}
      </svg>
      {hw && hover && (
        <div className="tooltip" style={{ position: "absolute", left: Math.min(Math.max(hover.px, 70), width - 60), top: hw.pct_hrr === null ? 80 : y(hw.pct_hrr) - 12, transform: "translate(-50%, -100%)", whiteSpace: "nowrap" }}>
          <b>{clock(startIso, hw.t)}</b>
          {hw.pct_hrr === null ? "Watch off" : `${hw.pct_hrr.toFixed(0)}% effort${hw.unexplained ? " · stress high" : ""}`}
        </div>
      )}
    </div>
  );
}
