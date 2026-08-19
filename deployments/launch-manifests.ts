import type { LaunchDeploymentManifest } from "@/lib/deployments/launch-manifest";

/**
 * Reviewed standalone Genesis deployments, keyed by stable deployment id.
 *
 * Robinhood mainnet intentionally remains absent until the production Doppler
 * ranges, fee parameters, and deployment are ratified. The registry still
 * exposes the planned mainnet product state, but transaction surfaces fail
 * closed instead of accepting environment-provided production addresses.
 */
export const launchDeploymentManifests: Readonly<Record<string, LaunchDeploymentManifest>> = {};
