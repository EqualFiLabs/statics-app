"use client";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { EarnView } from "@/lib/rewards/earn";
import { EarnPage } from "./EarnPage";
export function PhaseOneRewards({
  deployment,
  initialPositionId,
  view = "overview",
}: {
  deployment: PhaseOneDeployment;
  initialPositionId: bigint | null;
  view?: EarnView;
}) {
  return <EarnPage deployment={deployment} initialPositionId={initialPositionId} view={view} />;
}
