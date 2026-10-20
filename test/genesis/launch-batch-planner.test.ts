import { describe, expect, it } from "vitest";
import { decodeFunctionData, getAddress } from "viem";
import { dopplerStaticsTokenAbi, staticsGenesisAbi } from "@statics-protocol/sdk";

import type { LaunchDeployment } from "@/lib/deployments/types";
import type { OwnedGenesis } from "@/lib/genesis/owned";
import { buildLaunchBatchPreview } from "@/lib/genesis/launch-batch-planner";

const wallet = getAddress("0x1111111111111111111111111111111111111111");
const statics = getAddress("0x2222222222222222222222222222222222222222");
const activationRegistry = getAddress("0x3333333333333333333333333333333333333333");
const vault = getAddress("0x4444444444444444444444444444444444444444");
const genesis = getAddress("0x5555555555555555555555555555555555555555");
const distributor = getAddress("0x6666666666666666666666666666666666666666");
const deployment = {
  contracts: { statics, activationRegistry, vault, genesis, launchDistributor: distributor },
} as LaunchDeployment;
const item = (id: bigint, patch: Partial<OwnedGenesis> = {}): OwnedGenesis => ({
  id,
  tier: 0,
  multiplierBps: 10_000,
  registered: false,
  rewardWeight: 0n,
  pendingStatics: 0n,
  pendingWeth: 0n,
  creditActive: false,
  creditPrincipal: 0n,
  creditMaturity: 0,
  ...patch,
});

describe("launch Operator batch planner", () => {
  it("aggregates activation cost and contains an exact temporary approval", () => {
    const preview = buildLaunchBatchPreview({
      action: "activate",
      deployment,
      selected: [item(1n), item(2n, { tier: 1 })],
      wallet,
      targetTier: 2,
      tierCosts: [0n, 10n, 20n, 30n, 40n],
      staticsBalance: 100n,
      currentAllowance: 0n,
    });
    expect(preview.tokenAmount).toBe(50n);
    expect(preview.approvalAmount).toBe(50n);
    expect(preview.batch.labels).toEqual([
      "approve exact STATICS amount",
      "activate Operator #1",
      "activate Operator #2",
      "revoke temporary STATICS approval",
    ]);
    expect(
      decodeFunctionData({ abi: dopplerStaticsTokenAbi, data: preview.batch.calls[0].data }).args
    ).toEqual([activationRegistry, 50n]);
    expect(
      decodeFunctionData({ abi: dopplerStaticsTokenAbi, data: preview.batch.calls[3].data }).args
    ).toEqual([activationRegistry, 0n]);
  });

  it("does not change an existing sufficient approval", () => {
    const preview = buildLaunchBatchPreview({
      action: "repay",
      deployment,
      selected: [
        item(1n, { creditActive: true, creditPrincipal: 10n }),
        item(2n, { creditActive: true, creditPrincipal: 20n }),
      ],
      wallet,
      staticsBalance: 30n,
      currentAllowance: 30n,
    });
    expect(preview.batch.calls).toHaveLength(2);
    expect(preview.approvalAmount).toBe(0n);
  });

  it("approves Genesis only within a redemption batch", () => {
    const preview = buildLaunchBatchPreview({
      action: "redeem",
      deployment,
      selected: [item(1n), item(2n)],
      wallet,
      nftApprovedForVault: false,
    });
    const first = decodeFunctionData({ abi: staticsGenesisAbi, data: preview.batch.calls[0].data });
    const last = decodeFunctionData({ abi: staticsGenesisAbi, data: preview.batch.calls[3].data });
    expect(first.args).toEqual([vault, true]);
    expect(last.args).toEqual([vault, false]);
  });

  it("keeps each credit call's native fee with that call", () => {
    const preview = buildLaunchBatchPreview({
      action: "open-credit",
      deployment,
      selected: [item(1n), item(2n)],
      wallet,
      creditAmount: 100n,
      nativeFees: [2n, 3n],
    });
    expect(preview.batch.calls.map((call) => call.value)).toEqual([2n, 3n]);
    expect(preview.nativeAmount).toBe(5n);
  });
});
