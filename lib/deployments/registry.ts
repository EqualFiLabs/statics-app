import { launchDeploymentManifests } from "@/deployments/launch-manifests";
import { deploymentManifests } from "@/deployments/manifests";
import {
  parseLaunchDeploymentManifest,
  type LaunchDeploymentManifest,
} from "@/lib/deployments/launch-manifest";
import { clientDollarEnvironment, readDollarDeployment } from "@/lib/dollar/deployment";
import { parseDeploymentManifest } from "@/lib/dollar/manifest";
import type {
  DeploymentCapability,
  DeploymentDescriptor,
  DeploymentOption,
  LaunchDeployment,
  ProtocolDeployment,
  StaticsDeployment,
  StaticsNetworkId,
} from "@/lib/deployments/types";

export const ROBINHOOD_GENESIS_DEPLOYMENT_ID = "robinhood-genesis";
export const ROBINHOOD_TESTNET_GENESIS_DEPLOYMENT_ID = "robinhood-testnet-genesis";
export const LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID = "local-anvil-genesis";

const commonCapabilities: readonly DeploymentCapability[] = [
  "overview",
  "wallet",
  "activity",
  "approval-tools",
];

const protocolCapabilities: readonly DeploymentCapability[] = [
  ...commonCapabilities,
  "dollar",
  "baskets",
  "positions",
  "loans",
  "protocol-liquidity",
  "protocol-rewards",
  "genesis-position-linking",
  "faucet",
];

function target(
  networkId: StaticsNetworkId,
  network: string,
  chainId: number,
  launch: LaunchDeployment | null,
  protocol: ProtocolDeployment | null
): DeploymentOption {
  const deploymentId =
    networkId === "anvil"
      ? LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID
      : networkId === "robinhood"
        ? ROBINHOOD_GENESIS_DEPLOYMENT_ID
        : ROBINHOOD_TESTNET_GENESIS_DEPLOYMENT_ID;
  const capabilities = Array.from(
    new Set<DeploymentCapability>([
      ...commonCapabilities,
      ...(launch?.descriptor.capabilities ?? []),
      ...(protocol?.descriptor.capabilities ?? []),
    ])
  );
  const descriptor: DeploymentDescriptor = {
    deploymentId,
    label: protocol ? "Statics Protocol" : "Statics Genesis launch",
    network,
    chainId,
    stage: protocol ? "full-protocol" : "launch",
    capabilities,
    available: Boolean(launch || protocol),
    unavailableReason:
      launch || protocol
        ? undefined
        : `The reviewed ${network} deployment manifest has not been published yet.`,
  };
  return { networkId, descriptor, launch, protocol };
}

function localLaunch(environment: Record<string, string | undefined>): LaunchDeployment | null {
  const raw = environment.NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST?.trim();
  if (!raw) return null;
  if (environment.NEXT_PUBLIC_APP_ENV !== "development") {
    throw new Error("A local launch manifest is only allowed in development.");
  }

  let manifest: LaunchDeploymentManifest;
  try {
    manifest = JSON.parse(raw) as LaunchDeploymentManifest;
  } catch {
    throw new Error("NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST must be valid JSON.");
  }
  if (
    manifest.deploymentId !== LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID ||
    manifest.chainId !== 31_337
  ) {
    throw new Error("The local launch manifest must identify the Anvil deployment.");
  }
  const deployment = parseLaunchDeploymentManifest(manifest, "development-fixture");
  if (
    Object.keys(deployment.runtimeCodeHashes).length !== Object.keys(deployment.contracts).length
  ) {
    throw new Error("Every local launch contract requires a runtime code hash.");
  }
  return deployment;
}

function publicLaunch(deploymentId: string): LaunchDeployment | null {
  const manifest = launchDeploymentManifests[deploymentId];
  return manifest ? parseLaunchDeploymentManifest(manifest) : null;
}

function protocolDeployment(
  chainId: number,
  environment: Record<string, string | undefined>
): ProtocolDeployment | null {
  if (chainId === 31_337) {
    const state = readDollarDeployment(environment);
    if (state.status !== "configured" || state.deployment.chainId !== chainId) return null;
    return {
      kind: "protocol",
      descriptor: {
        deploymentId: state.deployment.protocolCommit,
        label: "Statics Protocol",
        network: "Local Anvil",
        chainId,
        stage: "full-protocol",
        capabilities: protocolCapabilities,
        available: true,
      },
      protocol: state.deployment,
    };
  }
  const manifest = deploymentManifests[chainId];
  if (!manifest) return null;
  const protocol = parseDeploymentManifest(manifest);
  return {
    kind: "protocol",
    descriptor: {
      deploymentId: protocol.protocolCommit,
      label: "Statics Protocol",
      network: chainId === 4_663 ? "Robinhood Chain" : "Robinhood Chain Testnet",
      chainId,
      stage: "full-protocol",
      capabilities: protocolCapabilities,
      available: true,
    },
    protocol,
  };
}

function publicEnvironment(): Record<string, string | undefined> {
  return {
    ...clientDollarEnvironment(),
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_APP_NETWORK: process.env.NEXT_PUBLIC_APP_NETWORK,
    NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST:
      process.env.NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST,
  };
}

export function deploymentRegistry(
  environment: Record<string, string | undefined> = publicEnvironment()
): readonly DeploymentOption[] {
  const options: DeploymentOption[] = [];
  const appEnvironment = environment.NEXT_PUBLIC_APP_ENV ?? "development";
  if (appEnvironment !== "development" && environment.NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST) {
    throw new Error("A local launch manifest is only allowed in development.");
  }
  if (appEnvironment === "development") {
    options.push(
      target(
        "anvil",
        "Local Anvil",
        31_337,
        localLaunch(environment),
        protocolDeployment(31_337, environment)
      )
    );
  }
  options.push(
    target(
      "robinhood",
      "Robinhood Chain",
      4_663,
      publicLaunch(ROBINHOOD_GENESIS_DEPLOYMENT_ID),
      protocolDeployment(4_663, environment)
    ),
    target(
      "robinhood-testnet",
      "Robinhood Chain Testnet",
      46_630,
      publicLaunch(ROBINHOOD_TESTNET_GENESIS_DEPLOYMENT_ID),
      protocolDeployment(46_630, environment)
    )
  );
  return options;
}

export function defaultNetworkId(
  appEnvironment = process.env.NEXT_PUBLIC_APP_ENV,
  network = process.env.NEXT_PUBLIC_APP_NETWORK
): StaticsNetworkId {
  if (network === "anvil") return "anvil";
  if (!network && appEnvironment === "production") return "robinhood";
  return network === "robinhood" ? "robinhood" : "robinhood-testnet";
}

export function findDeployment(
  options: readonly DeploymentOption[],
  networkId: StaticsNetworkId
): DeploymentOption | null {
  return options.find((option) => option.networkId === networkId) ?? null;
}

export function hasCapability(
  deployment: DeploymentDescriptor | StaticsDeployment,
  capability: DeploymentCapability
): boolean {
  const descriptor = "descriptor" in deployment ? deployment.descriptor : deployment;
  return descriptor.capabilities.includes(capability);
}
