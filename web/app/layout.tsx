import type { Metadata } from "next";
import { Anton, Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const barlow = Barlow({ weight: ["400", "600", "700"], subsets: ["latin"], variable: "--font-barlow", display: "swap" });
const barlowCondensed = Barlow_Condensed({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FantaHezonja Champions",
  description: "Salary cap, contratti e bacheca della lega FantaNBA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${anton.variable} ${barlow.variable} ${barlowCondensed.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
