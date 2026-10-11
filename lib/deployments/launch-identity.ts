import { keccak256, stringToHex } from "viem";
import type { LaunchDeployment } from "./types";

/** Identifies the reviewed launch configuration without its filesystem or source label. */
export function launchManifestIdentity(deployment: LaunchDeployment) {
  return keccak256(
    stringToHex(
      JSON.stringify({
        deploymentId: deployment.descriptor.deploymentId,
        chainId: deployment.descriptor.chainId,
        protocolCommit: deployment.protocolCommit,
        deploymentStartBlock: deployment.deploymentStartBlock.toString(),
        contracts: Object.entries(deployment.contracts).sort(([a], [b]) => a.localeCompare(b)),
        hashes: Object.entries(deployment.runtimeCodeHashes).sort(([a], [b]) => a.localeCompare(b)),
        market: deployment.market,
        analytics: deployment.analytics ?? null,
      })
    )
  );
}
