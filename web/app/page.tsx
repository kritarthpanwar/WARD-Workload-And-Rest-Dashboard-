"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ArrowRight } from "lucide-react";
import { ErrorLine, More, ROLE_ICON } from "@/components/ui";
import { NURSE_API, Role, saveSession } from "@/lib/api";
import { auth } from "@/lib/firebase";

const HOME: Record<Role, string> = { nurse: "/nurse", charge_nurse: "/", manager: "/manager", joint_committee: "/committee", admin: "/trustee" };

const DEMO: { role: Role; uid: string; title: string; text: string }[] = [
  { role: "nurse", uid: "demo-nurse", title: "Nurse", text: "Alex R. — my shift, my breaks, my history" },
  { role: "manager", uid: "demo-manager", title: "Manager", text: "How each unit’s week went" },
  { role: "joint_committee", uid: "demo-committee", title: "Joint committee", text: "Reporting gap and who looked at what" },
  { role: "admin", uid: "demo-trustee", title: "Trustee", text: "Publishes the weekly numbers" },
];

const FRIENDLY: Record<string, string> = {
  "auth/invalid-credential": "That email and password don’t match an account.",
  "auth/invalid-email": "That doesn’t look like an email address.",
  "auth/email-already-in-use": "There is already an account for that email. Sign in instead.",
  "auth/weak-password": "Choose a password with at least 6 characters.",
  "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
};

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fail = (e: unknown) => {
    const code = (e as { code?: string }).code ?? "";
    setError(FRIENDLY[code] ?? (e as Error).message);
  };

  async function enter(create: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const cred = create ? await createUserWithEmailAndPassword(auth, email, password) : await signInWithEmailAndPassword(auth, email, password);
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
        await signOut(auth);
        setNotice(`We sent a confirmation link to ${email}. Open it, then sign in here.`);
        return;
      }
      const res = await fetch(`${NURSE_API}/session`, { method: "POST", headers: { Authorization: `Bearer ${await cred.user.getIdToken()}` } });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail ?? "Sign-in failed.");
      if (!body.role) {
        await signOut(auth);
        setNotice("You’re signed up. An administrator still needs to give your account a role.");
        return;
      }
      saveSession({ role: body.role, uid: body.uid, kind: "firebase" });
      router.push(HOME[body.role as Role]);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <div className="brand">
        <span className="logo">W</span> WARD
      </div>
      <h1>Sign in</h1>
      <p className="sub" style={{ marginTop: 6 }}>
        Every shift on the record: how heavy it was, and whether there was a break.
      </p>

      <form
        className="panel stack"
        style={{ maxWidth: 440, marginTop: 22 }}
        onSubmit={(e) => {
          e.preventDefault();
          enter(false);
        }}
      >
        <label className="field">
          Email
          <input type="text" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <ErrorLine error={error} />
        {notice && <div className="notice">{notice}</div>}
        <button className="primary big" type="submit" disabled={busy || !email || !password}>
          Sign in <ArrowRight size={18} />
        </button>
        <button type="button" className="link" disabled={busy || !email || !password} onClick={() => enter(true)}>
          New here? Create an account with this email and password
        </button>
      </form>

      <More title="Demo logins (no password)" open>
        <div className="who-list" style={{ marginTop: 0 }}>
          {DEMO.map((r) => {
            const Icon = ROLE_ICON[r.role];
            return (
              <button
                key={r.uid}
                onClick={() => {
                  saveSession({ role: r.role, uid: r.uid, kind: "demo" });
                  router.push(HOME[r.role]);
                }}
              >
                <span className="avatar">
                  <Icon size={24} />
                </span>
                <strong>{r.title}</strong>
                <span className="what">{r.text}</span>
              </button>
            );
          })}
        </div>
      </More>
    </div>
  );
}
