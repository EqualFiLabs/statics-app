import { type PublicClient } from "viem";
import {
  buildCheckpointGaugeScheduleCall,
  staticsGaugeIncentivesAbi,
} from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { gaugeScheduleFreshness } from "@/lib/phase-one/pools";

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
  for (
    let remaining = Math.max(0, freshness.periodsBehind - maximum);
    remaining > 0;
    remaining -= maximum
  ) {
    actions.push({
      kind: "phase-one-checkpoint-schedule" as const,
      label: "Checkpoint elapsed gauge periods",
      data: buildCheckpointGaugeScheduleCall(Math.min(remaining, maximum)),
    });
  }
  return actions;
}
