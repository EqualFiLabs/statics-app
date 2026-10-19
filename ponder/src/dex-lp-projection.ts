import { activeLiquidity, type MarketPool } from "./dex-domain";
import { ratio, value, type Ratio } from "./dex-pricing";
import type { DexSnapshot } from "./dex-snapshot";

const WEEK = 604800n;
const YEAR = 52n * WEEK;

/** Current LP reward run rate, not a forecast of future funding or individual range returns. */
export function projectLpRewards(
  pool: MarketPool,
  now: bigint,
  eligibleValueLocked: bigint | null,
  price: (asset: string) => Ratio | undefined,
  reserve: DexSnapshot["reserve"],
  allocation: DexSnapshot["allocations"][number] | undefined,
  staticsAsset: string | null
) {
  const running = pool.initialized && !pool.stopped;
  const inRange = activeLiquidity(pool) > 0n;
  const schedules = running
    ? pool.streams.filter(
        (s) =>
          BigInt(s.finish) > now &&
          BigInt(s.start) <= now &&
          BigInt(s.finish) > BigInt(s.start) &&
          BigInt(s.budget) > BigInt(s.emitted)
      )
    : [];
  const reserveActive =
    running &&
    !pool.quarantined &&
    !pool.decommissioned &&
    allocation?.eligible === true &&
    reserve?.activated === true &&
    BigInt(reserve.periodStart) <= now &&
    now < BigInt(reserve.periodFinish) &&
    BigInt(reserve.periodBudget) > 0n &&
    BigInt(reserve.totalAllocatedWeight) > 0n &&
    BigInt(allocation.weight) > 0n;
  const funded = schedules.length > 0 || reserveActive;
  const assets = [...new Set(schedules.map((s) => s.asset.toLowerCase()))];
  if (reserveActive && staticsAsset && !assets.includes(staticsAsset.toLowerCase()))
    assets.push(staticsAsset.toLowerCase());
  // Scale by the year before valuing to retain sub-quote-unit reward rates.
  const annualValue = (asset: string | null, amount: Ratio) => {
    if (amount.n === 0n) return 0n;
    const p = asset ? price(asset) : undefined;
    return p ? value(amount.n, ratio(p.n, p.d * amount.d)) : null;
  };
  let creatorAnnualRewards: bigint | null = 0n;
  if (inRange)
    for (const s of schedules) {
      const v = annualValue(
        s.asset,
        ratio(BigInt(s.budget) * YEAR, BigInt(s.finish) - BigInt(s.start))
      );
      if (v === null) {
        creatorAnnualRewards = null;
        break;
      }
      creatorAnnualRewards += v;
    }
  const gaugeAnnualRewards =
    inRange && reserveActive
      ? annualValue(
          staticsAsset,
          ratio(
            BigInt(reserve.periodBudget) * YEAR * BigInt(allocation.weight),
            WEEK * BigInt(reserve.totalAllocatedWeight)
          )
        )
      : 0n;
  const annualRewardValue =
    creatorAnnualRewards === null || gaugeAnnualRewards === null
      ? null
      : creatorAnnualRewards + gaugeAnnualRewards;
  const bps =
    annualRewardValue !== null && eligibleValueLocked !== null && eligibleValueLocked > 0n
      ? (annualRewardValue * 10000n) / eligibleValueLocked
      : null;
  return {
    projectedLpAprBps: bps !== null && bps <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(bps) : null,
    lpRewardProjection: {
      eligibleValueLocked,
      annualRewardValue,
      creatorAnnualRewards,
      gaugeAnnualRewards,
      status: funded ? (inRange ? "active" : "paused") : "inactive",
      assets,
      basis: "current-lp-reward-rate-over-managed-principal",
    },
  };
}
