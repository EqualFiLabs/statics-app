import type { Address, Hex } from "viem";

import type { DollarDeployment } from "@/lib/dollar/deployment";

export type DeploymentCapability =
  | "overview"
  | "canonical-statics-market"
  | "genesis-vault"
  | "genesis-activation"
  | "genesis-launch-rewards"
  | "genesis-position-linking"
  | "dollar"
  | "baskets"
  | "positions"
  | "loans"
  | "protocol-liquidity"
  | "protocol-rewards"
  | "faucet"
  | "wallet"
  | "activity"
  | "approval-tools";

export type DeploymentStage = "launch" | "full-protocol";

export type DeploymentDescriptor = Readonly<{
  deploymentId: string;
  label: string;
  network: string;
  chainId: number;
  stage: DeploymentStage;
  capabilities: readonly DeploymentCapability[];
  available: boolean;
  unavailableReason?: string;
}>;

export type LaunchContractName =
  | "statics"
  | "genesis"
  | "vault"
  | "activationRegistry"
  | "feeReceiver"
  | "launchDistributor"
  | "weth"
  | "poolManager"
  | "stateView"
  | "quoter"
  | "universalRouter"
  | "permit2";

export type LaunchPoolKey = Readonly<{
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}>;

export type LaunchDeployment = Readonly<{
  kind: "launch";
  descriptor: DeploymentDescriptor;
  deploymentStartBlock: bigint;
  protocolCommit: string;
  source: "checked-in-manifest" | "development-fixture";
  contracts: Readonly<Record<LaunchContractName, Address>>;
  runtimeCodeHashes: Readonly<Partial<Record<LaunchContractName, Hex>>>;
  market: Readonly<{
    poolId: Hex;
    poolKey: LaunchPoolKey;
  }>;
}>;

export type ProtocolDeployment = Readonly<{
  kind: "protocol";
  descriptor: DeploymentDescriptor;
  protocol: DollarDeployment;
}>;

export type StaticsDeployment = LaunchDeployment | ProtocolDeployment;

export type DeploymentOption = Readonly<{
  descriptor: DeploymentDescriptor;
  deployment: StaticsDeployment | null;
}>;
