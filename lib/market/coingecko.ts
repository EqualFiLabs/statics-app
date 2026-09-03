import { formatUnits } from "viem";

import type { MarketSupplySnapshot } from "@/lib/market/types";

export function coinGeckoCirculatingSupply(snapshot: MarketSupplySnapshot): bigint {
  const total = BigInt(snapshot.total);
  const excluded = BigInt(snapshot.unreleasedTreasury) + BigInt(snapshot.vaultBacking);
  if (excluded > total) throw new Error("Circulating-supply exclusions exceed total supply.");
  return total - excluded;
}

export function coinGeckoSupplyResult(raw: string, decimals: number): Readonly<{ result: string }> {
  return { result: formatUnits(BigInt(raw), decimals) };
}

export function coinGeckoSupplyDisclosure(snapshot: MarketSupplySnapshot) {
  const circulatingSupply = coinGeckoCirculatingSupply(snapshot);
  return {
    schema_version: 1,
    asset: "STATICS",
    chain_id: snapshot.chainId,
    contract_address: snapshot.tokenAddress,
    decimals: snapshot.decimals,
    total_supply: formatUnits(BigInt(snapshot.total), snapshot.decimals),
    circulating_supply: formatUnits(circulatingSupply, snapshot.decimals),
    public_distributed_supply: formatUnits(BigInt(snapshot.publicDistributed), snapshot.decimals),
    exclusions: {
      unreleased_treasury_vesting: formatUnits(
        BigInt(snapshot.unreleasedTreasury),
        snapshot.decimals
      ),
      operator_vault_backing: formatUnits(BigInt(snapshot.vaultBacking), snapshot.decimals),
    },
    methodology:
      "total_supply - unreleased_treasury_vesting - operator_vault_backing; canonical AMM pool inventory remains circulating because it is publicly tradable",
    status: snapshot.status,
    as_of_block: snapshot.asOfBlock,
    updated_at: snapshot.snapshotAt,
  } as const;
}
