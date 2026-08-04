const MAX_EVENT_BLOCKS_PER_REQUEST = 10_000n;

/**
 * Keeps genuinely historical event discovery inside common hosted-RPC limits.
 * Current ownership and balances must use contract state instead.
 */
export async function loadEventHistoryInChunks<T>(
  fromBlock: bigint,
  toBlock: bigint,
  loadChunk: (fromBlock: bigint, toBlock: bigint) => Promise<readonly T[]>
): Promise<T[]> {
  if (fromBlock > toBlock) return [];

  const events: T[] = [];
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const chunkEnd =
      cursor + MAX_EVENT_BLOCKS_PER_REQUEST - 1n < toBlock
        ? cursor + MAX_EVENT_BLOCKS_PER_REQUEST - 1n
        : toBlock;
    events.push(...(await loadChunk(cursor, chunkEnd)));
    cursor = chunkEnd + 1n;
  }
  return events;
}
