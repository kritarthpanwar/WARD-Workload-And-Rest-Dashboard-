import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";
import { TopBar } from "@/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShiftLoad",
  description: "Automatic, dated, unit-specific records of nurse workload.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopBar />
        {children}
        <footer className="disclaimer">Workload documentation tool — not a medical device.</footer>
      </body>
    </html>
  );
}
