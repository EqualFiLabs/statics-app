import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { DexQuote } from "./dex-market";

/**
 * Sample market responses in the exact shape docs/dex-overview-indexer.md specifies, built
 * from the deployment's reviewed pools. Used by tests, and in development when
 * NEXT_PUBLIC_DEX_OVERVIEW_FIXTURES=true so the overview can be reviewed before the indexer
 * endpoints exist. Figures are invented; never enable this outside development.
 */
export function dexOverviewFixturesEnabled() {
  return (
    process.env.NEXT_PUBLIC_DEX_OVERVIEW_FIXTURES === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

const ETH_USD = 2_601n;
const scale = (decimals: number) => 10n ** BigInt(decimals);

export function dexFixture(
  deployment: PhaseOneDeployment,
  quote: DexQuote,
  options: Readonly<{
    sort?: string;
    search?: string;
    limit?: number;
    cursor?: string;
    days?: number;
  }> = {}
) {
  const weth = deployment.contracts.weth;
  const quoteDecimals = quote === "usdg" ? 6 : 18;
  const quoteToken = {
    kind: quote,
    address: quote === "usdg" ? "0x0000000000000000000000000000000000000d01" : weth,
    symbol: quote === "usdg" ? "USDG" : "WETH",
    decimals: quoteDecimals,
  };
  /** A dollar figure in quote units. */
  const usd = (dollars: number) => {
    const cents = BigInt(Math.round(dollars * 100));
    return quote === "usdg"
      ? String((cents * scale(quoteDecimals)) / 100n)
      : String((cents * scale(18)) / 100n / ETH_USD);
  };
  const base = {
    deploymentId: deployment.descriptor.deploymentId,
    indexedAtBlock: "84377580",
    indexedAtTimestamp: String(Math.floor(Date.now() / 1000)),
    quote: quoteToken,
  };
  const pools = deployment.supportedPools.filter((pool) => pool.enabled);
  const tokenOf = (t: (typeof pools)[number]["token0"]) => ({
    address: t.address,
    symbol: t.symbol,
    decimals: t.decimals,
    name: t.name ?? null,
  });
  // Deterministic, decreasing sample sizes so tables sort sensibly.
  const poolItems = pools.map((pool, index) => {
    const volume = 437_000 / (1 + index * 0.55);
    const unpriced = index === pools.length - 1 && pools.length > 3;
    return {
      poolId: pool.poolId,
      token0: tokenOf(pool.token0),
      token1: tokenOf(pool.token1),
      lpFee: 3000,
      pairPrice: (1 + ((index * 7919) % 97) / 13).toFixed(4),
      change24hBps: unpriced ? null : ((index * 131) % 600) - 200,
      volume24h: unpriced ? null : usd(volume),
      volume7d: unpriced ? null : usd(volume * 6.4),
      lpFees24h: unpriced ? null : usd(volume * 0.003),
      protocolFees24h: unpriced ? null : usd(volume * 0.0008),
      valueLocked: unpriced ? null : usd(volume * 7.1),
      amount0: String(BigInt(1000 + index * 37) * scale(pool.token0.decimals)),
      amount1: String(BigInt(2000 + index * 53) * scale(pool.token1.decimals)),
      incentiveStreams: index % 3,
      emissionShareBps: pools.length ? Math.floor(10000 / pools.length) : 0,
      estimatedYieldBps: unpriced ? null : Math.max(300, 4180 - index * 410),
      priced: !unpriced,
      source: "phase-one",
      priceFallback: false,
      liquidityComplete: true,
      historyStart: "0",
      createdAtBlock: String(index),
      yieldComponents: {
        lpFees: unpriced ? null : usd(volume * 0.003 * 7),
        gaugeCredits: unpriced ? null : usd(10),
        lpBribeAccrual: unpriced ? null : usd(10),
        complete: true,
        estimated: true,
      },
    };
  });
  const unpricedPool = (poolId: string) =>
    poolItems.some((item) => item.poolId === poolId && !item.priced);
  const tokens = [
    ...new Map(
      pools.flatMap((pool) => [pool.token0, pool.token1]).map((t) => [t.address.toLowerCase(), t])
    ).values(),
  ];
  const tokenItems = tokens.slice(0, 10).map((t, index) => ({
    token: tokenOf(t),
    price: usd(t.address.toLowerCase() === weth.toLowerCase() ? 2601 : 0.0115 + index * 31.7),
    change24hBps: ((index * 97) % 500) - 150,
    volume24h: usd(285_000 / (1 + index)),
    priceNumerator: usd(
      t.address.toLowerCase() === weth.toLowerCase() ? 2601 : 0.0115 + index * 31.7
    ),
    priceDenominator: "1",
    priceFallback: false,
    route: pools
      .filter((pool) => pool.token0.address === t.address || pool.token1.address === t.address)
      .slice(0, 1)
      .map((pool) => pool.poolId),
  }));
  const series = [
    182, 176, 195, 204, 188, 214, 233, 221, 240, 236, 252, 247, 263, 281, 270, 289, 301, 294, 312,
    305, 327, 318, 336, 349, 341, 362, 371, 358, 348, 412,
  ];
  const today = new Date();
  const day = (offset: number) =>
    new Date(today.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
  const now = Math.floor(Date.now() / 1000);
  const coverage = Object.fromEntries(
    ["volume", "lpFees", "protocolFees", "valueLocked"].map((key) => [
      key,
      {
        includedPools: poolItems.filter((p) => p.priced).length,
        omittedPools: poolItems.filter((p) => !p.priced).length,
        historyComplete: true,
      },
    ])
  );
  const sort = options.sort ?? "volume",
    field =
      sort === "volume"
        ? "volume24h"
        : sort === "valueLocked"
          ? "valueLocked"
          : sort === "yield"
            ? "estimatedYieldBps"
            : "createdAtBlock";
  const filtered = poolItems
    .filter((p) =>
      [
        p.poolId,
        p.token0.address,
        p.token1.address,
        p.token0.symbol,
        p.token1.symbol,
        p.token0.name,
        p.token1.name,
      ].some((v) => v?.toLowerCase().includes(options.search?.trim().toLowerCase() ?? ""))
    )
    .sort((a, b) => {
      const x = a[field],
        y = b[field];
      return x === null
        ? 1
        : y === null
          ? -1
          : BigInt(x) > BigInt(y)
            ? -1
            : BigInt(x) < BigInt(y)
              ? 1
              : a.poolId.localeCompare(b.poolId);
    });
  const offset = Number(options.cursor ?? 0),
    limit = options.limit ?? 25;
  return {
    summary: {
      ...base,
      current: {
        volume: usd(1_073_000),
        lpFees: usd(2_550),
        protocolFees: usd(670),
        swaps: "3182",
        wallets: "612",
        valueLocked: usd(7_650_000),
        coverage,
      },
      previous: {
        volume: usd(906_000),
        lpFees: usd(2_150),
        protocolFees: usd(565),
        swaps: "2875",
        wallets: "580",
        valueLocked: usd(7_485_000),
        coverage,
      },
      activePools: pools.length,
      unpricedPools: poolItems.filter((pool) => !pool.priced).length,
      statics: { price: usd(0.01149), change24hBps: 310 },
    },
    pools: {
      ...base,
      items: filtered.slice(offset, offset + limit),
      nextCursor: offset + limit < filtered.length ? String(offset + limit) : null,
      total: filtered.length,
    },
    tokens: { ...base, items: tokenItems },
    volume: {
      ...base,
      days: Array.from({ length: options.days ?? 30 }, (_, index) => ({
        value: series[index % series.length]!,
        index,
      })).map(({ value, index }, _, shown) => ({
        day: day(shown.length - 1 - index),
        volume: usd(value * 2601),
        swaps: String(value * 8),
        provisional: index === (options.days ?? 30) - 1,
      })),
    },
    emissions: {
      ...base,
      period: {
        budget: String(1_200_000n * 10n ** 18n),
        start: String(now - 4 * 86_400),
        finish: String(now + 3 * 86_400 + 4 * 3600),
        emitted: String(690_000n * 10n ** 18n),
        accounted: String(690_000n * 10n ** 18n),
        activated: true,
        expired: false,
        observedAtBlock: "84377580",
        observedAtTimestamp: String(now),
      },
      pools: poolItems
        .filter((pool) => pool.emissionShareBps > 0)
        .slice(0, 4)
        .map(({ poolId, token0, token1, emissionShareBps }) => ({
          poolId,
          token0,
          token1,
          shareBps: emissionShareBps,
        })),
      othersBps: Math.max(
        0,
        10_000 -
          poolItems
            .filter((pool) => pool.emissionShareBps > 0)
            .slice(0, 4)
            .reduce((sum, pool) => sum + pool.emissionShareBps, 0)
      ),
    },
    trades: {
      ...base,
      items: [...new Set([...pools.slice(0, 5), ...pools.slice(-1)])].map((pool, index) => ({
        poolId: pool.poolId,
        tokenIn: tokenOf(index % 2 ? pool.token1 : pool.token0),
        tokenOut: tokenOf(index % 2 ? pool.token0 : pool.token1),
        amountIn: String(
          BigInt(3 + index) * scale((index % 2 ? pool.token1 : pool.token0).decimals)
        ),
        amountOut: String(
          BigInt(5 + index * 2) * scale((index % 2 ? pool.token0 : pool.token1).decimals)
        ),
        value: unpricedPool(pool.poolId) ? null : usd(534 + index * 1210),
        sender: "0x81709E16Bf99936891Cc720689f269103fabeD91",
        transactionHash: `0x${String(index + 1).repeat(64)}`,
        timestamp: String(now - 12 - index * 37),
        priced: !unpricedPool(pool.poolId),
        logIndex: index,
        settlement: "wallet",
      })),
    },
  };
}
