import { loadMarketSupplySnapshot } from "@/lib/server/market-overview";

export async function loadCoinGeckoSupply() {
  return loadMarketSupplySnapshot();
}
