import type { Metadata } from "next";
import { IBM_Plex_Sans, Instrument_Serif, Newsreader } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { Providers } from "@/components/Providers";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-display",
});

/** Wordmark — editorial precision for clinical discovery (distinct from page titles). */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-brand",
});

export const metadata: Metadata = {
  title: "Arclight Bio — Discovery Program",
  description:
    "The discovery engine that finds what your experts don't know to look for",
  themeColor: "#FDFAF5",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${ibmPlexSans.variable} ${newsreader.variable} ${instrumentSerif.variable} font-sans antialiased`}
      >
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
