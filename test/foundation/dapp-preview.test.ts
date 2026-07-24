import { describe, expect, it } from "vitest";

import { readDappPreviewMode } from "@/lib/dapp-preview";

describe("DApp unavailable-data preview mode", () => {
  it("defaults off in every environment", () => {
    expect(readDappPreviewMode({})).toBe(false);
    expect(readDappPreviewMode({ NEXT_PUBLIC_APP_ENV: "development" })).toBe(false);
    expect(readDappPreviewMode({ NEXT_PUBLIC_APP_ENV: "staging" })).toBe(false);
    expect(readDappPreviewMode({ NEXT_PUBLIC_APP_ENV: "production" })).toBe(false);
  });

  it("allows only development to opt in", () => {
    expect(
      readDappPreviewMode({
        NEXT_PUBLIC_APP_ENV: "development",
        NEXT_PUBLIC_DAPP_PREVIEW: "true",
      })
    ).toBe(true);
  });

  it("rejects invalid values and preview mode outside development", () => {
    expect(() =>
      readDappPreviewMode({
        NEXT_PUBLIC_APP_ENV: "development",
        NEXT_PUBLIC_DAPP_PREVIEW: "yes",
      })
    ).toThrow("must be true or false");
    expect(() =>
      readDappPreviewMode({
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_DAPP_PREVIEW: "true",
      })
    ).toThrow("only in development");
  });
});
