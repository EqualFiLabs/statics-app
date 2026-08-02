import { afterEach, describe, expect, it, vi } from "vitest";

import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { publicAssetUrl, publicRouteUrls, socialImageUrl } from "@/lib/public-metadata";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public metadata", () => {
  it("does not invent public URLs when the deployment origin is unset", () => {
    expect(socialImageUrl(null)).toBeNull();
    expect(publicRouteUrls(null)).toEqual([]);
  });

  it("builds absolute social and application URLs from the configured origin", () => {
    expect(socialImageUrl("https://statics.example/")).toBe(
      "https://statics.example/assets/robin-hood-hero.png"
    );
    expect(publicAssetUrl("https://statics.example/base", "/assets/statics-icon.png")).toBe(
      "https://statics.example/assets/statics-icon.png"
    );

    const routes = publicRouteUrls("https://statics.example/");
    expect(routes).toContain("https://statics.example/");
    expect(routes).toContain("https://statics.example/app");
    expect(routes).toContain("https://statics.example/app/dollar");
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("publishes crawler and install metadata from the configured origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://statics.example");

    expect(robots()).toMatchObject({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://statics.example/sitemap.xml",
    });
    expect(sitemap()).toContainEqual({
      url: "https://statics.example/app/dollar",
      changeFrequency: "weekly",
    });
    expect(manifest()).toMatchObject({
      name: "Statics App",
      start_url: "/app",
      display: "standalone",
    });
  });
});
