import type { MetadataRoute } from "next";

import { readPublicEnvironment } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = readPublicEnvironment();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: siteUrl ? new URL("/sitemap.xml", siteUrl).toString() : undefined,
  };
}
