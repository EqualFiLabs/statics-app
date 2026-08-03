import {
  getAddress,
  isHash,
  keccak256,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import { deploymentManifests } from "@/deployments/manifests";
import { parseDeploymentManifest } from "@/lib/dollar/manifest";

export type DollarContractName =
  "diamond" | "core" | "gateway" | "dollar" | "risk" | "weth" | "oracle";
export type LiquidityContractName =
  | "poolManager"
  | "positionManager"
  | "permit2"
  | "swapFeeHook"
  | "liquidityManager"
  | "stateView"
  | "quoter"
  | "universalRouter";

type LocalLiquidityContractName = Exclude<LiquidityContractName, "quoter" | "universalRouter">;

export type LiquidityDeployment = Readonly<{
  contracts: Readonly<
    Record<LocalLiquidityContractName, Address> &
      Partial<Record<"quoter" | "universalRouter", Address>>
  >;
  runtimeCodeHashes: Readonly<
    Record<LocalLiquidityContractName, Hex> & Partial<Record<"quoter" | "universalRouter", Hex>>
  >;
}>;

export type PositionMetadataDeployment = Readonly<{
  renderer: Address;
  avatarSvg: Address;
  rendererCodeHash: Hex;
  avatarSvgCodeHash: Hex;
}>;

export type DollarDeployment = Readonly<{
  chainId: number;
  deploymentStartBlock: bigint;
  wethProfileId: bigint;
  protocolCommit: string;
  /**
   * Where these addresses came from. The environment path is restricted to
   * local Anvil; every other chain must come from a reviewed manifest.
   */
  source: "development-environment" | "checked-in-manifest";
  contracts: Readonly<Record<DollarContractName, Address>>;
  runtimeCodeHashes: Readonly<Record<DollarContractName, Hex>>;
  positionMetadata?: PositionMetadataDeployment | null;
  liquidity?: LiquidityDeployment | null;
  pegged?: Readonly<{
    collateral: Address;
    oracle: Address;
    profileId: bigint;
    collateralCodeHash: Hex;
    oracleCodeHash: Hex;
  }> | null;
  faucet?: Readonly<{
    address: Address;
    runtimeCodeHash: Hex;
  }> | null;
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

const liquidityAddressVariables: Readonly<Record<LocalLiquidityContractName, string>> = {
  poolManager: "NEXT_PUBLIC_STATICS_POOL_MANAGER_ADDRESS",
  positionManager: "NEXT_PUBLIC_STATICS_POSITION_MANAGER_ADDRESS",
  permit2: "NEXT_PUBLIC_STATICS_PERMIT2_ADDRESS",
  swapFeeHook: "NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_ADDRESS",
  liquidityManager: "NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_ADDRESS",
  stateView: "NEXT_PUBLIC_STATICS_STATE_VIEW_ADDRESS",
};

const liquidityHashVariables: Readonly<Record<LocalLiquidityContractName, string>> = {
  poolManager: "NEXT_PUBLIC_STATICS_POOL_MANAGER_CODE_HASH",
  positionManager: "NEXT_PUBLIC_STATICS_POSITION_MANAGER_CODE_HASH",
  permit2: "NEXT_PUBLIC_STATICS_PERMIT2_CODE_HASH",
  swapFeeHook: "NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_CODE_HASH",
  liquidityManager: "NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_CODE_HASH",
  stateView: "NEXT_PUBLIC_STATICS_STATE_VIEW_CODE_HASH",
};

const positionMetadataVariables = {
  renderer: "NEXT_PUBLIC_STATICS_POSITION_RENDERER_ADDRESS",
  avatarSvg: "NEXT_PUBLIC_STATICS_AVATAR_SVG_ADDRESS",
  rendererCodeHash: "NEXT_PUBLIC_STATICS_POSITION_RENDERER_CODE_HASH",
  avatarSvgCodeHash: "NEXT_PUBLIC_STATICS_AVATAR_SVG_CODE_HASH",
} as const;

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
  const chainId = Number(environment.NEXT_PUBLIC_STATICS_CHAIN_ID);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error("NEXT_PUBLIC_STATICS_CHAIN_ID must be a positive integer.");
  }

  // Anything that is not local Anvil comes from a reviewed manifest rather than
  // from environment variables, so the addresses a build ships with are a diff
  // somebody approved and not state on a build machine.
  if (appEnvironment !== "development" || chainId !== 31_337) {
    const manifest = deploymentManifests[chainId];
    if (!manifest) {
      return {
        status: "unavailable",
        reason: `No reviewed Statics deployment manifest is checked in for chain ${chainId}.`,
      };
    }
    return { status: "configured", deployment: parseDeploymentManifest(manifest) };
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
      ) as Record<LocalLiquidityContractName, Address>,
      runtimeCodeHashes: Object.fromEntries(
        Object.entries(liquidityHashVariables).map(([name, variable]) => [
          name,
          parseHash(environment[variable], variable),
        ])
      ) as Record<LocalLiquidityContractName, Hex>,
    };
  }
  const positionMetadataValues = Object.values(positionMetadataVariables).map(
    (variable) => environment[variable]
  );
  let positionMetadata: PositionMetadataDeployment | null = null;
  if (positionMetadataValues.some(Boolean)) {
    if (!positionMetadataValues.every(Boolean)) {
      throw new Error("Position metadata deployment configuration must be complete or omitted.");
    }
    positionMetadata = {
      renderer: parseAddress(
        environment[positionMetadataVariables.renderer],
        positionMetadataVariables.renderer
      ),
      avatarSvg: parseAddress(
        environment[positionMetadataVariables.avatarSvg],
        positionMetadataVariables.avatarSvg
      ),
      rendererCodeHash: parseHash(
        environment[positionMetadataVariables.rendererCodeHash],
        positionMetadataVariables.rendererCodeHash
      ),
      avatarSvgCodeHash: parseHash(
        environment[positionMetadataVariables.avatarSvgCodeHash],
        positionMetadataVariables.avatarSvgCodeHash
      ),
    };
  }
  const peggedValues = [
    environment.NEXT_PUBLIC_STATICS_USDG_ADDRESS,
    environment.NEXT_PUBLIC_STATICS_USDG_ORACLE_ADDRESS,
    environment.NEXT_PUBLIC_STATICS_USDG_PROFILE_ID,
    environment.NEXT_PUBLIC_STATICS_USDG_CODE_HASH,
    environment.NEXT_PUBLIC_STATICS_USDG_ORACLE_CODE_HASH,
  ];
  let pegged: DollarDeployment["pegged"] = null;
  if (peggedValues.some(Boolean)) {
    if (!peggedValues.every(Boolean)) {
      throw new Error("Pegged USDG deployment configuration must be complete or omitted.");
    }
    const profileId = environment.NEXT_PUBLIC_STATICS_USDG_PROFILE_ID!;
    if (!/^[1-9]\d*$/.test(profileId)) {
      throw new Error("NEXT_PUBLIC_STATICS_USDG_PROFILE_ID must be a positive integer.");
    }
    pegged = {
      collateral: parseAddress(
        environment.NEXT_PUBLIC_STATICS_USDG_ADDRESS,
        "NEXT_PUBLIC_STATICS_USDG_ADDRESS"
      ),
      oracle: parseAddress(
        environment.NEXT_PUBLIC_STATICS_USDG_ORACLE_ADDRESS,
        "NEXT_PUBLIC_STATICS_USDG_ORACLE_ADDRESS"
      ),
      profileId: BigInt(profileId),
      collateralCodeHash: parseHash(
        environment.NEXT_PUBLIC_STATICS_USDG_CODE_HASH,
        "NEXT_PUBLIC_STATICS_USDG_CODE_HASH"
      ),
      oracleCodeHash: parseHash(
        environment.NEXT_PUBLIC_STATICS_USDG_ORACLE_CODE_HASH,
        "NEXT_PUBLIC_STATICS_USDG_ORACLE_CODE_HASH"
      ),
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
      positionMetadata,
      liquidity,
      pegged,
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
    NEXT_PUBLIC_STATICS_POSITION_RENDERER_ADDRESS:
      process.env.NEXT_PUBLIC_STATICS_POSITION_RENDERER_ADDRESS,
    NEXT_PUBLIC_STATICS_AVATAR_SVG_ADDRESS: process.env.NEXT_PUBLIC_STATICS_AVATAR_SVG_ADDRESS,
    NEXT_PUBLIC_STATICS_POSITION_RENDERER_CODE_HASH:
      process.env.NEXT_PUBLIC_STATICS_POSITION_RENDERER_CODE_HASH,
    NEXT_PUBLIC_STATICS_AVATAR_SVG_CODE_HASH: process.env.NEXT_PUBLIC_STATICS_AVATAR_SVG_CODE_HASH,
    NEXT_PUBLIC_STATICS_POOL_MANAGER_ADDRESS: process.env.NEXT_PUBLIC_STATICS_POOL_MANAGER_ADDRESS,
    NEXT_PUBLIC_STATICS_POSITION_MANAGER_ADDRESS:
      process.env.NEXT_PUBLIC_STATICS_POSITION_MANAGER_ADDRESS,
    NEXT_PUBLIC_STATICS_PERMIT2_ADDRESS: process.env.NEXT_PUBLIC_STATICS_PERMIT2_ADDRESS,
    NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_ADDRESS:
      process.env.NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_ADDRESS,
    NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_ADDRESS:
      process.env.NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_ADDRESS,
    NEXT_PUBLIC_STATICS_STATE_VIEW_ADDRESS: process.env.NEXT_PUBLIC_STATICS_STATE_VIEW_ADDRESS,
    NEXT_PUBLIC_STATICS_POOL_MANAGER_CODE_HASH:
      process.env.NEXT_PUBLIC_STATICS_POOL_MANAGER_CODE_HASH,
    NEXT_PUBLIC_STATICS_POSITION_MANAGER_CODE_HASH:
      process.env.NEXT_PUBLIC_STATICS_POSITION_MANAGER_CODE_HASH,
    NEXT_PUBLIC_STATICS_PERMIT2_CODE_HASH: process.env.NEXT_PUBLIC_STATICS_PERMIT2_CODE_HASH,
    NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_CODE_HASH:
      process.env.NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_CODE_HASH,
    NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_CODE_HASH:
      process.env.NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_CODE_HASH,
    NEXT_PUBLIC_STATICS_STATE_VIEW_CODE_HASH: process.env.NEXT_PUBLIC_STATICS_STATE_VIEW_CODE_HASH,
    NEXT_PUBLIC_STATICS_USDG_ADDRESS: process.env.NEXT_PUBLIC_STATICS_USDG_ADDRESS,
    NEXT_PUBLIC_STATICS_USDG_ORACLE_ADDRESS: process.env.NEXT_PUBLIC_STATICS_USDG_ORACLE_ADDRESS,
    NEXT_PUBLIC_STATICS_USDG_PROFILE_ID: process.env.NEXT_PUBLIC_STATICS_USDG_PROFILE_ID,
    NEXT_PUBLIC_STATICS_USDG_CODE_HASH: process.env.NEXT_PUBLIC_STATICS_USDG_CODE_HASH,
    NEXT_PUBLIC_STATICS_USDG_ORACLE_CODE_HASH:
      process.env.NEXT_PUBLIC_STATICS_USDG_ORACLE_CODE_HASH,
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
  if (deployment.positionMetadata) {
    const positionMetadataAbi = parseAbi([
      "function positionRenderer() view returns (address)",
      "function avatarSVG() view returns (address)",
    ]);
    const [rendererCode, avatarSvgCode, configuredRenderer, configuredAvatarSvg] =
      await Promise.all([
        publicClient.getCode({ address: deployment.positionMetadata.renderer }),
        publicClient.getCode({ address: deployment.positionMetadata.avatarSvg }),
        publicClient.readContract({
          address: deployment.contracts.diamond,
          abi: positionMetadataAbi,
          functionName: "positionRenderer",
        }),
        publicClient.readContract({
          address: deployment.positionMetadata.renderer,
          abi: positionMetadataAbi,
          functionName: "avatarSVG",
        }),
      ]);
    if (!rendererCode || rendererCode === "0x" || !avatarSvgCode || avatarSvgCode === "0x") {
      throw new Error("Position metadata deployment has missing runtime code.");
    }
    if (
      keccak256(rendererCode).toLowerCase() !==
        deployment.positionMetadata.rendererCodeHash.toLowerCase() ||
      keccak256(avatarSvgCode).toLowerCase() !==
        deployment.positionMetadata.avatarSvgCodeHash.toLowerCase()
    ) {
      throw new Error("Position metadata runtime code does not match the deployment manifest.");
    }
    if (getAddress(configuredRenderer) !== getAddress(deployment.positionMetadata.renderer)) {
      throw new Error("Statics is bound to a different Position renderer.");
    }
    if (getAddress(configuredAvatarSvg) !== getAddress(deployment.positionMetadata.avatarSvg)) {
      throw new Error("Position renderer is bound to a different Avatar SVG contract.");
    }
  }
  if (deployment.pegged) {
    const [collateralCode, oracleCode] = await Promise.all([
      publicClient.getCode({ address: deployment.pegged.collateral }),
      publicClient.getCode({ address: deployment.pegged.oracle }),
    ]);
    if (!collateralCode || collateralCode === "0x" || !oracleCode || oracleCode === "0x") {
      throw new Error("Pegged USDG deployment has missing runtime code.");
    }
    if (
      keccak256(collateralCode).toLowerCase() !==
        deployment.pegged.collateralCodeHash.toLowerCase() ||
      keccak256(oracleCode).toLowerCase() !== deployment.pegged.oracleCodeHash.toLowerCase()
    ) {
      throw new Error("Pegged USDG runtime code does not match the deployment manifest.");
    }
  }
  if (deployment.faucet) {
    const code = await publicClient.getCode({ address: deployment.faucet.address });
    if (!code || code === "0x") throw new Error("Testnet faucet has no runtime code.");
    if (keccak256(code).toLowerCase() !== deployment.faucet.runtimeCodeHash.toLowerCase()) {
      throw new Error("Testnet faucet runtime code does not match the deployment manifest.");
    }
  }
}

export async function verifyLiquidityDeployment(
  publicClient: PublicClient,
  deployment: DollarDeployment
): Promise<LiquidityDeployment> {
  const liquidity = deployment.liquidity;
  if (!liquidity) throw new Error("No verified Statics liquidity deployment is configured.");
  await Promise.all(
    (Object.entries(liquidity.contracts) as [LiquidityContractName, Address][]).map(
      async ([name, address]) => {
        const expectedHash = liquidity.runtimeCodeHashes[name];
        if (!expectedHash) throw new Error(`${name} has no reviewed runtime code hash.`);
        const code = await publicClient.getCode({ address });
        if (!code || code === "0x") throw new Error(`${name} has no runtime code.`);
        if (keccak256(code).toLowerCase() !== expectedHash.toLowerCase()) {
          throw new Error(`${name} runtime code does not match the deployment manifest.`);
        }
      }
    )
  );

  const poolManagerAbi = parseAbi(["function poolManager() view returns (address)"]);
  const permit2Abi = parseAbi(["function permit2() view returns (address)"]);
  const positionManagerAbi = parseAbi(["function positionManager() view returns (address)"]);
  const staticsDiamondAbi = parseAbi(["function staticsDiamond() view returns (address)"]);
  const poolManagerBound = [
    "positionManager",
    "stateView",
    "quoter",
    "universalRouter",
    "swapFeeHook",
    "liquidityManager",
  ] as const;
  for (const name of poolManagerBound) {
    const address = liquidity.contracts[name];
    if (!address) continue;
    const bound = await publicClient.readContract({
      address,
      abi: poolManagerAbi,
      functionName: "poolManager",
    });
    if (getAddress(bound) !== getAddress(liquidity.contracts.poolManager)) {
      throw new Error(`${name} is bound to a different PoolManager.`);
    }
  }

  const [
    positionManagerPermit2,
    managerPermit2,
    managerPositionManager,
    managerDiamond,
    hookDiamond,
  ] = await Promise.all([
    publicClient.readContract({
      address: liquidity.contracts.positionManager,
      abi: permit2Abi,
      functionName: "permit2",
    }),
    publicClient.readContract({
      address: liquidity.contracts.liquidityManager,
      abi: permit2Abi,
      functionName: "permit2",
    }),
    publicClient.readContract({
      address: liquidity.contracts.liquidityManager,
      abi: positionManagerAbi,
      functionName: "positionManager",
    }),
    publicClient.readContract({
      address: liquidity.contracts.liquidityManager,
      abi: staticsDiamondAbi,
      functionName: "staticsDiamond",
    }),
    publicClient.readContract({
      address: liquidity.contracts.swapFeeHook,
      abi: staticsDiamondAbi,
      functionName: "staticsDiamond",
    }),
  ]);
  if (
    getAddress(positionManagerPermit2) !== getAddress(liquidity.contracts.permit2) ||
    getAddress(managerPermit2) !== getAddress(liquidity.contracts.permit2)
  ) {
    throw new Error("Liquidity deployment is bound to a different Permit2.");
  }
  if (getAddress(managerPositionManager) !== getAddress(liquidity.contracts.positionManager)) {
    throw new Error("Liquidity manager is bound to a different PositionManager.");
  }
  if (
    getAddress(managerDiamond) !== getAddress(deployment.contracts.diamond) ||
    getAddress(hookDiamond) !== getAddress(deployment.contracts.diamond)
  ) {
    throw new Error("Liquidity deployment is bound to a different StaticsDiamond.");
  }
  return liquidity;
}
