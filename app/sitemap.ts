import type { MetadataRoute } from "next";

import { publicRouteUrls } from "@/lib/public-metadata";
import { readPublicEnvironment } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const { siteUrl } = readPublicEnvironment();

  return publicRouteUrls(siteUrl).map((url) => ({
    url,
    changeFrequency: "weekly",
  }));
}
