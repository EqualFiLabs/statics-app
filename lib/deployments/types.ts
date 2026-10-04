import type { Address, Hex } from "viem";

import type { DollarDeployment } from "@/lib/dollar/deployment";

export type LegacyDeploymentCapability =
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

export type PhaseOneCapability =
  | "public-market-discovery"
  | "public-direct-swaps"
  | "public-lp-positions"
  | "position-staking"
  | "range-gauges"
  | "gauge-allocations"
  | "global-rewards"
  | "lp-rewards"
  | "allocator-rewards"
  | "market-tape"
  | "public-maintenance";

export type DeploymentCapability = LegacyDeploymentCapability | PhaseOneCapability;

export type DeploymentStage = "launch" | "phase-one" | "full-protocol";

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
  analytics?: Readonly<{
    treasuryBeneficiary: Address;
    treasuryVesting: Readonly<{ address: Address; runtimeCodeHash: Hex }>;
    reservesLens: Readonly<{ address: Address; runtimeCodeHash: Hex }>;
  }>;
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

export type PhaseOneContractName =
  | "diamond"
  | "timelock"
  | "publicHook"
  | "liquidityManager"
  | "statics"
  | "weth"
  | "poolManager"
  | "positionManager"
  | "permit2"
  | "quoter"
  | "stateView"
  | "universalRouter";

export type PublicPoolToken = Readonly<{
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  logoUri?: string;
  metadataSource: "reviewed-manifest" | "onchain-import";
}>;

export type SupportedPublicPool = Readonly<{
  poolId: Hex;
  poolKey: LaunchPoolKey;
  token0: PublicPoolToken;
  token1: PublicPoolToken;
  enabled: boolean;
  provenance: Readonly<{
    deploymentId: string;
    protocolCommit: string;
    registrationBlock: bigint;
  }>;
}>;

export type PhaseOneFacet = Readonly<{
  address: Address;
  runtimeCodeHash: Hex;
  selectors: readonly Hex[];
}>;

export type PhaseOneDeployment = Readonly<{
  kind: "phase-one";
  descriptor: DeploymentDescriptor;
  deploymentStartBlock: bigint;
  protocolCommit: string;
  sdkCommit: string;
  installedPhase: 1;
  source: "checked-in-manifest" | "development-fixture";
  contracts: Readonly<Record<PhaseOneContractName, Address>>;
  runtimeCodeHashes: Readonly<Partial<Record<PhaseOneContractName, Hex>>>;
  facetFingerprint?: Hex;
  facets: readonly PhaseOneFacet[];
  supportedPools: readonly SupportedPublicPool[];
}>;

export type StaticsDeployment = LaunchDeployment | ProtocolDeployment;

export type StaticsNetworkId = "anvil" | "robinhood" | "robinhood-testnet";

export type DeploymentOption = Readonly<{
  networkId: StaticsNetworkId;
  descriptor: DeploymentDescriptor;
  launch: LaunchDeployment | null;
  phaseOne?: PhaseOneDeployment | null;
  protocol: ProtocolDeployment | null;
}>;
