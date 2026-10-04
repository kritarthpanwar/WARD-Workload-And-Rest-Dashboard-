"use client";

import { useRouter } from "next/navigation";
import { ROLE_ICON } from "@/components/ui";
import { Role, saveSession } from "@/lib/api";

const ROLES: { role: Role; uid: string; href: string; title: string; text: string }[] = [
  { role: "nurse", uid: "demo-nurse", href: "/nurse", title: "Nurse", text: "Alex R. — my shift, my breaks, my history" },
  { role: "nurse", uid: "demo-nurse-2", href: "/nurse", title: "Second nurse", text: "Sam K. — for trying relief requests" },
  { role: "charge_nurse", uid: "demo-charge", href: "/relief", title: "Relief recipient", text: "Who is asking for relief right now" },
  { role: "manager", uid: "demo-manager", href: "/manager", title: "Manager", text: "How each unit’s week went" },
  { role: "joint_committee", uid: "demo-committee", href: "/committee", title: "Joint committee", text: "Reporting gap and who looked at what" },
  { role: "admin", uid: "demo-trustee", href: "/trustee", title: "Trustee", text: "Publishes the weekly numbers" },
];

export default function Home() {
  const router = useRouter();
  return (
    <div className="signin">
      <div className="brand">
        <span className="logo">W</span> WARD
      </div>
      <h1>Who are you?</h1>
      <p className="sub" style={{ marginTop: 6 }}>
        Every shift on the record: how heavy it was, and whether there was a break.
      </p>
      <div className="who-list">
        {ROLES.map((r) => {
          const Icon = ROLE_ICON[r.role];
          return (
            <button
              key={r.uid}
              onClick={() => {
                saveSession({ role: r.role, uid: r.uid });
                router.push(r.href);
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
      <p className="muted" style={{ marginTop: 16 }}>
        Demo sign-in: pick who you are. Real sign-in is not connected yet.
      </p>
    </div>
  );
}
