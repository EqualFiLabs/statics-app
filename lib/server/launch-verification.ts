import { createPublicClient, http } from "viem";

import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { robinhoodRpcUrl } from "@/lib/server/robinhood-rpc";

export type LaunchVerificationCacheStatus = "hit" | "miss";

const verificationCache = new Map<string, Promise<void>>();

function cacheKey(deployment: LaunchDeployment): string {
  return [
    deployment.descriptor.deploymentId,
    deployment.descriptor.chainId,
    deployment.protocolCommit,
    ...Object.entries(deployment.runtimeCodeHashes)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, hash]) => `${name}:${hash}`),
  ].join(":");
}

export function verifyLaunchDeploymentOnServer(
  deployment: LaunchDeployment
): Readonly<{ status: LaunchVerificationCacheStatus; verification: Promise<void> }> {
  const key = cacheKey(deployment);
  const cached = verificationCache.get(key);
  if (cached) return { status: "hit", verification: cached };

  const verification = (async () => {
    const publicClient = createPublicClient({
      transport: http(robinhoodRpcUrl(deployment.descriptor.chainId)),
    });
    const chainId = await publicClient.getChainId();
    if (chainId !== deployment.descriptor.chainId) {
      throw new Error("The RPC chain does not match the selected Statics deployment.");
    }
    await verifyLaunchDeployment(publicClient, deployment);
  })().catch((error) => {
    verificationCache.delete(key);
    throw error;
  });
  verificationCache.set(key, verification);
  return { status: "miss", verification };
}

export function resetLaunchVerificationCacheForTests(): void {
  verificationCache.clear();
}
