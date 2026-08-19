import { describe, expect, it } from "vitest";

import { nextAvailableGenesisId } from "../src/genesis";

describe("nextAvailableGenesisId", () => {
  it("returns the first token still owned by the vault", () => {
    expect(nextAvailableGenesisId([1n, 2n, 4n])).toBe(3n);
  });

  it("returns the first token when no circulating NFT rows exist", () => {
    expect(nextAvailableGenesisId([])).toBe(1n);
  });

  it("returns null only when every Genesis NFT is circulating", () => {
    const circulating = Array.from({ length: 5_555 }, (_, index) => BigInt(index + 1));
    expect(nextAvailableGenesisId(circulating)).toBeNull();
  });
});
