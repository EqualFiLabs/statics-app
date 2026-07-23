import type { Metadata } from "next";

import { readPublicEnvironment } from "@/lib/site-config";

import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
