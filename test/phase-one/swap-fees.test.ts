import { describe, expect, it } from "vitest";

import { swapFeePercent } from "@/lib/phase-one/swap-fees";

describe("swap fees", () => {
  it("reports the nominal sum of configured rates", () => {
    expect(swapFeePercent(3000, { inputBps: 5, outputBps: 5 })).toEqual({
      total: 0.4,
      lp: 0.3,
      statics: 0.1,
    });
    expect(swapFeePercent(500, { inputBps: 20, outputBps: 0 })).toEqual({
      total: 0.25,
      lp: 0.05,
      statics: 0.2,
    });
  });

  it("does not interpret unknown hook rates as zero", () => {
    expect(swapFeePercent(10_000, null)).toEqual({ total: null, lp: 1, statics: null });
  });
  it("keeps a confirmed zero hook rate distinct from unknown", () => {
    expect(swapFeePercent(10_000, { inputBps: 0, outputBps: 0 })).toEqual({
      total: 1,
      lp: 1,
      statics: 0,
    });
  });
});
