import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { socialImageUrl } from "@/lib/public-metadata";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const socialImage = socialImageUrl(environment.siteUrl);

  return {
    metadataBase: environment.siteUrl ? new URL(environment.siteUrl) : undefined,
    title: {
      default: t("title"),
      template: t("titleTemplate", { page: "%s" }),
    },
    description: t("description"),
    icons: {
      icon: "/assets/statics-icon.png",
      apple: "/assets/statics-icon.png",
    },
    openGraph: {
      title: t("title"),
      description: t("socialDescription"),
      type: "website",
      images: socialImage ? [{ url: socialImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("socialDescription"),
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

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
