import { describe, expect, it, vi } from "vitest";

import { loadEventHistoryInChunks } from "@/lib/protocol/event-history";

describe("hosted RPC event history", () => {
  it("bounds inclusive block ranges to ten thousand blocks", async () => {
    const loadChunk = vi.fn(async (fromBlock: bigint, toBlock: bigint) => [
      `${fromBlock.toString()}-${toBlock.toString()}`,
    ]);

    await expect(loadEventHistoryInChunks(100n, 20_100n, loadChunk)).resolves.toEqual([
      "100-10099",
      "10100-20099",
      "20100-20100",
    ]);
  });

  it("does not query an empty range", async () => {
    const loadChunk = vi.fn();
    await expect(loadEventHistoryInChunks(2n, 1n, loadChunk)).resolves.toEqual([]);
    expect(loadChunk).not.toHaveBeenCalled();
  });
});
