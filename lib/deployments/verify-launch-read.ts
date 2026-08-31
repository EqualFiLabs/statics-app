import type { PublicClient } from "viem";

import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeploymentCached } from "@/lib/deployments/verify-launch";

type VerificationResponse = Readonly<{
  verified?: boolean;
  error?: string;
}>;

/**
 * Verify immutable launch configuration for display-only reads.
 *
 * Checked-in deployments are verified once by the application server so a
 * fresh browser session does not repeat the same runtime and binding calls.
 * Local development fixtures stay on the caller's configured Anvil client.
 * Transaction paths must keep calling verifyLaunchDeployment directly.
 */
export async function verifyLaunchDeploymentForRead(
  publicClient: PublicClient,
  deployment: LaunchDeployment
): Promise<void> {
  if (deployment.source === "development-fixture") {
    await verifyLaunchDeploymentCached(publicClient, deployment);
    return;
  }

  const response = await fetch("/api/deployments/launch-verification", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chainId: deployment.descriptor.chainId,
      deploymentId: deployment.descriptor.deploymentId,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as VerificationResponse;
  if (!response.ok || payload.verified !== true) {
    throw new Error(payload.error ?? "Launch deployment verification failed.");
  }
}
