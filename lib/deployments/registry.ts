import { launchDeploymentManifests } from "@/deployments/launch-manifests";
import {
  parseLaunchDeploymentManifest,
  type LaunchDeploymentManifest,
} from "@/lib/deployments/launch-manifest";
import type {
  DeploymentCapability,
  DeploymentDescriptor,
  DeploymentOption,
  StaticsDeployment,
} from "@/lib/deployments/types";

export const ROBINHOOD_GENESIS_DEPLOYMENT_ID = "robinhood-genesis";
export const ROBINHOOD_TESTNET_GENESIS_DEPLOYMENT_ID = "robinhood-testnet-genesis";
export const LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID = "local-robinhood-genesis";

function unavailableLaunch(
  deploymentId: string,
  network: string,
  chainId: number
): DeploymentOption {
  const descriptor: DeploymentDescriptor = {
    deploymentId,
    label: "Statics Genesis launch",
    network,
    chainId,
    stage: "launch",
    capabilities: ["overview", "wallet", "activity", "approval-tools"],
    available: false,
    unavailableReason: `The reviewed ${network} Genesis launch manifest has not been published yet.`,
  };
  return { descriptor, deployment: null };
}

function localForkOption(environment: Record<string, string | undefined>): DeploymentOption | null {
  const raw = environment.NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST?.trim();
  const selected = environment.NEXT_PUBLIC_APP_NETWORK === "robinhood-fork";
  if (!raw && !selected) return null;
  if (environment.NEXT_PUBLIC_APP_ENV !== "development") {
    throw new Error("A local launch manifest is only allowed in development.");
  }
  if (!selected) {
    throw new Error("The local launch manifest requires NEXT_PUBLIC_APP_NETWORK=robinhood-fork.");
  }
  if (!raw) throw new Error("NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST is required.");

  let manifest: LaunchDeploymentManifest;
  try {
    manifest = JSON.parse(raw) as LaunchDeploymentManifest;
  } catch {
    throw new Error("NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST must be valid JSON.");
  }
  if (
    manifest.deploymentId !== LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID ||
    manifest.chainId !== 4_663
  ) {
    throw new Error("The local launch manifest must identify the Robinhood fork deployment.");
  }
  const deployment = parseLaunchDeploymentManifest(manifest, "development-fixture");
  if (
    Object.keys(deployment.runtimeCodeHashes).length !== Object.keys(deployment.contracts).length
  ) {
    throw new Error("Every local launch contract requires a runtime code hash.");
  }
  return { descriptor: deployment.descriptor, deployment };
}

function publicEnvironment(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_APP_NETWORK: process.env.NEXT_PUBLIC_APP_NETWORK,
    NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST:
      process.env.NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST,
  };
}

export function deploymentRegistry(
  environment: Record<string, string | undefined> = publicEnvironment()
): readonly DeploymentOption[] {
  const local = localForkOption(environment);
  if (local) return [local];
  const configured = (deploymentId: string, network: string, chainId: number): DeploymentOption => {
    const manifest = launchDeploymentManifests[deploymentId];
    if (!manifest) return unavailableLaunch(deploymentId, network, chainId);
    const deployment = parseLaunchDeploymentManifest(manifest);
    return { descriptor: deployment.descriptor, deployment };
  };
  return [
    configured(ROBINHOOD_GENESIS_DEPLOYMENT_ID, "Robinhood Chain", 4_663),
    configured(ROBINHOOD_TESTNET_GENESIS_DEPLOYMENT_ID, "Robinhood Chain Testnet", 46_630),
  ];
}

export function defaultDeploymentId(
  appEnvironment = process.env.NEXT_PUBLIC_APP_ENV,
  network = process.env.NEXT_PUBLIC_APP_NETWORK
): string {
  if (network === "robinhood-fork") {
    return LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID;
  }
  if (!network && appEnvironment === "production") return ROBINHOOD_GENESIS_DEPLOYMENT_ID;
  return network === "robinhood"
    ? ROBINHOOD_GENESIS_DEPLOYMENT_ID
    : ROBINHOOD_TESTNET_GENESIS_DEPLOYMENT_ID;
}

export function findDeployment(
  options: readonly DeploymentOption[],
  deploymentId: string
): DeploymentOption | null {
  return options.find((option) => option.descriptor.deploymentId === deploymentId) ?? null;
}

export function hasCapability(
  deployment: DeploymentDescriptor | StaticsDeployment,
  capability: DeploymentCapability
): boolean {
  const descriptor = "descriptor" in deployment ? deployment.descriptor : deployment;
  return descriptor.capabilities.includes(capability);
}
