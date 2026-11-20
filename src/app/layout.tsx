import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/airguard/providers";

/**
 * Type system: IBM Plex Sans for body text, IBM Plex Mono for measured data
 * (instrument feel), Space Grotesk for display numerals and the wordmark.
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AirGuard AI — Winter Smog & Clean-Air Assistant",
  description:
    "A GenAI assistant that helps families and communities navigate severe winter smog and urban air pollution: live AQI, personalised advisories, AI coaching, low-emission daily routines and explained impact of every choice.",
  keywords: [
    "air quality",
    "AQI",
    "winter smog",
    "PM2.5",
    "clean air",
    "low-emission",
    "AI assistant",
    "family health",
  ],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "AirGuard AI",
    description: "Navigate winter smog with live data, AI coaching and explained impact.",
    siteName: "AirGuard AI",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#161411" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexMono.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
