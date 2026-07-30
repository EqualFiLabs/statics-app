import { describe, expect, it } from "vitest";

import { focusRewardPositions, readRewardPositionFocus } from "@/lib/rewards/navigation";

describe("reward position focus", () => {
  it("accepts one unsigned position ID and rejects malformed state", () => {
    expect(readRewardPositionFocus("42")).toBe(42n);
    expect(readRewardPositionFocus("-1")).toBeNull();
    expect(readRewardPositionFocus(["1", "2"])).toBeNull();
  });

  it("moves an owned position first without inventing unknown positions", () => {
    const positions = [{ positionId: 1n }, { positionId: 2n }];
    expect(focusRewardPositions(positions, 2n).map((position) => position.positionId)).toEqual([
      2n,
      1n,
    ]);
    expect(focusRewardPositions(positions, 9n)).toBe(positions);
  });
});
