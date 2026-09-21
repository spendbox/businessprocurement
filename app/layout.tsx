import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Fonts are self-hosted (latin subset, variable weight axis). That is one
 * fewer third-party connection on first paint than loading them from
 * Google, and the two files together are under 70KB.
 */
const display = localFont({
  src: "./fonts/bricolage-latin-var.woff2",
  weight: "400 800",
  style: "normal",
  variable: "--font-display-loaded",
  display: "swap",
  preload: true,
  fallback: ["Georgia", "serif"],
});

const sans = localFont({
  src: "./fonts/manrope-latin-var.woff2",
  weight: "200 800",
  style: "normal",
  variable: "--font-sans-loaded",
  display: "swap",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://spendbox.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Spendbox — tell us what your business needs to buy",
    template: "%s · Spendbox",
  },
  description:
    "B2B procurement without the catalog. Describe what your business needs in one field, and we come back with the best offers from vetted merchants — usually within 24 hours.",
  keywords: [
    "B2B procurement",
    "business supplies",
    "sourcing",
    "purchase requests",
    "vendor marketplace",
    "Nigeria procurement",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Spendbox",
    title: "Spendbox — tell us what your business needs to buy",
    description:
      "One message is the whole process. Real people source it, compare offers and come back with the best ones.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spendbox — tell us what your business needs to buy",
    description:
      "One message is the whole process. Real people source it, compare offers and come back with the best ones.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f5f4ed",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
