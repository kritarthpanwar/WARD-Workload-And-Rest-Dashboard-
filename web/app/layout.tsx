import type { Metadata, Viewport } from "next";
import { Archivo, Atkinson_Hyperlegible_Next } from "next/font/google";
import { ReactNode } from "react";
import { Shell } from "@/components/ui";
import "./globals.css";

// Archivo carries headings, labels and figures (it has a width axis); Atkinson Hyperlegible carries sentences.
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", axes: ["wdth"] });
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "WARD",
  description: "Automatic, dated, unit-specific records of nurse workload.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Applies the saved light/dark choice before first paint.
const THEME_SCRIPT = `try{if(localStorage.getItem('shiftload-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
