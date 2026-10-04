"use client";

import { NurseGate, Today } from "@/components/nurse";

export default function NursePage() {
  return <NurseGate>{(me) => <Today me={me} />}</NurseGate>;
}
