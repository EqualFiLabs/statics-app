import { describe, expect, it } from "vitest";

import { readEvesMarketUrl, readPublicEnvironment } from "@/lib/site-config";

describe("public environment", () => {
  it("defaults to a development environment without inventing a site URL", () => {
    expect(readPublicEnvironment({})).toEqual({
      appEnvironment: "development",
      siteUrl: null,
    });
  });

  it("accepts an absolute HTTP(S) production URL", () => {
    expect(
      readPublicEnvironment({
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://statics.example",
      })
    ).toEqual({
      appEnvironment: "production",
      siteUrl: "https://statics.example/",
    });
  });

  it("fails closed for invalid environments and production without a site URL", () => {
    expect(() => readPublicEnvironment({ NEXT_PUBLIC_APP_ENV: "preview" })).toThrow(
      "NEXT_PUBLIC_APP_ENV"
    );
    expect(() => readPublicEnvironment({ NEXT_PUBLIC_APP_ENV: "production" })).toThrow(
      "NEXT_PUBLIC_SITE_URL is required"
    );
    expect(() => readPublicEnvironment({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" })).toThrow(
      "must use HTTP or HTTPS"
    );
  });
});

describe("Eves Market handoff", () => {
  it("keeps the handoff unavailable until a destination is configured", () => {
    expect(readEvesMarketUrl(undefined)).toBeNull();
  });

  it("accepts credential-free HTTP destinations and rejects embedded credentials", () => {
    expect(readEvesMarketUrl("https://trade.example.test/dollar")).toBe(
      "https://trade.example.test/dollar"
    );
    expect(() => readEvesMarketUrl("https://user:secret@example.test")).toThrow("credential-free");
  });
});
