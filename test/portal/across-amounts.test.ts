import { describe, expect, it } from "vitest";

import { parseAcrossAmount } from "@/lib/portal/across";

describe("parseAcrossAmount", () => {
  it("reads the shapes Across actually returns", () => {
    expect(parseAcrossAmount("1000000")).toBe(1_000_000n);
    expect(parseAcrossAmount("0x0f4240")).toBe(1_000_000n);
    expect(parseAcrossAmount(1_000_000)).toBe(1_000_000n);
    expect(parseAcrossAmount(1_000_000n)).toBe(1_000_000n);
  });

  // The crash this exists to prevent: fees.total arrives as an object while
  // outputAmount beside it is a plain string, and BigInt() on the object throws
  // during render, taking the panel down through the error boundary.
  it("unwraps an amount carried inside an object", () => {
    expect(parseAcrossAmount({ amount: "2500", amountUsd: "2.50" })).toBe(2_500n);
    expect(parseAcrossAmount({ total: 42 })).toBe(42n);
    expect(parseAcrossAmount({ value: "0x10" })).toBe(16n);
  });

  it("returns null instead of throwing on anything it cannot read", () => {
    for (const value of [
      undefined,
      null,
      "",
      "abc",
      "1.5",
      -1,
      1.5,
      {},
      { amount: "not a number" },
      { amount: { amount: "1" } },
      [],
    ]) {
      expect(parseAcrossAmount(value), JSON.stringify(value) ?? "undefined").toBeNull();
    }
  });
});
