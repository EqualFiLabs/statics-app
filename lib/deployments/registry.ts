import { launchDeploymentManifests } from "@/deployments/launch-manifests";
import { deploymentManifests } from "@/deployments/manifests";
import {
  parseLaunchDeploymentManifest,
  type LaunchDeploymentManifest,
} from "@/lib/deployments/launch-manifest";
import type {
  DeploymentCapability,
  DeploymentDescriptor,
  DeploymentOption,
  ProtocolDeployment,
  StaticsDeployment,
} from "@/lib/deployments/types";
import { parseDeploymentManifest } from "@/lib/dollar/manifest";

export const ROBINHOOD_GENESIS_DEPLOYMENT_ID = "robinhood-genesis";
export const ROBINHOOD_TESTNET_PROTOCOL_DEPLOYMENT_ID = "robinhood-testnet-protocol";
export const LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID = "local-robinhood-genesis";
export const DEPLOYMENT_STORAGE_KEY = "statics:active-deployment";

const protocolCapabilities = [
  "overview",
  "genesis-vault",
  "genesis-activation",
  "genesis-position-linking",
  "dollar",
  "baskets",
  "positions",
  "loans",
  "protocol-liquidity",
  "protocol-rewards",
  "faucet",
  "wallet",
  "activity",
  "approval-tools",
] as const satisfies readonly DeploymentCapability[];

function unavailableMainnet(): DeploymentOption {
  const descriptor: DeploymentDescriptor = {
    deploymentId: ROBINHOOD_GENESIS_DEPLOYMENT_ID,
    label: "Statics Genesis",
    network: "Robinhood Chain",
    chainId: 4_663,
    stage: "launch",
    capabilities: ["overview", "wallet"],
    available: false,
    unavailableReason:
      "The reviewed Robinhood mainnet Genesis deployment manifest has not been published yet.",
  };
  return { descriptor, deployment: null };
}

function protocolOption(): DeploymentOption {
  const manifest = deploymentManifests[46_630];
  if (!manifest) {
    const descriptor: DeploymentDescriptor = {
      deploymentId: ROBINHOOD_TESTNET_PROTOCOL_DEPLOYMENT_ID,
      label: "Full protocol beta",
      network: "Robinhood Chain Testnet",
      chainId: 46_630,
      stage: "full-protocol",
      capabilities: ["overview", "wallet"],
      available: false,
      unavailableReason: "No reviewed Robinhood testnet protocol manifest is checked in.",
    };
    return { descriptor, deployment: null };
  }
  const protocol = parseDeploymentManifest(manifest);
  const descriptor: DeploymentDescriptor = {
    deploymentId: ROBINHOOD_TESTNET_PROTOCOL_DEPLOYMENT_ID,
    label: "Full protocol beta",
    network: "Robinhood Chain Testnet",
    chainId: protocol.chainId,
    stage: "full-protocol",
    capabilities: protocolCapabilities,
    available: true,
  };
  const deployment: ProtocolDeployment = { kind: "protocol", descriptor, protocol };
  return { descriptor, deployment };
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
  const reviewedMainnet = launchDeploymentManifests[ROBINHOOD_GENESIS_DEPLOYMENT_ID];
  const mainnet = reviewedMainnet
    ? (() => {
        const deployment = parseLaunchDeploymentManifest(reviewedMainnet);
        return { descriptor: deployment.descriptor, deployment };
      })()
    : unavailableMainnet();
  return [...(local ? [local] : []), mainnet, protocolOption()];
}

export function defaultDeploymentId(
  appEnvironment = process.env.NEXT_PUBLIC_APP_ENV,
  network = process.env.NEXT_PUBLIC_APP_NETWORK
): string {
  if (appEnvironment === "production") return ROBINHOOD_GENESIS_DEPLOYMENT_ID;
  if (network === "robinhood-fork") {
    return LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID;
  }
  return process.env.NEXT_PUBLIC_APP_NETWORK === "robinhood"
    ? ROBINHOOD_GENESIS_DEPLOYMENT_ID
    : ROBINHOOD_TESTNET_PROTOCOL_DEPLOYMENT_ID;
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
