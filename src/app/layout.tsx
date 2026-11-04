import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const bravura = localFont({
  src: "../fonts/Bravura.woff2",
  variable: "--font-music",
  display: "block",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Ledger — read the staff, play the key",
  description:
    "A virtual piano for learning to read music. Play and watch notes appear on a treble staff, or read a melody and press the key it asks for. Each pitch shows its fundamental and harmonic series.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${display.variable} ${bravura.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
