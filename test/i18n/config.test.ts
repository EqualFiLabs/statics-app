import { describe, expect, it } from "vitest";

import { resolveRequestLocale } from "@/i18n/config";

describe("locale negotiation", () => {
  it("gives a validated cookie precedence over browser preferences", () => {
    expect(resolveRequestLocale("es", "zh-CN,zh;q=0.9")).toBe("es");
  });

  it("uses weighted supported browser preferences", () => {
    expect(resolveRequestLocale(undefined, "fr;q=0.9,es-MX;q=0.8,en;q=0.7")).toBe("es");
    expect(resolveRequestLocale(undefined, "es;q=0.4,zh-Hans;q=0.9")).toBe("zh-CN");
  });

  it("does not send Traditional Chinese readers to Simplified Chinese", () => {
    expect(resolveRequestLocale(undefined, "zh-TW,zh-Hant;q=0.9,en;q=0.8")).toBe("en");
  });

  it("falls back to English for invalid cookies and unsupported browsers", () => {
    expect(resolveRequestLocale("de", "fr-CA")).toBe("en");
    expect(resolveRequestLocale(undefined, null)).toBe("en");
  });
});
