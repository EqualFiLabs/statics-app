import { launchDeploymentManifests } from "@/deployments/launch-manifests";
import { deploymentManifests } from "@/deployments/manifests";
import { parseLaunchDeploymentManifest } from "@/lib/deployments/launch-manifest";
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
export const DEPLOYMENT_STORAGE_KEY = "statics:active-deployment";

const protocolCapabilities = [
  "overview",
  "canonical-statics-market",
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

export function deploymentRegistry(): readonly DeploymentOption[] {
  const reviewedMainnet = launchDeploymentManifests[ROBINHOOD_GENESIS_DEPLOYMENT_ID];
  const mainnet = reviewedMainnet
    ? (() => {
        const deployment = parseLaunchDeploymentManifest(reviewedMainnet);
        return { descriptor: deployment.descriptor, deployment };
      })()
    : unavailableMainnet();
  return [mainnet, protocolOption()];
}

export function defaultDeploymentId(appEnvironment = process.env.NEXT_PUBLIC_APP_ENV): string {
  if (appEnvironment === "production") return ROBINHOOD_GENESIS_DEPLOYMENT_ID;
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
