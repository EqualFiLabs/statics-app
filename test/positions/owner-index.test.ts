import type { Address, PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import { loadOwnedPositionIds } from "@/lib/positions/owner-index";

const diamond = "0x0000000000000000000000000000000000000010" as Address;
const wallet = "0x0000000000000000000000000000000000000001" as Address;

describe("Position owner index", () => {
  it("reads every page at one current block", async () => {
    const allPositionIds = Array.from({ length: 205 }, (_, index) => BigInt(index + 1));
    const readContract = vi.fn().mockImplementation(({ functionName, args, blockNumber }) => {
      expect(blockNumber).toBe(500n);
      if (functionName === "balanceOf" || functionName === "positionCount") {
        return Promise.resolve(205n);
      }
      if (functionName === "positionsOfOwner") {
        const cursor = args[1] as bigint;
        const page = allPositionIds.slice(Number(cursor), Number(cursor + 100n));
        return Promise.resolve([page, cursor + BigInt(page.length)]);
      }
      throw new Error(`Unexpected read: ${functionName}`);
    });
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(500n),
      readContract,
    } as unknown as PublicClient;

    await expect(loadOwnedPositionIds(publicClient, diamond, wallet)).resolves.toEqual(
      allPositionIds
    );
    expect(
      readContract.mock.calls.filter(([request]) => request.functionName === "positionsOfOwner")
    ).toHaveLength(3);
  });

  it("reports an unsynchronized legacy owner index instead of showing zero", async () => {
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(500n),
      readContract: vi.fn().mockImplementation(({ functionName }) => {
        if (functionName === "balanceOf") return Promise.resolve(2n);
        if (functionName === "positionCount") return Promise.resolve(0n);
        throw new Error(`Unexpected read: ${functionName}`);
      }),
    } as unknown as PublicClient;

    await expect(loadOwnedPositionIds(publicClient, diamond, wallet)).rejects.toThrow(
      "indexed 0 of 2"
    );
  });
});
