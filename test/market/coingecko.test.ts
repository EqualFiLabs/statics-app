import { describe, expect, it } from "vitest";

import {
  coinGeckoCirculatingSupply,
  coinGeckoSupplyDisclosure,
  coinGeckoSupplyResult,
} from "@/lib/market/coingecko";
import type { MarketSupplySnapshot } from "@/lib/market/types";

const WAD = 10n ** 18n;
const supply = {
  status: "fresh",
  chainId: 4_663,
  deploymentId: "robinhood-genesis",
  tokenAddress: "0x2d8d6F4A93AcD7a916A5a654ec8b690bA3B3EAdd",
  decimals: 18,
  asOfBlock: "123",
  snapshotAt: "2026-09-01T12:00:00.000Z",
  total: (1_000_000_000n * WAD).toString(),
  poolInventory: (99_900_000n * WAD).toString(),
  publicDistributed: (700_100_000n * WAD).toString(),
  unreleasedTreasury: (100_100_000n * WAD).toString(),
  vaultBacking: (117_900_000n * WAD).toString(),
  strictLiquidFloat: (682_100_000n * WAD).toString(),
} satisfies MarketSupplySnapshot;

describe("CoinGecko market payloads", () => {
  it("keeps publicly tradable AMM inventory in circulating supply", () => {
    expect(coinGeckoCirculatingSupply(supply)).toBe(782_000_000n * WAD);
    expect(coinGeckoSupplyResult(supply.total, supply.decimals)).toEqual({
      result: "1000000000",
    });
    expect(
      coinGeckoSupplyResult(coinGeckoCirculatingSupply(supply).toString(), supply.decimals)
    ).toEqual({
      result: "782000000",
    });
    expect(coinGeckoSupplyDisclosure(supply)).toMatchObject({
      total_supply: "1000000000",
      circulating_supply: "782000000",
      exclusions: {
        unreleased_treasury_vesting: "100100000",
        operator_vault_backing: "117900000",
      },
      as_of_block: "123",
    });
  });

  it("rejects impossible exclusion totals", () => {
    expect(() =>
      coinGeckoCirculatingSupply({ ...supply, vaultBacking: (1_000_000_000n * WAD).toString() })
    ).toThrow("Circulating-supply exclusions exceed total supply.");
  });
});
