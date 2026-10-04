import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { ReactNode } from "react";
import { Shell } from "@/components/ui";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "WARD",
  description: "Automatic, dated, unit-specific records of nurse workload.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Applies the saved light/dark choice before first paint.
const THEME_SCRIPT = `try{if(localStorage.getItem('shiftload-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
