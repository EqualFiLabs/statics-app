import { describe, expect, it, vi } from "vitest";
import { toHex, type PublicClient } from "viem";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { readPublicLiquidityFees } from "@/lib/phase-one/liquidity";

const diamond = "0x1111111111111111111111111111111111111111" as const;
const poolId = `0x${"2".repeat(64)}` as const;
const deployment: PhaseOneDeployment = {
  kind: "phase-one",
  descriptor: {
    deploymentId: "fee-test",
    label: "Fee test",
    network: "anvil",
    chainId: 4663,
    stage: "phase-one",
    capabilities: ["public-lp-positions"],
    available: true,
  },
  deploymentStartBlock: 0n,
  protocolCommit: "test",
  sdkCommit: "test",
  installedPhase: 1,
  source: "development-fixture",
  contracts: {
    diamond,
    timelock: diamond,
    publicHook: diamond,
    liquidityManager: diamond,
    statics: diamond,
    weth: diamond,
    poolManager: diamond,
    positionManager: diamond,
    permit2: diamond,
    quoter: diamond,
    stateView: diamond,
    universalRouter: diamond,
  },
  runtimeCodeHashes: {},
  facets: [],
  supportedPools: [],
};
describe("managed liquidity fee estimates", () => {
  it.each([0n, 1n << 128n])(
    "keeps token rounding and zero-fee assets accurate for growth %s",
    async (growth) => {
      const readContract = vi
        .fn()
        .mockImplementation(async ({ functionName }) =>
          functionName === "getPositionInfo" ? [10n ** 18n, 0n, 0n] : [growth, 2n << 128n]
        );
      const fees = await readPublicLiquidityFees({
        publicClient: { readContract } as unknown as PublicClient,
        deployment,
        poolId,
        posmTokenId: 30n,
        tickLower: -60,
        tickUpper: 60,
      });
      expect(fees).toEqual({ amount0: growth === 0n ? 0n : 10n ** 18n, amount1: 2n * 10n ** 18n });
      expect(readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getPositionInfo",
          args: [poolId, diamond, -60, 60, toHex(30n, { size: 32 })],
        })
      );
      expect(readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getFeeGrowthInside",
          args: [poolId, -60, 60],
        })
      );
    }
  );
});
