"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  ClipboardList,
  Coffee,
  Columns2,
  Hand,
  HeartPulse,
  History,
  ListChecks,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Role, saveSession, useSession } from "@/lib/api";

export type Mode = "live" | "replay" | "synthetic";

/** Every panel says where its data comes from. */
export function Badge({ mode, note }: { mode: Mode; note?: string }) {
  return (
    <span className={`badge ${mode}`}>
      {mode.toUpperCase()}
      {note ? ` · ${note.toUpperCase()}` : ""}
    </span>
  );
}

export function PageHeading({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {right && <div className="right">{right}</div>}
    </div>
  );
}

export function Panel({ title, mode, modeNote, actions, children, className = "", id }: {
  title?: string;
  mode?: Mode;
  modeNote?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`panel ${className}`} id={id}>
      {(title || mode || actions) && (
        <div className="panel-head">
          {title && <h2>{title}</h2>}
          <span className="spacer" />
          {actions}
          {mode && <Badge mode={mode} note={modeNote} />}
        </div>
      )}
      {children}
    </section>
  );
}

/** Collapsed-by-default section: detail on demand. */
export function More({ title, children, open, id }: { title: ReactNode; children: ReactNode; open?: boolean; id?: string }) {
  return (
    <details className="more" open={open} id={id}>
      <summary>{title}</summary>
      <div className="body">{children}</div>
    </details>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) {
  return (
    <button className={`toggle ${value ? "on" : ""}`} role="switch" aria-checked={value} aria-label={label} onClick={onChange}>
      <span />
    </button>
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

// ------------------------------------------------------------------ shell

type NavItem = { label: string; href: string; icon: LucideIcon };

const NAV: Record<Role, { section: string; items: NavItem[] }> = {
  nurse: {
    section: "Nurse",
    items: [
      { label: "My shift", href: "/nurse", icon: Activity },
      { label: "My shifts", href: "/nurse/history", icon: History },
      { label: "Settings & privacy", href: "/nurse/settings", icon: Settings },
    ],
  },
  charge_nurse: { section: "Relief", items: [{ label: "Relief requests", href: "/relief", icon: Coffee }] },
  manager: {
    section: "Manager",
    items: [
      { label: "Weekly view", href: "/manager", icon: BarChart3 },
      { label: "Compare", href: "/manager#compare", icon: Columns2 },
      { label: "Actions", href: "/manager#actions", icon: ListChecks },
    ],
  },
  joint_committee: {
    section: "Joint committee",
    items: [
      { label: "Reporting gap", href: "/committee", icon: ClipboardList },
      { label: "Weekly report", href: "/committee#report", icon: Users },
      { label: "Access log", href: "/committee#access", icon: LockKeyhole },
    ],
  },
  admin: { section: "Trustee", items: [{ label: "Weekly release", href: "/trustee", icon: Upload }] },
};

const ROLE_LABEL: Record<Role, string> = {
  nurse: "Nurse",
  charge_nurse: "Relief recipient",
  manager: "Manager",
  joint_committee: "Joint committee",
  admin: "Trustee",
};

export const ROLE_ICON: Record<Role, LucideIcon> = {
  nurse: HeartPulse,
  charge_nurse: Hand,
  manager: BarChart3,
  joint_committee: Users,
  admin: ShieldCheck,
};

function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("shiftload-theme", next ? "dark" : "light");
    } catch {
      /* private mode: theme just won't persist */
    }
  };
  return [dark, toggle];
}

export function Shell({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState("");
  const [dark, toggleTheme] = useTheme();

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);
  useEffect(() => setOpen(false), [pathname, hash]);

  const signedIn = !!session && pathname !== "/";
  const nav = session ? NAV[session.role] : null;
  const isActive = (href: string) => {
    const [path, h] = href.split("#");
    return h ? pathname === path && hash === `#${h}` : pathname === path && (!hash || !nav?.items.some((i) => i.href === `${path}${hash}`));
  };

  return (
    <div className={`shell ${signedIn ? "" : "signed-out"}`}>
      {signedIn && nav && session && (
        <>
          {open && <div className="backdrop" onClick={() => setOpen(false)} />}
          <aside className={`sidebar ${open ? "open" : ""}`} aria-label="WARD navigation">
            <Link href="/" className="wordmark">
              WARD <small>workload and rest</small>
            </Link>
            <div className="on-as">
              Signed in as
              <strong>{ROLE_LABEL[session.role]}</strong>
            </div>
            <nav aria-label={nav.section}>
              {nav.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className={`nav-item ${isActive(item.href) ? "active" : ""}`} onClick={() => setHash(item.href.includes("#") ? `#${item.href.split("#")[1]}` : "")}>
                    <Icon size={19} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="sidebar-footer">
              <button className="nav-item" onClick={toggleTheme}>
                {dark ? <Sun size={19} /> : <Moon size={19} />}
                {dark ? "Light mode" : "Dark mode"}
              </button>
              <button
                className="nav-item"
                onClick={() => {
                  saveSession(null);
                  router.push("/");
                }}
              >
                <LogOut size={19} />
                Switch role
              </button>
              <div className="sidebar-note">Demo sign-in. Real sign-in is not connected yet.</div>
            </div>
          </aside>
        </>
      )}
      <div className="workspace">
        {signedIn && (
          <header className="appbar">
            <button className="icon-button" aria-label="Open navigation" onClick={() => setOpen(true)}>
              <Menu size={22} />
            </button>
            <span className="wordmark">WARD</span>
          </header>
        )}
        {children}
        <footer className="disclaimer">Workload documentation tool — not a medical device.</footer>
      </div>
    </div>
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
