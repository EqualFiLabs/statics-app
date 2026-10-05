import { describe, expect, it } from "vitest";
import { createPublicClient, getAddress, http, keccak256, parseAbi } from "viem";

import {
  dopplerStaticsTokenAbi,
  genesisActivationRegistryAbi,
  staticsGenesisAbi,
} from "@statics-protocol/sdk";
import { launchDeploymentManifests } from "@/deployments/launch-manifests";
import { parseLaunchDeploymentManifest } from "@/lib/deployments/launch-manifest";
import { buildLaunchBatchPreview } from "@/lib/genesis/launch-batch-planner";
import { encodeErc7821Batch } from "@/lib/genesis/atomic-batch";
import { oneIndexedGenesisTierCosts } from "@/lib/genesis/activation-costs";
import { ROBINHOOD_CALIBUR, ROBINHOOD_CALIBUR_CODE_HASH } from "@/lib/genesis/calibur";
import { robinhoodMainnet } from "@/lib/wallet-config";

const live = process.env.RUN_OPERATOR_READONLY === "1" ? describe : describe.skip;
const owner = getAddress("0xcffc6e659df622e2d41c7a879c76e6d33f37925e");
const ids = [6n, 85n] as const;
const distributorAbi = parseAbi(["function registered(uint256) view returns (bool)"]);

live("Robinhood Operator activation batch read-only conformance", () => {
  const rpc = process.env.STATICS_ROBINHOOD_MAINNET_RPC_URL;
  const client = createPublicClient({ chain: robinhoodMainnet, transport: http(rpc) });
  const deployment = parseLaunchDeploymentManifest(launchDeploymentManifests["robinhood-genesis"]);

  it("simulates two owner-sensitive activations with exact temporary approval", async () => {
    if (!rpc) throw new Error("STATICS_ROBINHOOD_MAINNET_RPC_URL is required.");
    const [delegateCode, owners, tiers, registered, balance, allowance, rawCosts] =
      await Promise.all([
        client.getCode({ address: ROBINHOOD_CALIBUR }),
        Promise.all(
          ids.map((id) =>
            client.readContract({
              address: deployment.contracts.genesis,
              abi: staticsGenesisAbi,
              functionName: "ownerOf",
              args: [id],
            })
          )
        ),
        Promise.all(
          ids.map((id) =>
            client.readContract({
              address: deployment.contracts.activationRegistry,
              abi: genesisActivationRegistryAbi,
              functionName: "tierOf",
              args: [id],
            })
          )
        ),
        Promise.all(
          ids.map((id) =>
            client.readContract({
              address: deployment.contracts.launchDistributor,
              abi: distributorAbi,
              functionName: "registered",
              args: [id],
            })
          )
        ),
        client.readContract({
          address: deployment.contracts.statics,
          abi: dopplerStaticsTokenAbi,
          functionName: "balanceOf",
          args: [owner],
        }),
        client.readContract({
          address: deployment.contracts.statics,
          abi: dopplerStaticsTokenAbi,
          functionName: "allowance",
          args: [owner, deployment.contracts.activationRegistry],
        }),
        Promise.all(
          [1, 2, 3, 4].map((tier) =>
            client.readContract({
              address: deployment.contracts.activationRegistry,
              abi: genesisActivationRegistryAbi,
              functionName: "tierCost",
              args: [tier],
            })
          )
        ),
      ]);
    expect(delegateCode && keccak256(delegateCode)).toBe(ROBINHOOD_CALIBUR_CODE_HASH);
    expect(owners.every((address) => getAddress(address) === owner)).toBe(true);
    expect(tiers.every((tier) => tier < 1)).toBe(true);
    const selected = ids.map((id, index) => ({
      id,
      tier: Number(tiers[index]),
      registered: registered[index],
      multiplierBps: 0,
      rewardWeight: 0n,
      pendingStatics: 0n,
      pendingWeth: 0n,
      creditActive: false,
      creditPrincipal: 0n,
      creditMaturity: 0,
    }));
    const plan = buildLaunchBatchPreview({
      action: "activate",
      deployment,
      selected,
      wallet: owner,
      targetTier: 1,
      tierCosts: oneIndexedGenesisTierCosts(rawCosts),
      staticsBalance: balance,
      currentAllowance: allowance,
    });
    expect(plan.operatorIds).toEqual(ids);
    expect(plan.batch.labels).toContain("revoke temporary STATICS approval");
    await expect(
      client.call({
        account: owner,
        to: owner,
        data: encodeErc7821Batch(plan.batch.calls),
        value: plan.nativeAmount,
        stateOverride: [{ address: owner, code: `0xef0100${ROBINHOOD_CALIBUR.slice(2)}` }],
      })
    ).resolves.toBeDefined();
  }, 30_000);
});
