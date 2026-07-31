import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { readPublicEnvironment } from "@/lib/site-config";

import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-loaded",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-mono-loaded",
});

const environment = readPublicEnvironment();

export const metadata: Metadata = {
  metadataBase: environment.siteUrl ? new URL(environment.siteUrl) : undefined,
  title: {
    default: "Statics Protocol",
    template: "%s | Statics Protocol",
  },
  description:
    "Statics unifies static multi-asset baskets, position-owned finance, and protocol-owned liquidity with a native dollar.",
  icons: {
    icon: "/assets/statics-icon.png",
    apple: "/assets/statics-icon.png",
  },
  openGraph: {
    title: "Statics Protocol",
    description: "Static assets. Static rules. Dynamic markets. Own your position.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Statics Protocol",
    description: "Static assets. Static rules. Dynamic markets. Own your position.",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  return (
    <html lang={locale} className={`${sans.variable} ${mono.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
