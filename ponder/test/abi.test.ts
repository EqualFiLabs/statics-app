import { describe, expect, it } from "vitest";
import {
  staticsAbi,
  staticsGaugeIncentivesAbi,
  staticsMarketTapeAbi,
  staticsRangeGaugeAbi,
} from "@statics-protocol/sdk/phase-one";
import { uniqueAbi } from "../src/abi";
describe("combined Phase 1 ABI", () => {
  it("registers each identical event exactly once", () => {
    const combined = [
      ...staticsAbi,
      ...staticsGaugeIncentivesAbi,
      ...staticsMarketTapeAbi,
      ...staticsRangeGaugeAbi,
    ];
    const unique = uniqueAbi(combined);
    expect(unique.length).toBeLessThan(combined.length);
    expect(
      unique.filter((item) => item.type === "event" && item.name === "PositionGaugeAllocationsSet")
    ).toHaveLength(1);
    expect(
      unique.filter((item) => item.type === "event" && item.name === "MarketSwapRecorded")
    ).toHaveLength(1);
  });
});
