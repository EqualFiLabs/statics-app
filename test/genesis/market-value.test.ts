import { getAddress, parseEther } from "viem";
import { describe, expect, it } from "vitest";

import { genesisAcquisitionCost, genesisBackingInNumeraire } from "@/lib/genesis/market-value";

const statics = getAddress("0x1111111111111111111111111111111111111111");
const weth = getAddress("0x7777777777777777777777777777777777777777");
const vaultPrice = parseEther("180000");

/** sqrtPriceX96 for a whole-number ratio of token1 per token0. */
function sqrtPriceFor(ratio: bigint): bigint {
  // Exact for perfect squares, which is all these cases use.
  let root = 1n;
  while (root * root < ratio) root += 1n;
  return root << 96n;
}

describe("Genesis backing valued at market", () => {
  it("multiplies out when STATICS is currency0", () => {
    // 1 WETH per STATICS: the whole 180,000 backing is worth 180,000 WETH.
    expect(genesisBackingInNumeraire(1n << 96n, statics, statics, vaultPrice)).toBe(vaultPrice);
  });

  it("inverts when STATICS is currency1", () => {
    // The pool then quotes STATICS per WETH, so the backing divides rather than
    // multiplies. Getting this backwards is the whole reason it is tested.
    expect(genesisBackingInNumeraire(1n << 96n, weth, statics, vaultPrice)).toBe(vaultPrice);

    const fourStaticsPerWeth = sqrtPriceFor(4n);
    expect(genesisBackingInNumeraire(fourStaticsPerWeth, weth, statics, vaultPrice)).toBe(
      vaultPrice / 4n
    );
  });

  it("scales with the price when STATICS is currency0", () => {
    const fourWethPerStatics = sqrtPriceFor(4n);
    expect(genesisBackingInNumeraire(fourWethPerStatics, statics, statics, vaultPrice)).toBe(
      vaultPrice * 4n
    );
  });

  it("keeps precision on a ratio far from one", () => {
    // A realistic launch price is a very small WETH-per-STATICS number. Routing
    // this through a float first would round the result to zero.
    const scaled = genesisBackingInNumeraire(1n << 80n, statics, statics, vaultPrice);
    expect(scaled).not.toBeNull();
    expect(scaled).toBeGreaterThan(0n);
    // (2^80)^2 / 2^192 = 2^-32 of the backing.
    expect(scaled).toBe(vaultPrice / 2n ** 32n);
  });

  it("reports no price rather than a misleading zero", () => {
    expect(genesisBackingInNumeraire(0n, statics, statics, vaultPrice)).toBeNull();
    expect(genesisBackingInNumeraire(1n << 96n, statics, statics, 0n)).toBeNull();
  });
});

describe("Genesis acquisition cost", () => {
  it("adds the native the Vault requires to the backing at market", () => {
    const backing = parseEther("0.378");
    const requiredNative = parseEther("0.0037");
    expect(genesisAcquisitionCost(backing, requiredNative)).toBe(backing + requiredNative);
  });

  it("stays correct across the Epoch boundary without branching on it", () => {
    // requiredNative already folds the buy-in in, and is fee-only during the
    // Epoch, so the same call covers both phases.
    const backing = parseEther("0.378");
    const duringEpoch = genesisAcquisitionCost(backing, parseEther("0.003"));
    const afterEpoch = genesisAcquisitionCost(backing, parseEther("0.0037532"));
    expect(afterEpoch).toBeGreaterThan(duringEpoch!);
  });

  it("propagates an absent price", () => {
    expect(genesisAcquisitionCost(null, parseEther("0.003"))).toBeNull();
  });
});
