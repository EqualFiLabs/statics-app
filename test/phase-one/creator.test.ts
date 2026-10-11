import { decodeFunctionData, getAddress, zeroAddress, type PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import { staticsAbi } from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  claimAsset,
  creatorAbi,
  creatorCalls,
  indexedCreatorPools,
  readCreatorPool,
  readPoolRewards,
  resolveTokens,
} from "@/lib/phase-one/creator";
import { getDappRouteCapability, getDappRouteId } from "@/lib/dapp-navigation";
import { protocolQueryScopes } from "@/lib/protocol/reconciliation";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const weth = address("3");
const poolId = `0x${"a".repeat(64)}` as const;
const deployment = {
  contracts: { diamond: address("1"), publicHook: address("4") },
} as PhaseOneDeployment;
const token = (a: `0x${string}`, symbol: string) => ({
  address: a,
  symbol,
  name: symbol,
  decimals: 18,
  metadataSource: "reviewed-manifest" as const,
});

describe("pool creator controls", () => {
  it("claims native revenue as WETH and keeps ERC-20 revenue in its own token", () => {
    expect(claimAsset(zeroAddress, weth)).toBe(weth);
    expect(claimAsset(address("2"), weth)).toBe(address("2"));
  });

  it("keeps decommissioned creator pools available for existing revenue claims", () => {
    const pool = (creator: `0x${string}`, decommissioned = false) =>
      ({ poolId, creator, decommissioned }) as never;
    expect(
      indexedCreatorPools(
        [pool(address("9")), pool(address("8")), pool(address("9"), true)],
        address("9")
      )
    ).toHaveLength(2);
  });

  it("encodes recipient, handover, claim and POL activation against the Diamond", () => {
    const recipient = creatorCalls.setRecipient(deployment, poolId, address("7"));
    expect(recipient.to).toBe(deployment.contracts.diamond);
    expect(decodeFunctionData({ abi: creatorAbi, data: recipient.data }).args).toEqual([
      poolId,
      address("7"),
    ]);
    // Proposing address zero cancels a pending handover.
    expect(
      decodeFunctionData({
        abi: creatorAbi,
        data: creatorCalls.propose(deployment, poolId, zeroAddress).data,
      }).args
    ).toEqual([poolId, zeroAddress]);
    const claim = decodeFunctionData({
      abi: staticsAbi,
      data: creatorCalls.claim(deployment, poolId, weth, address("7"), 5n).data,
    });
    expect(claim.functionName).toBe("claimCreatorRevenue");
    expect(claim.args).toEqual([poolId, weth, address("7"), 5n]);
    expect(creatorCalls.activatePol(deployment, poolId, 25n).value).toBe(25n);
  });

  it("reads pending revenue per currency and settled credit once for an ETH/WETH pool", async () => {
    const read = vi.fn(async ({ functionName, args }) => {
      if (functionName === "poolCreatorConfiguration")
        return [address("9"), zeroAddress, address("9")];
      if (functionName === "pendingFeeDistribution")
        return {
          basketStaker: 0n,
          staticsStaker: 0n,
          creator: args[1] === zeroAddress ? 7n : 3n,
          treasury: 0n,
        };
      if (functionName === "creatorRevenue") return 11n;
      if (functionName === "protocolPolFundingConfig") return [false, false, 0];
      if (functionName === "protocolPolActivationFee") return 25n;
      if (functionName === "poolRewardConfig")
        return {
          initialized: true,
          slotCount: 1,
          assets: [address("5"), zeroAddress, zeroAddress, zeroAddress, zeroAddress],
          allocatorShareBps: [0, 0, 0, 0, 0],
        };
      if (functionName === "gaugePool") return { initialized: true, stopped: false };
      if (functionName === "gaugeRewardDuration") return 604_800;
      if (functionName === "poolRewardStream")
        return { periodFinish: 2_000, periodBudget: 10n, periodEmitted: 4n };
      throw new Error(functionName);
    });
    const client = {
      readContract: read,
      getBlock: async () => ({ timestamp: 1_000n }),
    } as unknown as PublicClient;
    const state = await readCreatorPool(
      client,
      deployment,
      {
        poolId,
        poolKey: {
          currency0: zeroAddress,
          currency1: weth,
          fee: 3000,
          tickSpacing: 60,
          hooks: address("4"),
        },
        token0: token(zeroAddress, "ETH"),
        token1: token(weth, "WETH"),
      },
      weth
    );
    expect(state.pending.map((entry) => entry.amount)).toEqual([7n, 3n]);
    expect(state.settled).toEqual([{ asset: weth, amount: 11n }]);
    expect(state.pendingCreator).toBeNull();
    expect(read.mock.calls.map(([call]) => call.functionName)).not.toContain("poolRewardStream");
    const rewards = await readPoolRewards(client, deployment, poolId);
    expect(rewards.rewards).toEqual([
      { slot: 0, asset: address("5"), allocatorShareBps: 0, periodFinish: 2_000n, remaining: 6n },
    ]);
    const expired = await readPoolRewards(
      { ...client, getBlock: async () => ({ timestamp: 3_000n }) } as PublicClient,
      deployment,
      poolId
    );
    expect(expired.rewards[0]!.remaining).toBe(6n); // Stored budget is not a live emission estimate.
  });

  it("keeps known metadata and tolerates individual reward-token getter failures", async () => {
    const missing = address("6");
    const unreadable = address("7");
    const client = {
      readContract: vi.fn(async ({ address: asset, functionName }) => {
        if (asset === unreadable || functionName !== "decimals") throw new Error("No metadata");
        return 6;
      }),
    } as unknown as PublicClient;
    const known = new Map([[weth.toLowerCase(), token(weth, "WETH")]]);
    const result = await resolveTokens(client, [weth, missing, unreadable], known);
    expect(result.get(weth.toLowerCase())).toEqual(token(weth, "WETH"));
    expect(result.get(missing.toLowerCase())).toMatchObject({ decimals: 6, address: missing });
    expect(result.has(unreadable.toLowerCase())).toBe(false);
  });

  it("routes the creator page under Liquidity and refreshes pool state after creator actions", () => {
    expect(getDappRouteId("/app/liquidity/creator")).toBe("liquidityCreator");
    expect(getDappRouteCapability("/app/liquidity/creator")).toBe("protocol-liquidity");
    expect(protocolQueryScopes("phase-one-creator-claim")).toContain("phase-one-market");
    expect(protocolQueryScopes("phase-one-fund-incentives")).toContain("phase-one-liquidity");
    expect(protocolQueryScopes("phase-one-settle-revenue")).toContain("wallet");
    expect(protocolQueryScopes("phase-one-creator-reward-share")).toContain("phase-one-reward");
  });
});
