"use client";

import { History, NurseGate } from "@/components/nurse";

export default function NurseHistoryPage() {
  return <NurseGate>{() => <History />}</NurseGate>;
}
