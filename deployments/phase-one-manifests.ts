import type { PhaseOneDeploymentManifest } from "@/lib/deployments/phase-one-manifest";

/**
 * Reviewed Phase 1 deployments keyed by stable deployment id.
 *
 * This remains empty until the protocol is deployed and a complete runtime
 * manifest is reviewed. Production Phase 1 writes therefore fail closed.
 */
export const phaseOneDeploymentManifests: Readonly<Record<string, PhaseOneDeploymentManifest>> = {};
