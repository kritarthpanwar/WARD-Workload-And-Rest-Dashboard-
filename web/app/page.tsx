"use client";

import { useRouter } from "next/navigation";
import { Role, saveSession } from "@/lib/api";

const ROLES: { role: Role; uid: string; href: string; title: string; text: string }[] = [
  {
    role: "nurse",
    uid: "demo-nurse",
    href: "/nurse",
    title: "Nurse — Alex R.",
    text: "Own live card, end-of-shift card, relief request, red-shift history, report draft.",
  },
  {
    role: "nurse",
    uid: "demo-nurse-2",
    href: "/nurse",
    title: "Nurse — Sam K.",
    text: "A second nurse login, for trying relief requests from two people.",
  },
  {
    role: "charge_nurse",
    uid: "demo-charge",
    href: "/relief",
    title: "Relief recipient",
    text: "Sees “Relief requested — name” and nothing else. Gone when handled.",
  },
  {
    role: "manager",
    uid: "demo-manager",
    href: "/manager",
    title: "Manager",
    text: "Weekly published release only: heatmap, flags, summary, comparisons, action log.",
  },
  {
    role: "joint_committee",
    uid: "demo-committee",
    href: "/committee",
    title: "Joint committee",
    text: "Weekly report, reporting gap, relief counts and the access log.",
  },
  {
    role: "admin",
    uid: "demo-trustee",
    href: "/trustee",
    title: "Trustee admin",
    text: "Runs the weekly release job that fills the published tables.",
  },
];

export default function Home() {
  const router = useRouter();
  return (
    <main>
      <h1>ShiftLoad</h1>
      <p className="sub" style={{ maxWidth: 720 }}>
        Turns every opted-in nurse shift into an automatic, dated, unit-specific record of physical load and
        recovery opportunity. It measures and documents workload. It does not diagnose anything.
      </p>
      <div className="banner info">
        Development sign-in: pick a role. Real sign-in (Firebase Auth with role claims) is not connected yet.
      </div>
      <div className="role-grid">
        {ROLES.map((r) => (
          <button
            key={r.uid}
            className="role-card"
            onClick={() => {
              saveSession({ role: r.role, uid: r.uid });
              router.push(r.href);
            }}
          >
            <strong>{r.title}</strong>
            <span>{r.text}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
