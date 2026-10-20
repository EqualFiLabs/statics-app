import { activeLiquidity, advanceStreams, type DexMetadata, type MarketPool } from "./dex-domain";
import type { DexSnapshot } from "./dex-snapshot";

export const INCENTIVE_WEEK = 604800n;
export type AllocatorSchedule = {
  asset: DexMetadata;
  lastUpdate: string;
  periodFinish: string;
  periodBudget: string;
  periodEmitted: string;
  funded: boolean;
  invalidated: boolean;
  terminated: boolean;
};

/** Funded rewards over the next seven days, capped at each schedule's actual end. */
export function weeklyPoolIncentives(
  pool: MarketPool,
  allocation: DexSnapshot["allocations"][number] | undefined,
  now: bigint
) {
  const lp = new Map<string, bigint>(),
    allocator = new Map<string, bigint>();
  const running = pool.initialized && !pool.stopped;
  const lpPaused = running && activeLiquidity(pool) === 0n;
  const allocatorPaused =
    running && allocation?.eligible === true && BigInt(allocation.weight) === 0n;
  const add = (target: Map<string, bigint>, asset: string, amount: bigint) => {
    const key = asset.toLowerCase();
    target.set(key, (target.get(key) ?? 0n) + amount);
  };
  if (running) {
    // Work on copies: quiet-pool projection must not advance the cached market snapshot.
    const current = structuredClone(pool);
    advanceStreams(current, now);
    const future = structuredClone(current);
    advanceStreams(future, now + INCENTIVE_WEEK);
    for (const [index, stream] of current.streams.entries()) {
      if (stream.slot === 0 || BigInt(stream.budget) <= BigInt(stream.emitted)) continue;
      add(lp, stream.asset, BigInt(future.streams[index]!.emitted) - BigInt(stream.emitted));
    }
    if (allocation?.eligible)
      for (const stream of allocation.allocatorStreams ?? []) {
        if (!stream.funded || stream.terminated || stream.invalidated) continue;
        const last = BigInt(stream.lastUpdate),
          finish = BigInt(stream.periodFinish);
        const remaining = BigInt(stream.periodBudget) - BigInt(stream.periodEmitted);
        if (last > now || remaining < 0n) throw new Error("Invalid allocator schedule observation");
        if (finish <= last || remaining === 0n || (!allocatorPaused && finish <= now)) continue;
        const elapsed = now - last;
        const duration = finish - last;
        // Match the contract's remaining-budget rounding, then cap the next checkpoint at finish.
        const earned = allocatorPaused ? 0n : (remaining * elapsed) / duration;
        const timeLeft = finish - now;
        const window = timeLeft < INCENTIVE_WEEK ? timeLeft : INCENTIVE_WEEK;
        const amount = allocatorPaused ? 0n : ((remaining - earned) * window) / timeLeft;
        add(allocator, stream.asset.address, amount);
      }
  }
  return { lp, allocator, lpPaused, allocatorPaused };
}
