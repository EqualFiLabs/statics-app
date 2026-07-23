import { describe, expect, it } from "vitest";

import { readDappPreviewMode } from "@/lib/dapp-preview";

describe("DApp sample preview mode", () => {
  it("defaults on only in development", () => {
    expect(readDappPreviewMode({})).toBe(true);
    expect(readDappPreviewMode({ NEXT_PUBLIC_APP_ENV: "development" })).toBe(true);
    expect(readDappPreviewMode({ NEXT_PUBLIC_APP_ENV: "staging" })).toBe(false);
    expect(readDappPreviewMode({ NEXT_PUBLIC_APP_ENV: "production" })).toBe(false);
  });

  it("allows development to opt out", () => {
    expect(
      readDappPreviewMode({
        NEXT_PUBLIC_APP_ENV: "development",
        NEXT_PUBLIC_DAPP_PREVIEW: "false",
      })
    ).toBe(false);
  });

  it("rejects invalid values and sample mode outside development", () => {
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
