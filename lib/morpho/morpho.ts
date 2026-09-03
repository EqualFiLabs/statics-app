import { parseAbi, type Address, type PublicClient } from "viem";

import {
  morphoBlueAbi,
  morphoBorrowAssets,
  morphoSupplyAssets,
  quoteMorphoHealth,
  staticsAbi,
  type MorphoHealth,
  type MorphoMarket,
  type MorphoMarketParams,
  type MorphoPosition,
  type StaticsMorphoPosition,
} from "@statics-protocol/sdk";

import type { DollarDeployment, MorphoMarketDeployment } from "@/lib/dollar/deployment";
import { verifyDollarDeployment } from "@/lib/dollar/deployment";

const oracleAbi = parseAbi(["function price() view returns (uint256)"]);

export type MorphoMarketSnapshot = Readonly<{
  deployment: MorphoMarketDeployment;
  params: MorphoMarketParams;
  market: MorphoMarket;
  oraclePrice: bigint;
  availableLiquidity: bigint;
}>;

export type MorphoPositionSnapshot = Readonly<{
  market: MorphoMarketSnapshot;
  account: Address;
  accountDeployed: boolean;
  position: MorphoPosition;
  tracked: StaticsMorphoPosition;
  health: MorphoHealth;
}>;

export type MorphoLenderSnapshot = Readonly<{
  market: MorphoMarketSnapshot;
  position: MorphoPosition;
  suppliedAssets: bigint;
  borrowedAssets: bigint;
}>;

export async function loadMorphoMarket(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  marketDeployment: MorphoMarketDeployment
): Promise<MorphoMarketSnapshot> {
  const morpho = deployment.morpho;
  if (!morpho) throw new Error("Morpho is not configured for this deployment.");
  const [params, market, oraclePrice] = await Promise.all([
    publicClient.readContract({
      address: morpho.address,
      abi: morphoBlueAbi,
      functionName: "idToMarketParams",
      args: [marketDeployment.marketId],
    }),
    publicClient.readContract({
      address: morpho.address,
      abi: morphoBlueAbi,
      functionName: "market",
      args: [marketDeployment.marketId],
    }),
    publicClient.readContract({
      address: marketDeployment.oracle,
      abi: oracleAbi,
      functionName: "price",
    }),
  ]);
  return {
    deployment: marketDeployment,
    params,
    market,
    oraclePrice,
    availableLiquidity:
      market.totalSupplyAssets > market.totalBorrowAssets
        ? market.totalSupplyAssets - market.totalBorrowAssets
        : 0n,
  };
}

export async function loadMorphoPosition(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  marketDeployment: MorphoMarketDeployment,
  positionId: bigint
): Promise<MorphoPositionSnapshot> {
  await verifyDollarDeployment(publicClient, deployment);
  const morpho = deployment.morpho;
  if (!morpho) throw new Error("Morpho is not configured for this deployment.");
  const marketSnapshot = await loadMorphoMarket(publicClient, deployment, marketDeployment);
  const [[account, accountDeployed], tracked] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "morphoAccount",
      args: [positionId],
    }),
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "morphoPositionMarket",
      args: [positionId, marketDeployment.marketId],
    }),
  ]);
  const position = await publicClient.readContract({
    address: morpho.address,
    abi: morphoBlueAbi,
    functionName: "position",
    args: [marketDeployment.marketId, account],
  });
  return {
    market: marketSnapshot,
    account,
    accountDeployed,
    position,
    tracked,
    health: quoteMorphoHealth({
      position,
      market: marketSnapshot.market,
      oraclePrice: marketSnapshot.oraclePrice,
      lltv: marketSnapshot.params.lltv,
    }),
  };
}

export async function loadMorphoLender(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  marketDeployment: MorphoMarketDeployment,
  wallet: Address
): Promise<MorphoLenderSnapshot> {
  await verifyDollarDeployment(publicClient, deployment);
  const morpho = deployment.morpho;
  if (!morpho) throw new Error("Morpho is not configured for this deployment.");
  const marketSnapshot = await loadMorphoMarket(publicClient, deployment, marketDeployment);
  const position = await publicClient.readContract({
    address: morpho.address,
    abi: morphoBlueAbi,
    functionName: "position",
    args: [marketDeployment.marketId, wallet],
  });
  return {
    market: marketSnapshot,
    position,
    suppliedAssets: morphoSupplyAssets(position, marketSnapshot.market),
    borrowedAssets: morphoBorrowAssets(position, marketSnapshot.market),
  };
}

export function maximumBorrowShares(assets: bigint, market: MorphoMarket): bigint {
  if (assets <= 0n) return 0n;
  const numerator = assets * (market.totalBorrowShares + 1_000_000n);
  const denominator = market.totalBorrowAssets + 1n;
  const quoted = (numerator + denominator - 1n) / denominator;
  return quoted + (quoted + 99n) / 100n;
}

export function maximumRepayAssets(shares: bigint, market: MorphoMarket): bigint {
  if (shares <= 0n) return 0n;
  const numerator = shares * (market.totalBorrowAssets + 1n);
  const denominator = market.totalBorrowShares + 1_000_000n;
  const quoted = (numerator + denominator - 1n) / denominator;
  return quoted + (quoted + 99n) / 100n + 1n;
}
