"use client";

import { useEffect, useState } from "react";

export const NURSE_API = process.env.NEXT_PUBLIC_NURSE_API ?? "http://localhost:8001";
export const MANAGER_API = process.env.NEXT_PUBLIC_MANAGER_API ?? "http://localhost:8002";

export type Role = "nurse" | "charge_nurse" | "manager" | "joint_committee" | "admin";
export type Session = { role: Role; uid: string };

const KEY = "shiftload.session";

export function saveSession(s: Session | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("shiftload-session"));
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** undefined while loading, null when signed out. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const sync = () => setSession(readSession());
    sync();
    window.addEventListener("shiftload-session", sync);
    return () => window.removeEventListener("shiftload-session", sync);
  }, []);
  return session;
}

// Dev sign-in only: the token names the role. Firebase Auth replaces this.
export function authHeader(): Record<string, string> {
  const s = readSession();
  return s ? { Authorization: `Bearer dev:${s.role}:${s.uid}` } : {};
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(base: string, path: string, body?: unknown, method?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(base + path, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: { ...authHeader(), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, `Cannot reach the service at ${base}. Is it running?`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* keep status text */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export const nurseApi = <T,>(path: string, body?: unknown) => api<T>(NURSE_API, path, body);
export const managerApi = <T,>(path: string, body?: unknown) => api<T>(MANAGER_API, path, body);

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Vancouver",
  });
}

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Vancouver",
  });
}

/** "2026-09-21" -> "Sep 21" */
export function fmtWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function addWeeks(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 7 * n)).toISOString().slice(0, 10);
}

export function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}
