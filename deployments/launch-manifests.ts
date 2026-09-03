import type { LaunchDeploymentManifest } from "@/lib/deployments/launch-manifest";

import robinhoodGenesis from "./robinhood-genesis.json";
import robinhoodTestnetGenesis from "./robinhood-testnet-genesis.json";

/**
 * Reviewed Genesis launch deployments, keyed by stable deployment id.
 *
 * Public launch addresses come only from reviewed files in this directory.
 * Transaction surfaces verify their runtime code and permanent bindings before
 * use instead of accepting environment-provided production addresses.
 */
export const launchDeploymentManifests: Readonly<Record<string, LaunchDeploymentManifest>> = {
  "robinhood-genesis": robinhoodGenesis as LaunchDeploymentManifest,
  "robinhood-testnet-genesis": robinhoodTestnetGenesis as LaunchDeploymentManifest,
};
