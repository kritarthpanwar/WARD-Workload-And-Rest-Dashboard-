"use client";

import { NurseGate, Settings } from "@/components/nurse";

export default function NurseSettingsPage() {
  return <NurseGate>{(me, reload) => <Settings me={me} reload={reload} />}</NurseGate>;
}
