import { deploymentRegistry, ROBINHOOD_GENESIS_DEPLOYMENT_ID } from "@/lib/deployments/registry";
import { coinGeckoTicker } from "@/lib/market/coingecko";
import { loadMarketOverview, loadMarketSupplySnapshot } from "@/lib/server/market-overview";

function mainnetLaunch() {
  const launch = deploymentRegistry().find(
    (option) => option.descriptor.deploymentId === ROBINHOOD_GENESIS_DEPLOYMENT_ID
  )?.launch;
  if (!launch) throw new Error("The reviewed Robinhood launch manifest is unavailable.");
  return launch;
}

export async function loadCoinGeckoSupply() {
  return loadMarketSupplySnapshot();
}

export async function loadCoinGeckoTicker() {
  return coinGeckoTicker(await loadMarketOverview());
}

export function loadCoinGeckoPairs() {
  const launch = mainnetLaunch();
  return [
    {
      ticker_id: "STATICS_WETH",
      base_currency: "STATICS",
      target_currency: "WETH",
      base_address: launch.contracts.statics,
      target_address: launch.contracts.weth,
      pool_id: launch.market.poolId,
      chain_id: launch.descriptor.chainId,
      fee_bps: launch.market.poolKey.fee / 100,
      trade_url: "https://staticsprotocol.com/app/swap",
    },
  ] as const;
}
