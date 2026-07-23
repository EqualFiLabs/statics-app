import { getAddress, isHash, keccak256, type Address, type Hex, type PublicClient } from "viem";

export type DollarContractName =
  "diamond" | "core" | "gateway" | "dollar" | "risk" | "weth" | "oracle";
export type LiquidityContractName =
  "poolManager" | "positionManager" | "permit2" | "swapFeeHook" | "liquidityManager" | "stateView";

export type LiquidityDeployment = Readonly<{
  contracts: Readonly<Record<LiquidityContractName, Address>>;
  runtimeCodeHashes: Readonly<Record<LiquidityContractName, Hex>>;
}>;

export type DollarDeployment = Readonly<{
  chainId: number;
  deploymentStartBlock: bigint;
  wethProfileId: bigint;
  protocolCommit: string;
  source: "development-environment";
  contracts: Readonly<Record<DollarContractName, Address>>;
  runtimeCodeHashes: Readonly<Record<DollarContractName, Hex>>;
  liquidity?: LiquidityDeployment | null;
}>;

export type DollarDeploymentState =
  | Readonly<{ status: "unavailable"; reason: string }>
  | Readonly<{ status: "configured"; deployment: DollarDeployment }>;

const addressVariables: Readonly<Record<DollarContractName, string>> = {
  diamond: "NEXT_PUBLIC_STATICS_DIAMOND_ADDRESS",
  core: "NEXT_PUBLIC_STATICS_DOLLAR_CORE_ADDRESS",
  gateway: "NEXT_PUBLIC_STATICS_DOLLAR_GATEWAY_ADDRESS",
  dollar: "NEXT_PUBLIC_STATICS_DOLLAR_TOKEN_ADDRESS",
  risk: "NEXT_PUBLIC_STATICS_DOLLAR_RISK_ADDRESS",
  weth: "NEXT_PUBLIC_STATICS_WETH_ADDRESS",
  oracle: "NEXT_PUBLIC_STATICS_DOLLAR_ORACLE_ADDRESS",
};

const hashVariables: Readonly<Record<DollarContractName, string>> = {
  diamond: "NEXT_PUBLIC_STATICS_DIAMOND_CODE_HASH",
  core: "NEXT_PUBLIC_STATICS_DOLLAR_CORE_CODE_HASH",
  gateway: "NEXT_PUBLIC_STATICS_DOLLAR_GATEWAY_CODE_HASH",
  dollar: "NEXT_PUBLIC_STATICS_DOLLAR_TOKEN_CODE_HASH",
  risk: "NEXT_PUBLIC_STATICS_DOLLAR_RISK_CODE_HASH",
  weth: "NEXT_PUBLIC_STATICS_WETH_CODE_HASH",
  oracle: "NEXT_PUBLIC_STATICS_DOLLAR_ORACLE_CODE_HASH",
};

const liquidityAddressVariables: Readonly<Record<LiquidityContractName, string>> = {
  poolManager: "NEXT_PUBLIC_STATICS_POOL_MANAGER_ADDRESS",
  positionManager: "NEXT_PUBLIC_STATICS_POSITION_MANAGER_ADDRESS",
  permit2: "NEXT_PUBLIC_STATICS_PERMIT2_ADDRESS",
  swapFeeHook: "NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_ADDRESS",
  liquidityManager: "NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_ADDRESS",
  stateView: "NEXT_PUBLIC_STATICS_STATE_VIEW_ADDRESS",
};

const liquidityHashVariables: Readonly<Record<LiquidityContractName, string>> = {
  poolManager: "NEXT_PUBLIC_STATICS_POOL_MANAGER_CODE_HASH",
  positionManager: "NEXT_PUBLIC_STATICS_POSITION_MANAGER_CODE_HASH",
  permit2: "NEXT_PUBLIC_STATICS_PERMIT2_CODE_HASH",
  swapFeeHook: "NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_CODE_HASH",
  liquidityManager: "NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_CODE_HASH",
  stateView: "NEXT_PUBLIC_STATICS_STATE_VIEW_CODE_HASH",
};

function parseAddress(value: string | undefined, variable: string): Address {
  if (!value) throw new Error(`${variable} is required when a Dollar deployment is configured.`);
  try {
    return getAddress(value);
  } catch {
    throw new Error(`${variable} must be a valid EVM address.`);
  }
}

function parseHash(value: string | undefined, variable: string): Hex {
  if (!value || !isHash(value)) {
    throw new Error(`${variable} must be a 32-byte runtime code hash.`);
  }
  return value;
}

export function readDollarDeployment(
  environment: Record<string, string | undefined>
): DollarDeploymentState {
  const configuredValues = [
    environment.NEXT_PUBLIC_STATICS_CHAIN_ID,
    environment.NEXT_PUBLIC_STATICS_DEPLOYMENT_START_BLOCK,
    environment.NEXT_PUBLIC_STATICS_PROTOCOL_COMMIT,
    ...Object.values(addressVariables).map((variable) => environment[variable]),
    ...Object.values(hashVariables).map((variable) => environment[variable]),
  ];
  if (configuredValues.every((value) => !value)) {
    return {
      status: "unavailable",
      reason: "No verified Statics Dollar deployment is configured.",
    };
  }

  const appEnvironment = environment.NEXT_PUBLIC_APP_ENV || "development";
  if (appEnvironment !== "development") {
    throw new Error(
      "Staging and production Dollar deployments must come from a checked-in verified manifest."
    );
  }

  const chainId = Number(environment.NEXT_PUBLIC_STATICS_CHAIN_ID);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error("NEXT_PUBLIC_STATICS_CHAIN_ID must be a positive integer.");
  }
  if (chainId !== 31_337) {
    throw new Error("Environment-generated Dollar deployments are restricted to local Anvil.");
  }

  const profile = environment.NEXT_PUBLIC_STATICS_WETH_PROFILE_ID;
  if (!profile || !/^[1-9]\d*$/.test(profile)) {
    throw new Error("NEXT_PUBLIC_STATICS_WETH_PROFILE_ID must be a positive integer.");
  }

  const deploymentStartBlock = environment.NEXT_PUBLIC_STATICS_DEPLOYMENT_START_BLOCK;
  if (!deploymentStartBlock || !/^\d+$/.test(deploymentStartBlock)) {
    throw new Error("NEXT_PUBLIC_STATICS_DEPLOYMENT_START_BLOCK must be a non-negative integer.");
  }

  const protocolCommit = environment.NEXT_PUBLIC_STATICS_PROTOCOL_COMMIT?.trim() || "";
  if (!/^[a-f0-9]{40}$/i.test(protocolCommit)) {
    throw new Error("NEXT_PUBLIC_STATICS_PROTOCOL_COMMIT must be a full Git commit.");
  }

  const contracts = Object.fromEntries(
    Object.entries(addressVariables).map(([name, variable]) => [
      name,
      parseAddress(environment[variable], variable),
    ])
  ) as Record<DollarContractName, Address>;
  const runtimeCodeHashes = Object.fromEntries(
    Object.entries(hashVariables).map(([name, variable]) => [
      name,
      parseHash(environment[variable], variable),
    ])
  ) as Record<DollarContractName, Hex>;
  const liquidityValues = [
    ...Object.values(liquidityAddressVariables).map((variable) => environment[variable]),
    ...Object.values(liquidityHashVariables).map((variable) => environment[variable]),
  ];
  let liquidity: LiquidityDeployment | null = null;
  if (liquidityValues.some(Boolean)) {
    if (!liquidityValues.every(Boolean)) {
      throw new Error("Liquidity deployment configuration must be complete or omitted.");
    }
    liquidity = {
      contracts: Object.fromEntries(
        Object.entries(liquidityAddressVariables).map(([name, variable]) => [
          name,
          parseAddress(environment[variable], variable),
        ])
      ) as Record<LiquidityContractName, Address>,
      runtimeCodeHashes: Object.fromEntries(
        Object.entries(liquidityHashVariables).map(([name, variable]) => [
          name,
          parseHash(environment[variable], variable),
        ])
      ) as Record<LiquidityContractName, Hex>,
    };
  }

  return {
    status: "configured",
    deployment: {
      chainId,
      deploymentStartBlock: BigInt(deploymentStartBlock),
      wethProfileId: BigInt(profile),
      protocolCommit,
      source: "development-environment",
      contracts,
      runtimeCodeHashes,
      liquidity,
    },
  };
}

export function readClientDollarDeployment(): DollarDeploymentState {
  return readDollarDeployment({
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_STATICS_CHAIN_ID: process.env.NEXT_PUBLIC_STATICS_CHAIN_ID,
    NEXT_PUBLIC_STATICS_DEPLOYMENT_START_BLOCK:
      process.env.NEXT_PUBLIC_STATICS_DEPLOYMENT_START_BLOCK,
    NEXT_PUBLIC_STATICS_DIAMOND_ADDRESS: process.env.NEXT_PUBLIC_STATICS_DIAMOND_ADDRESS,
    NEXT_PUBLIC_STATICS_DOLLAR_CORE_ADDRESS: process.env.NEXT_PUBLIC_STATICS_DOLLAR_CORE_ADDRESS,
    NEXT_PUBLIC_STATICS_DOLLAR_GATEWAY_ADDRESS:
      process.env.NEXT_PUBLIC_STATICS_DOLLAR_GATEWAY_ADDRESS,
    NEXT_PUBLIC_STATICS_DOLLAR_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_STATICS_DOLLAR_TOKEN_ADDRESS,
    NEXT_PUBLIC_STATICS_DOLLAR_RISK_ADDRESS: process.env.NEXT_PUBLIC_STATICS_DOLLAR_RISK_ADDRESS,
    NEXT_PUBLIC_STATICS_WETH_ADDRESS: process.env.NEXT_PUBLIC_STATICS_WETH_ADDRESS,
    NEXT_PUBLIC_STATICS_DOLLAR_ORACLE_ADDRESS:
      process.env.NEXT_PUBLIC_STATICS_DOLLAR_ORACLE_ADDRESS,
    NEXT_PUBLIC_STATICS_WETH_PROFILE_ID: process.env.NEXT_PUBLIC_STATICS_WETH_PROFILE_ID,
    NEXT_PUBLIC_STATICS_PROTOCOL_COMMIT: process.env.NEXT_PUBLIC_STATICS_PROTOCOL_COMMIT,
    NEXT_PUBLIC_STATICS_DIAMOND_CODE_HASH: process.env.NEXT_PUBLIC_STATICS_DIAMOND_CODE_HASH,
    NEXT_PUBLIC_STATICS_DOLLAR_CORE_CODE_HASH:
      process.env.NEXT_PUBLIC_STATICS_DOLLAR_CORE_CODE_HASH,
    NEXT_PUBLIC_STATICS_DOLLAR_GATEWAY_CODE_HASH:
      process.env.NEXT_PUBLIC_STATICS_DOLLAR_GATEWAY_CODE_HASH,
    NEXT_PUBLIC_STATICS_DOLLAR_TOKEN_CODE_HASH:
      process.env.NEXT_PUBLIC_STATICS_DOLLAR_TOKEN_CODE_HASH,
    NEXT_PUBLIC_STATICS_DOLLAR_RISK_CODE_HASH:
      process.env.NEXT_PUBLIC_STATICS_DOLLAR_RISK_CODE_HASH,
    NEXT_PUBLIC_STATICS_WETH_CODE_HASH: process.env.NEXT_PUBLIC_STATICS_WETH_CODE_HASH,
    NEXT_PUBLIC_STATICS_DOLLAR_ORACLE_CODE_HASH:
      process.env.NEXT_PUBLIC_STATICS_DOLLAR_ORACLE_CODE_HASH,
    ...Object.fromEntries(
      [...Object.values(liquidityAddressVariables), ...Object.values(liquidityHashVariables)].map(
        (variable) => [variable, process.env[variable]]
      )
    ),
  });
}

export async function verifyDollarDeployment(
  publicClient: PublicClient,
  deployment: DollarDeployment
): Promise<void> {
  const chainId = await publicClient.getChainId();
  if (chainId !== deployment.chainId) {
    throw new Error(`Connected chain ${chainId} does not match deployment ${deployment.chainId}.`);
  }

  await Promise.all(
    (Object.keys(deployment.contracts) as DollarContractName[]).map(async (name) => {
      const code = await publicClient.getCode({ address: deployment.contracts[name] });
      if (!code || code === "0x") throw new Error(`${name} has no runtime code.`);
      const actual = keccak256(code);
      if (actual.toLowerCase() !== deployment.runtimeCodeHashes[name].toLowerCase()) {
        throw new Error(`${name} runtime code does not match the deployment manifest.`);
      }
    })
  );
}

export async function verifyLiquidityDeployment(
  publicClient: PublicClient,
  deployment: DollarDeployment
): Promise<LiquidityDeployment> {
  const liquidity = deployment.liquidity;
  if (!liquidity) throw new Error("No verified Statics liquidity deployment is configured.");
  await Promise.all(
    (Object.keys(liquidity.contracts) as LiquidityContractName[]).map(async (name) => {
      const code = await publicClient.getCode({ address: liquidity.contracts[name] });
      if (!code || code === "0x") throw new Error(`${name} has no runtime code.`);
      if (keccak256(code).toLowerCase() !== liquidity.runtimeCodeHashes[name].toLowerCase()) {
        throw new Error(`${name} runtime code does not match the deployment manifest.`);
      }
    })
  );
  return liquidity;
}
