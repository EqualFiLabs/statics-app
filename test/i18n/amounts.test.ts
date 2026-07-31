import { describe, expect, it } from "vitest";

import { normalizeLocalizedDecimal, parseLocalizedUnits } from "@/lib/i18n/amounts";

describe("localized decimal amounts", () => {
  it("accepts Spanish comma decimals and canonical dot decimals", () => {
    expect(normalizeLocalizedDecimal("1,25", "es")).toBe("1.25");
    expect(normalizeLocalizedDecimal("1.25", "es")).toBe("1.25");
    expect(parseLocalizedUnits("1,25", 6, "es")).toBe(1_250_000n);
  });

  it("keeps English and Chinese transaction amounts canonical", () => {
    expect(parseLocalizedUnits("1.25", 6, "en")).toBe(1_250_000n);
    expect(parseLocalizedUnits("1.25", 6, "zh-CN")).toBe(1_250_000n);
    expect(() => parseLocalizedUnits("1,25", 6, "en")).toThrow();
  });

  it("rejects grouped, mixed, signed, and exponential notation", () => {
    for (const value of ["1,234.56", "1.234,56", "1 000", "-1", "+1", "1e3"]) {
      expect(normalizeLocalizedDecimal(value, "es"), value).toBeNull();
    }
  });
});
