import type { Address, Hex } from "viem";

import {
  buildCheckpointGaugePoolCall,
  buildCheckpointGaugeScheduleCall,
  buildCheckpointRewardAssetsCall,
  buildSettleProtocolPoolRevenueCall,
  buildSettlePublicSwapRewardsCall,
} from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { GaugeScheduleFreshness } from "@/lib/phase-one/pools";

export type PublicMaintenanceAction = Readonly<{
  kind: "gauge-schedule" | "gauge-pool" | "reward-book" | "swap-rewards" | "pool-revenue";
  label: string;
  target: Address;
  calldata: Hex;
  value: 0n;
  rereadAfterConfirmation: true;
}>;

function action(
  deployment: PhaseOneDeployment,
  kind: PublicMaintenanceAction["kind"],
  label: string,
  calldata: Hex
): PublicMaintenanceAction {
  return {
    kind,
    label,
    target: deployment.contracts.diamond,
    calldata,
    value: 0n,
    rereadAfterConfirmation: true,
  };
}

export function planGaugeCatchup(
  deployment: PhaseOneDeployment,
  freshness: GaugeScheduleFreshness
): readonly PublicMaintenanceAction[] {
  if (!freshness.stale) return [];
  const firstCallPeriods = Math.min(freshness.periodsBehind, freshness.maximumPeriodsPerCall);
  return [
    action(
      deployment,
      "gauge-schedule",
      `Catch up as many as ${firstCallPeriods} gauge periods`,
      buildCheckpointGaugeScheduleCall(firstCallPeriods)
    ),
  ];
}

export function planPoolCheckpoint(
  deployment: PhaseOneDeployment,
  poolId: Hex,
  freshness: GaugeScheduleFreshness
): PublicMaintenanceAction {
  if (freshness.stale) {
    throw new Error("Catch up the gauge schedule before checkpointing this pool.");
  }
  return action(
    deployment,
    "gauge-pool",
    "Checkpoint pool gauge rewards",
    buildCheckpointGaugePoolCall(poolId)
  );
}

export function planPublicRewardMaintenance(input: {
  deployment: PhaseOneDeployment;
  poolId: Hex;
  asset: Address;
  unfundedSwapRewards: bigint;
  rewardBookNeedsCheckpoint: boolean;
}): readonly PublicMaintenanceAction[] {
  const actions: PublicMaintenanceAction[] = [];
  if (input.unfundedSwapRewards > 0n) {
    actions.push(
      action(
        input.deployment,
        "swap-rewards",
        "Fund crystallized global swap rewards",
        buildSettlePublicSwapRewardsCall(input.asset, input.unfundedSwapRewards)
      )
    );
  }
  if (input.rewardBookNeedsCheckpoint) {
    actions.push(
      action(
        input.deployment,
        "reward-book",
        "Checkpoint global reward eligibility",
        buildCheckpointRewardAssetsCall([input.asset])
      )
    );
  }
  actions.push(
    action(
      input.deployment,
      "pool-revenue",
      "Settle public pool revenue",
      buildSettleProtocolPoolRevenueCall(input.poolId, input.asset)
    )
  );
  return actions;
}
