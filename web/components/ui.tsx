"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { Role, saveSession, useSession } from "@/lib/api";

export type Mode = "live" | "replay" | "synthetic";

/** Every panel says where its data comes from. */
export function Badge({ mode, note }: { mode: Mode; note?: string }) {
  return (
    <span className={`badge ${mode}`}>
      {mode.toUpperCase()}
      {note ? ` · ${note}` : ""}
    </span>
  );
}

export function Panel({ title, mode, modeNote, actions, children }: {
  title?: string;
  mode?: Mode;
  modeNote?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      {(title || mode || actions) && (
        <div className="panel-head">
          {title && <h2>{title}</h2>}
          {mode && <Badge mode={mode} note={modeNote} />}
          <span className="spacer" />
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Collapsed-by-default section: detail on demand. */
export function More({ title, children, open }: { title: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="more" open={open}>
      <summary>{title}</summary>
      <div className="body">{children}</div>
    </details>
  );
}

export const BAND_LABEL: Record<string, string> = {
  green: "Green",
  amber: "Amber",
  red: "Red",
  insufficient: "Not enough data",
};

export const BAND_COLOR: Record<string, string> = {
  green: "var(--good)",
  amber: "var(--warning)",
  red: "var(--critical)",
  insufficient: "var(--nodata)",
};

export function BandChip({ band, big, label }: { band: string | null; big?: boolean; label?: string }) {
  const b = band ?? "insufficient";
  return (
    <span className={`chip ${big ? "big" : ""}`}>
      <span className={`dot ${b}`} />
      {label ?? BAND_LABEL[b] ?? b}
    </span>
  );
}

/** Progress ring with a value in the middle. */
export function Ring({ fraction, color, size = 112, children }: { fraction: number; color: string; size?: number; children: ReactNode }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.min(Math.max(fraction, 0), 1);
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg className="ring" width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--wash)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - f)} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1.1 }}>
        {children}
      </div>
    </div>
  );
}

const PATHS: Record<string, string> = {
  heart: "M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20Z",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4.5l3 1.8",
  list: "M5 7h14M5 12h14M5 17h14",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0-5v2m0 12v2m8-8h-2M6 12H4m13.7-5.7-1.4 1.4M7.7 16.3l-1.4 1.4m11.4 0-1.4-1.4M7.7 7.7 6.3 6.3",
  hand: "M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5a1.5 1.5 0 0 1 3 0V11m0-4a1.5 1.5 0 0 1 3 0v6.5c0 3.6-2.4 6.5-6 6.5-2.6 0-4-1.2-5.2-3.2L4 14a1.5 1.5 0 0 1 2.6-1.5L8 14.5",
  chart: "M5 19V10m7 9V5m7 14v-6",
  people: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 8c0-2.8 2.2-5 5-5s5 2.200 5 5m1-8a2.500 2.500 0 1 0 0-5m4 13c0-2.300-1.500-4.200-3.500-4.800",
  shield: "M12 4 5 7v5c0 4 3 7 7 8 4-1 7-4 7-8V7l-7-3Z",
};

export function Icon({ name }: { name: keyof typeof PATHS | string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

const ROLE_LABEL: Record<Role, string> = {
  nurse: "Nurse",
  charge_nurse: "Relief recipient",
  manager: "Manager",
  joint_committee: "Joint committee",
  admin: "Trustee",
};

export function TopBar() {
  const session = useSession();
  const router = useRouter();
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        ShiftLoad
      </Link>
      <span className="spacer" />
      {session && (
        <>
          <span className="who">{ROLE_LABEL[session.role]} · demo sign-in</span>
          <button
            onClick={() => {
              saveSession(null);
              router.push("/");
            }}
          >
            Switch
          </button>
        </>
      )}
    </header>
  );
}

/** Sends the visitor back to the role picker unless they hold one of the roles. */
export function useRole(...roles: Role[]) {
  const session = useSession();
  const router = useRouter();
  const ok = !!session && roles.includes(session.role);
  useEffect(() => {
    if (session !== undefined && !ok) router.replace("/");
  }, [session, ok, router]);
  return ok ? session : null;
}

export function ErrorLine({ error }: { error: string | null }) {
  return error ? <p className="error">{error}</p> : null;
}
