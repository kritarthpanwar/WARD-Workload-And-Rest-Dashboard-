"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import { Role, saveSession } from "@/lib/api";

const ROLES: { role: Role; uid: string; href: string; icon: string; title: string; text: string }[] = [
  { role: "nurse", uid: "demo-nurse", href: "/nurse", icon: "heart", title: "Nurse", text: "Alex R. — my shift, my breaks, my history" },
  { role: "nurse", uid: "demo-nurse-2", href: "/nurse", icon: "heart", title: "Second nurse", text: "Sam K. — for trying relief requests" },
  { role: "charge_nurse", uid: "demo-charge", href: "/relief", icon: "hand", title: "Relief recipient", text: "Who is asking for relief right now" },
  { role: "manager", uid: "demo-manager", href: "/manager", icon: "chart", title: "Manager", text: "How each unit’s week went" },
  { role: "joint_committee", uid: "demo-committee", href: "/committee", icon: "people", title: "Joint committee", text: "Reporting gap and who looked at what" },
  { role: "admin", uid: "demo-trustee", href: "/trustee", icon: "shield", title: "Trustee", text: "Publishes the weekly numbers" },
];

export default function Home() {
  const router = useRouter();
  return (
    <main>
      <h1>ShiftLoad</h1>
      <p className="sub" style={{ maxWidth: 620, marginBottom: 20 }}>
        An automatic record of how heavy each nursing shift was and whether there was a chance to recover.
      </p>
      <div className="section-title" style={{ marginTop: 0 }}>Who are you?</div>
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
            <span className="avatar">
              <Icon name={r.icon} />
            </span>
            <span>
              <strong>{r.title}</strong>
              <span>{r.text}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 18 }}>
        Demo sign-in: tap a role. Real sign-in is not connected yet.
      </p>
    </main>
  );
}
