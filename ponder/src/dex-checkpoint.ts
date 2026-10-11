// Ponder 0.17.4 checkpoint encoding: timestamp(10), chain(16), block(16), transaction(16), type(1), event(16).
export function checkpointObservation(checkpoint: string | null) {
  if (!checkpoint || !/^\d{75}$/.test(checkpoint)) throw new Error("Market checkpoint unavailable");
  return { time: BigInt(checkpoint.slice(0, 10)), block: BigInt(checkpoint.slice(26, 42)) };
}
