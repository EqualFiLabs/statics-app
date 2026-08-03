"use client";

import type { Address, PublicClient } from "viem";

import { staticsDollarCoreAbi, staticsDollarRiskTokenAbi } from "@statics-protocol/sdk";

import type { DollarDeployment } from "@/lib/dollar/deployment";

/**
 * Risk shares held by a wallet, by series.
 *
 * These are ERC-1155, but they belong in the token list rather than the NFT
 * one: a risk share is a divisible balance in a series, not a distinct
 * collectible. Someone holding 7,835 of series 1 is holding a quantity of one
 * thing, which is what the token list is for.
 *
 * Series cannot be enumerated from the token, so they are walked from zero up
 * to the profile's active series. That is exact rather than a guess -- ids are
 * assigned sequentially and the active one is the highest that exists -- and
 * cheap, because a profile has a handful of series over its life rather than
 * thousands.
 */

export type RiskShareBalance = Readonly<{
  seriesId: bigint;
  balance: bigint;
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
}>;

export async function loadRiskShareBalances(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  wallet: Address
): Promise<readonly RiskShareBalance[]> {
  const profile = await publicClient.readContract({
    address: deployment.contracts.core,
    abi: staticsDollarCoreAbi,
    functionName: "collateralProfile",
    args: [deployment.wethProfileId],
  });

  const [name, symbol] = await Promise.all([
    publicClient
      .readContract({
        address: deployment.contracts.risk,
        abi: staticsDollarRiskTokenAbi,
        functionName: "name",
      })
      .catch(() => "Risk shares"),
    publicClient
      .readContract({
        address: deployment.contracts.risk,
        abi: staticsDollarRiskTokenAbi,
        functionName: "symbol",
      })
      .catch(() => "RISK"),
  ]);

  const seriesIds: bigint[] = [];
  for (let id = 0n; id <= profile.activeSeriesId; id += 1n) seriesIds.push(id);

  const balances = await Promise.all(
    seriesIds.map((seriesId) =>
      publicClient
        .readContract({
          address: deployment.contracts.risk,
          abi: staticsDollarRiskTokenAbi,
          functionName: "balanceOf",
          args: [wallet, seriesId],
        })
        .catch(() => 0n)
    )
  );

  // Only series actually held. A retired series with nothing in it is noise.
  return seriesIds
    .map((seriesId, index) => ({
      seriesId,
      balance: balances[index],
      // Series is part of the identity: two series of the same token are not
      // interchangeable, so the row has to say which one.
      symbol: `${symbol} · Series ${seriesId.toString()}`,
      name,
      address: deployment.contracts.risk,
      decimals: 18,
    }))
    .filter((entry) => entry.balance > 0n);
}
