import { decodeFunctionData, getAddress } from "viem";
import { describe, expect, it } from "vitest";

import { staticsGaugeIncentivesAbi } from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { planGaugeCatchup, planPoolCheckpoint } from "@/lib/phase-one/maintenance";
import type { GaugeScheduleFreshness } from "@/lib/phase-one/pools";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;
const deployment = { contracts: { diamond: address("1") } } as PhaseOneDeployment;

const stale: GaugeScheduleFreshness = {
  activated: true,
  stale: true,
  periodFinish: 1_000,
  lastCheckpoint: 900,
  periodsBehind: 80,
  maximumPeriodsPerCall: 52,
  catchupCallsRequired: 2,
};

describe("Phase 1 permissionless maintenance", () => {
  it("plans one bounded schedule call and requires a live reread before another", () => {
    const plan = planGaugeCatchup(deployment, stale);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.rereadAfterConfirmation).toBe(true);
    const decoded = decodeFunctionData({ abi: staticsGaugeIncentivesAbi, data: plan[0]!.calldata });
    expect(decoded.functionName).toBe("checkpointGaugeSchedule");
    expect(decoded.args).toEqual([52]);
  });

  it("does not checkpoint a pool until the schedule is current", () => {
    expect(() => planPoolCheckpoint(deployment, hash("1"), stale)).toThrow(
      "Catch up the gauge schedule"
    );
    const current = { ...stale, stale: false, periodsBehind: 0, catchupCallsRequired: 0 };
    const checkpoint = planPoolCheckpoint(deployment, hash("1"), current);
    expect(
      decodeFunctionData({ abi: staticsGaugeIncentivesAbi, data: checkpoint.calldata }).functionName
    ).toBe("checkpointGaugePool");
  });
});
