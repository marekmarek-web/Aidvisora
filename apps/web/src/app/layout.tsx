import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "../styles/monday.css";
import "../styles/weplan-theme.css";
import "../styles/weplan-components.css";
import "../styles/weplan-calendar.css";
import { TooltipBlurListener } from "./components/TooltipBlurListener";

const dmSans = DM_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "Aidvisora – Portál poradce",
  description: "CRM pro finanční poradce v ČR. Domácnosti, pipeline, meeting notes, smlouvy.",
  icons: { icon: "/favicon.png", apple: "/favicon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className={dmSans.className}>
        <TooltipBlurListener />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
