import { type Address, type PublicClient } from "viem";
import {
  buildCheckpointRewardAssetsCall,
  buildSettlePublicSwapRewardsCall,
  buildCheckpointGaugeScheduleCall,
  staticsAbi,
  staticsGaugeIncentivesAbi,
} from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { gaugeScheduleFreshness } from "@/lib/phase-one/pools";

/** Only called while preparing a staking/reward action, never while quoting swaps. */
export async function globalRewardPrerequisites(
  publicClient: PublicClient,
  deployment: PhaseOneDeployment,
  assets: readonly Address[],
  claim = false
) {
  const entries = await Promise.all(
    [...new Set(assets)].map(async (asset) => {
      const checkpoint = await publicClient.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "rewardBookNeedsCheckpoint",
        args: [asset],
      });
      const unfunded = claim
        ? await publicClient.readContract({
            address: deployment.contracts.diamond,
            abi: staticsAbi,
            functionName: "unfundedSwapRewards",
            args: [asset],
          })
        : 0n;
      return { asset, checkpoint, unfunded };
    })
  );
  return entries.flatMap(({ asset, checkpoint, unfunded }) => [
    ...(checkpoint
      ? [{ label: "Checkpoint reward eligibility", data: buildCheckpointRewardAssetsCall([asset]) }]
      : []),
    ...(unfunded > 0n
      ? [
          {
            label: "Settle pending swap rewards",
            data: buildSettlePublicSwapRewardsCall(asset, unfunded),
          },
        ]
      : []),
  ]);
}
export async function gaugePrerequisites(
  publicClient: PublicClient,
  deployment: PhaseOneDeployment
) {
  const [reserve, maximum, block] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsGaugeIncentivesAbi,
      functionName: "gaugeReserve",
    }),
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsGaugeIncentivesAbi,
      functionName: "maxGaugeCatchupPeriods",
    }),
    publicClient.getBlock({ blockTag: "pending" }),
  ]);
  const freshness = gaugeScheduleFreshness(reserve, Number(block.timestamp), maximum);
  const actions = [];
  for (let remaining = freshness.periodsBehind; remaining > 0; remaining -= maximum) {
    actions.push({
      label: "Checkpoint elapsed gauge periods",
      data: buildCheckpointGaugeScheduleCall(Math.min(remaining, maximum)),
    });
  }
  return actions;
}
