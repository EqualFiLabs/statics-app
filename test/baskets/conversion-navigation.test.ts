import { describe, expect, it } from "vitest";

import {
  positionSelection,
  readBasketConversionAction,
  readBasketPositionFocus,
  recommendedMintSelection,
  selectedPositionId,
} from "@/lib/baskets/conversion-navigation";

describe("basket conversion navigation", () => {
  it("accepts only supported conversion actions", () => {
    expect(readBasketConversionAction("redeem")).toBe("redeem");
    expect(readBasketConversionAction(["mint", "redeem"])).toBe("mint");
    expect(readBasketConversionAction("swap")).toBe("mint");
    expect(readBasketConversionAction(undefined)).toBe("mint");
  });

  it("accepts only unsigned position identifiers", () => {
    expect(readBasketPositionFocus("42")).toBe(42n);
    expect(readBasketPositionFocus(["9", "10"])).toBe(9n);
    expect(readBasketPositionFocus("-1")).toBeNull();
    expect(readBasketPositionFocus("position:1")).toBeNull();
  });

  it("defaults new wallets to a new position and returning wallets to their latest position", () => {
    expect(recommendedMintSelection([])).toBe("new-position");
    expect(
      recommendedMintSelection([{ positionId: 3n }, { positionId: 12n }, { positionId: 7n }])
    ).toBe("position:12");
  });

  it("round-trips owned position selections", () => {
    expect(positionSelection(18n)).toBe("position:18");
    expect(selectedPositionId("position:18")).toBe(18n);
    expect(selectedPositionId("wallet")).toBeNull();
    expect(selectedPositionId("new-position")).toBeNull();
  });
});
