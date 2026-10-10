import { afterEach, describe, expect, it, vi } from "vitest";
import { readHiddenPositions, writeHiddenPositions } from "@/lib/rewards/hidden-positions";
afterEach(() => vi.restoreAllMocks());
describe("hidden position preferences", () => {
  it("uses session memory when writes fail but reads still succeed", () => {
    const wallet = `0x${"5".repeat(40)}`;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    writeHiddenPositions("quota-fixture", wallet, ["12", "12"]);
    expect(readHiddenPositions("quota-fixture", wallet)).toEqual(["12"]);
    expect(readHiddenPositions("other-fixture", wallet)).toEqual([]);
  });
});
