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

export function Panel({
  title,
  mode,
  modeNote,
  actions,
  children,
}: {
  title: string;
  mode?: Mode;
  modeNote?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {mode && <Badge mode={mode} note={modeNote} />}
        <span className="spacer" />
        {actions}
      </div>
      {children}
    </section>
  );
}

const BAND_LABEL: Record<string, string> = {
  green: "Green",
  amber: "Amber",
  red: "Red",
  insufficient: "Insufficient data",
};

export function BandChip({ band, big }: { band: string | null; big?: boolean }) {
  const b = band ?? "insufficient";
  return (
    <span className={`chip ${big ? "big" : ""}`}>
      <span className={`dot ${b}`} />
      {BAND_LABEL[b] ?? b}
    </span>
  );
}

const ROLE_LABEL: Record<Role, string> = {
  nurse: "Nurse",
  charge_nurse: "Relief recipient",
  manager: "Manager",
  joint_committee: "Joint committee",
  admin: "Trustee admin",
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
          <span className="who">Signed in as {ROLE_LABEL[session.role]} (dev sign-in)</span>
          <button
            onClick={() => {
              saveSession(null);
              router.push("/");
            }}
          >
            Switch role
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
