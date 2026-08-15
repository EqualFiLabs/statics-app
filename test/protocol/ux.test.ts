import { describe, expect, it } from "vitest";

import {
  applyPercent,
  bpsToPercentInput,
  parseRecipientAddress,
  percentInputToBps,
} from "@/lib/protocol/ux";

describe("user-facing protocol inputs", () => {
  it("scales known balances without rounding up", () => {
    expect(applyPercent(101n, 25)).toBe(25n);
    expect(applyPercent(101n, 100)).toBe(101n);
  });

  it("converts percent inputs without exposing basis points", () => {
    expect(percentInputToBps("0.05")).toBe(5);
    expect(percentInputToBps("75")).toBe(7_500);
    expect(bpsToPercentInput(25)).toBe("0.25");
    expect(percentInputToBps("100.01")).toBeNull();
  });

  it("normalizes recipients and rejects the zero address", () => {
    expect(parseRecipientAddress("0x0000000000000000000000000000000000000001")).toBe(
      "0x0000000000000000000000000000000000000001"
    );
    expect(parseRecipientAddress("0x0000000000000000000000000000000000000000")).toBeNull();
    expect(parseRecipientAddress("not an address")).toBeNull();
  });
});
