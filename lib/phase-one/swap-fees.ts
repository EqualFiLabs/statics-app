/** The Statics hook's per-pool charge: pips of the input and of the output. */
export type HookFeeRate = Readonly<{ inputPips: number; outputPips: number }>;

/** Nominal combined rate, not an exact quote: each fee applies to a different swap leg. */
export function swapFeePercent(lpFeePips: number, hook: HookFeeRate | null) {
  const lp = lpFeePips / 10_000;
  const statics = hook ? (hook.inputPips + hook.outputPips) / 10_000 : null;
  return { total: statics === null ? null : lp + statics, lp, statics };
}
