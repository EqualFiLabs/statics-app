import {
  encodeFunctionData,
  getAddress,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import {
  basketTokenAbi,
  permit2AllowanceAbi,
  staticsAbi,
  staticsDollarCoreAbi,
  staticsDollarRiskTokenAbi,
  v4PositionManagerReadAbi,
} from "@statics-protocol/sdk";

import { loadBasketCatalog, loadTokenMetadata } from "@/lib/baskets/baskets";
import type { LaunchDeployment } from "@/lib/deployments/types";
import type { DollarDeployment } from "@/lib/dollar/deployment";
import {
  MAX_ERC20_ALLOWANCE,
  MAX_PERMIT2_ALLOWANCE,
  MAX_PERMIT2_EXPIRATION,
  operatorApprovalAbi,
} from "@/lib/protocol/approvals";
import { loadEventHistoryInChunks } from "@/lib/protocol/event-history";

export type ApprovalKind = "erc20" | "permit2" | "operator" | "erc721-token";

export type ApprovalRecord = Readonly<{
  key: string;
  kind: ApprovalKind;
  authorityContract: Address;
  token: Address;
  tokenSymbol: string;
  tokenName: string;
  spender: Address;
  spenderLabel: string;
  purposes: readonly string[];
  allowance: bigint;
  expiration?: number;
  tokenId?: bigint;
}>;

type ApprovalDefinition = Omit<ApprovalRecord, "allowance" | "expiration">;

function approvalKey(
  kind: ApprovalKind,
  authorityContract: Address,
  token: Address,
  spender: Address,
  tokenId?: bigint
) {
  return [
    ...[kind, authorityContract, token, spender].map((value) => value.toLowerCase()),
    tokenId?.toString() ?? "",
  ].join(":");
}

function addDefinition(
  definitions: Map<string, ApprovalDefinition>,
  definition: Omit<ApprovalDefinition, "key" | "purposes"> & { purpose: string }
) {
  const key = approvalKey(
    definition.kind,
    definition.authorityContract,
    definition.token,
    definition.spender,
    definition.tokenId
  );
  const current = definitions.get(key);
  definitions.set(key, {
    key,
    kind: definition.kind,
    authorityContract: definition.authorityContract,
    token: definition.token,
    tokenSymbol: definition.tokenSymbol,
    tokenName: definition.tokenName,
    spender: definition.spender,
    spenderLabel: definition.spenderLabel,
    tokenId: definition.tokenId,
    purposes: current
      ? [...new Set([...current.purposes, definition.purpose])]
      : [definition.purpose],
  });
}

export function launchApprovalDefinitions(
  deployment: LaunchDeployment
): readonly ApprovalDefinition[] {
  const definitions = new Map<string, ApprovalDefinition>();
  const statics = {
    address: deployment.contracts.statics,
    symbol: "STATICS",
    name: "Statics",
  };
  const weth = {
    address: deployment.contracts.weth,
    symbol: "WETH",
    name: "Wrapped Ether",
  };
  const addErc20 = (
    token: typeof statics,
    spender: Address,
    spenderLabel: string,
    purpose: string
  ) =>
    addDefinition(definitions, {
      kind: "erc20",
      authorityContract: token.address,
      token: token.address,
      tokenSymbol: token.symbol,
      tokenName: token.name,
      spender,
      spenderLabel,
      purpose,
    });

  addErc20(statics, deployment.contracts.vault, "Genesis Vault", "Acquire Operators NFTs");
  addErc20(
    statics,
    deployment.contracts.activationRegistry,
    "Genesis Activation Registry",
    "Activate Genesis tiers"
  );
  for (const token of [statics, weth]) {
    addErc20(token, deployment.contracts.permit2, "Permit2", "Canonical STATICS market swaps");
    addDefinition(definitions, {
      kind: "permit2",
      authorityContract: deployment.contracts.permit2,
      token: token.address,
      tokenSymbol: token.symbol,
      tokenName: token.name,
      spender: deployment.contracts.universalRouter,
      spenderLabel: "Uniswap Universal Router",
      purpose: "Canonical STATICS market swaps",
    });
  }
  return [...definitions.values()];
}

export async function loadLaunchApprovalInventory(
  publicClient: PublicClient,
  deployment: LaunchDeployment,
  wallet: Address
): Promise<readonly ApprovalRecord[]> {
  const records = await Promise.all(
    launchApprovalDefinitions(deployment).map(async (definition): Promise<ApprovalRecord> => {
      if (definition.kind === "erc20") {
        const allowance = await publicClient.readContract({
          address: definition.authorityContract,
          abi: basketTokenAbi,
          functionName: "allowance",
          args: [wallet, definition.spender],
        });
        return { ...definition, allowance };
      }
      const [allowance, expiration] = await publicClient.readContract({
        address: definition.authorityContract,
        abi: permit2AllowanceAbi,
        functionName: "allowance",
        args: [wallet, definition.token, definition.spender],
      });
      return { ...definition, allowance, expiration };
    })
  );
  return records.sort((left, right) => {
    const symbol = left.tokenSymbol.localeCompare(right.tokenSymbol);
    return symbol || left.spenderLabel.localeCompare(right.spenderLabel);
  });
}

export async function loadApprovalInventory(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  wallet: Address
): Promise<readonly ApprovalRecord[]> {
  const catalog = await loadBasketCatalog(publicClient, deployment, null);
  const [stakingTokenAddress, periphery] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "stakingToken",
    }),
    publicClient.readContract({
      address: deployment.contracts.core,
      abi: staticsDollarCoreAbi,
      functionName: "periphery",
    }),
  ]);
  const stakingToken = await loadTokenMetadata(publicClient, getAddress(stakingTokenAddress));
  const ecosystemTokens = new Map<
    Address,
    Readonly<{ address: Address; symbol: string; name: string }>
  >();
  for (const basket of catalog.baskets) {
    ecosystemTokens.set(basket.token.address, basket.token);
    for (const constituent of basket.constituents) {
      ecosystemTokens.set(constituent.token.address, constituent.token);
    }
  }
  const [weth, dollar, peggedCollateral, riskName, riskSymbol] = await Promise.all([
    loadTokenMetadata(publicClient, deployment.contracts.weth, {
      name: "Wrapped Ether",
      symbol: "WETH",
    }),
    loadTokenMetadata(publicClient, deployment.contracts.dollar, {
      name: "Statics Dollar",
      symbol: "USDstx",
    }),
    deployment.pegged
      ? loadTokenMetadata(publicClient, deployment.pegged.collateral, {
          name: "Global Dollar",
          symbol: "USDG",
        })
      : Promise.resolve(null),
    publicClient
      .readContract({
        address: deployment.contracts.risk,
        abi: staticsDollarRiskTokenAbi,
        functionName: "name",
      })
      .catch(() => "Statics Risk Shares"),
    publicClient
      .readContract({
        address: deployment.contracts.risk,
        abi: staticsDollarRiskTokenAbi,
        functionName: "symbol",
      })
      .catch(() => "ethLEV"),
  ]);

  const definitions = new Map<string, ApprovalDefinition>();
  const addErc20 = (
    token: Readonly<{ address: Address; symbol: string; name: string }>,
    spender: Address,
    spenderLabel: string,
    purpose: string
  ) =>
    addDefinition(definitions, {
      kind: "erc20",
      authorityContract: token.address,
      token: token.address,
      tokenSymbol: token.symbol,
      tokenName: token.name,
      spender,
      spenderLabel,
      purpose,
    });

  for (const token of ecosystemTokens.values()) {
    addErc20(
      token,
      deployment.contracts.diamond,
      "StaticsDiamond",
      "Baskets, positions, and loans"
    );
  }
  addErc20(stakingToken, deployment.contracts.diamond, "StaticsDiamond", "STATICS staking");
  addErc20(weth, deployment.contracts.gateway, "Dollar Gateway", "WETH Dollar deposits");
  addErc20(dollar, deployment.contracts.gateway, "Dollar Gateway", "Dollar recombination");
  if (peggedCollateral) {
    addErc20(
      peggedCollateral,
      deployment.contracts.gateway,
      "Dollar Gateway",
      "USDG Dollar minting"
    );
  }
  if (getAddress(periphery) !== zeroAddress) {
    addErc20(dollar, getAddress(periphery), "Dollar Periphery", "Dollar-only redemption");
  }

  if (deployment.liquidity) {
    const permit2 = deployment.liquidity.contracts.permit2;
    for (const token of ecosystemTokens.values()) {
      addErc20(token, permit2, "Permit2", "Canonical swaps and new liquidity");
      addDefinition(definitions, {
        kind: "permit2",
        authorityContract: permit2,
        token: token.address,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        spender: deployment.liquidity.contracts.positionManager,
        spenderLabel: "Uniswap v4 PositionManager",
        purpose: "Create v4 liquidity positions",
      });
      if (deployment.liquidity.contracts.universalRouter) {
        addDefinition(definitions, {
          kind: "permit2",
          authorityContract: permit2,
          token: token.address,
          tokenSymbol: token.symbol,
          tokenName: token.name,
          spender: deployment.liquidity.contracts.universalRouter,
          spenderLabel: "Uniswap Universal Router",
          purpose: "Canonical swaps",
        });
      }
    }
    addDefinition(definitions, {
      kind: "operator",
      authorityContract: deployment.liquidity.contracts.positionManager,
      token: deployment.liquidity.contracts.positionManager,
      tokenSymbol: "V4 LP",
      tokenName: "Uniswap v4 liquidity positions",
      spender: deployment.contracts.diamond,
      spenderLabel: "StaticsDiamond",
      purpose: "Stake wallet-owned liquidity positions",
    });
    const latestBlock = await publicClient.getBlockNumber();
    const receivedPositions = await loadEventHistoryInChunks(
      deployment.deploymentStartBlock,
      latestBlock,
      (fromBlock, toBlock) =>
        publicClient.getContractEvents({
          address: deployment.liquidity!.contracts.positionManager,
          abi: v4PositionManagerReadAbi,
          eventName: "Transfer",
          args: { to: wallet },
          fromBlock,
          toBlock,
          strict: true,
        })
    );
    const tokenIds = [
      ...new Set(receivedPositions.map((event) => event.args.tokenId.toString())),
    ].map(BigInt);
    for (const tokenId of tokenIds) {
      const owner = await publicClient
        .readContract({
          address: deployment.liquidity.contracts.positionManager,
          abi: v4PositionManagerReadAbi,
          functionName: "ownerOf",
          args: [tokenId],
        })
        .catch(() => null);
      if (!owner || getAddress(owner) !== wallet) continue;
      addDefinition(definitions, {
        kind: "erc721-token",
        authorityContract: deployment.liquidity.contracts.positionManager,
        token: deployment.liquidity.contracts.positionManager,
        tokenSymbol: `V4 LP #${tokenId.toString()}`,
        tokenName: "Uniswap v4 liquidity position",
        spender: deployment.contracts.diamond,
        spenderLabel: "StaticsDiamond",
        purpose: "Legacy individual liquidity-position approval",
        tokenId,
      });
    }
  }

  addDefinition(definitions, {
    kind: "operator",
    authorityContract: deployment.contracts.risk,
    token: deployment.contracts.risk,
    tokenSymbol: riskSymbol,
    tokenName: riskName,
    spender: deployment.contracts.gateway,
    spenderLabel: "Dollar Gateway",
    purpose: "Risk-share recombination",
  });
  if (getAddress(periphery) !== zeroAddress) {
    addDefinition(definitions, {
      kind: "operator",
      authorityContract: deployment.contracts.risk,
      token: deployment.contracts.risk,
      tokenSymbol: riskSymbol,
      tokenName: riskName,
      spender: getAddress(periphery),
      spenderLabel: "Dollar Periphery",
      purpose: "Consumable Risk-share supply",
    });
  }

  const records = await Promise.all(
    [...definitions.values()].map(async (definition): Promise<ApprovalRecord> => {
      if (definition.kind === "erc20") {
        const allowance = await publicClient.readContract({
          address: definition.authorityContract,
          abi: basketTokenAbi,
          functionName: "allowance",
          args: [wallet, definition.spender],
        });
        return { ...definition, allowance };
      }
      if (definition.kind === "permit2") {
        const [allowance, expiration] = await publicClient.readContract({
          address: definition.authorityContract,
          abi: permit2AllowanceAbi,
          functionName: "allowance",
          args: [wallet, definition.token, definition.spender],
        });
        return { ...definition, allowance, expiration };
      }
      if (definition.kind === "erc721-token") {
        const approved = await publicClient.readContract({
          address: definition.authorityContract,
          abi: v4PositionManagerReadAbi,
          functionName: "getApproved",
          args: [definition.tokenId!],
        });
        return {
          ...definition,
          allowance: getAddress(approved) === definition.spender ? 1n : 0n,
        };
      }
      const approved = await publicClient.readContract({
        address: definition.authorityContract,
        abi: operatorApprovalAbi,
        functionName: "isApprovedForAll",
        args: [wallet, definition.spender],
      });
      return { ...definition, allowance: approved ? 1n : 0n };
    })
  );
  return records
    .filter((record) => record.kind !== "erc721-token" || record.allowance === 1n)
    .sort((left, right) => {
      const symbol = left.tokenSymbol.localeCompare(right.tokenSymbol);
      return symbol || left.spenderLabel.localeCompare(right.spenderLabel);
    });
}

export function buildApprovalUpdate(
  approval: ApprovalRecord,
  enabled: boolean
): Readonly<{ target: Address; data: Hex }> {
  if (approval.kind === "erc20") {
    return {
      target: approval.authorityContract,
      data: encodeFunctionData({
        abi: basketTokenAbi,
        functionName: "approve",
        args: [approval.spender, enabled ? MAX_ERC20_ALLOWANCE : 0n],
      }),
    };
  }
  if (approval.kind === "permit2") {
    return {
      target: approval.authorityContract,
      data: encodeFunctionData({
        abi: permit2AllowanceAbi,
        functionName: "approve",
        args: [
          approval.token,
          approval.spender,
          enabled ? MAX_PERMIT2_ALLOWANCE : 0n,
          enabled ? MAX_PERMIT2_EXPIRATION : 0,
        ],
      }),
    };
  }
  if (approval.kind === "erc721-token") {
    return {
      target: approval.authorityContract,
      data: encodeFunctionData({
        abi: v4PositionManagerReadAbi,
        functionName: "approve",
        args: [enabled ? approval.spender : zeroAddress, approval.tokenId!],
      }),
    };
  }
  return {
    target: approval.authorityContract,
    data: encodeFunctionData({
      abi: operatorApprovalAbi,
      functionName: "setApprovalForAll",
      args: [approval.spender, enabled],
    }),
  };
}

export async function readApprovalState(
  publicClient: PublicClient,
  wallet: Address,
  approval: ApprovalRecord
): Promise<Readonly<{ allowance: bigint; expiration?: number }>> {
  if (approval.kind === "erc20") {
    const allowance = await publicClient.readContract({
      address: approval.authorityContract,
      abi: basketTokenAbi,
      functionName: "allowance",
      args: [wallet, approval.spender],
    });
    return { allowance };
  }
  if (approval.kind === "permit2") {
    const [allowance, expiration] = await publicClient.readContract({
      address: approval.authorityContract,
      abi: permit2AllowanceAbi,
      functionName: "allowance",
      args: [wallet, approval.token, approval.spender],
    });
    return { allowance, expiration };
  }
  if (approval.kind === "erc721-token") {
    const approved = await publicClient.readContract({
      address: approval.authorityContract,
      abi: v4PositionManagerReadAbi,
      functionName: "getApproved",
      args: [approval.tokenId!],
    });
    return { allowance: getAddress(approved) === approval.spender ? 1n : 0n };
  }
  const approved = await publicClient.readContract({
    address: approval.authorityContract,
    abi: operatorApprovalAbi,
    functionName: "isApprovedForAll",
    args: [wallet, approval.spender],
  });
  return { allowance: approved ? 1n : 0n };
}
