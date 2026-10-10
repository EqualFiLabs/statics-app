/** The Statics hook's per-pool charge: basis points of the input and of the output. */
export type HookFeeRate = Readonly<{ inputBps: number; outputBps: number }>;

/** Nominal combined rate, not an exact quote: each fee applies to a different swap leg. */
export function swapFeePercent(lpFeePips: number, hook: HookFeeRate | null) {
  const lp = lpFeePips / 10_000;
  const statics = hook ? (hook.inputBps + hook.outputBps) / 100 : null;
  return { total: statics === null ? null : lp + statics, lp, statics };
}
