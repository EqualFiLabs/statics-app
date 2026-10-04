import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ cursor: 0n, limit: 0 }));
vi.mock("ponder", async (original) => ({
  ...(await original<typeof import("ponder")>()),
  gt: (_column: unknown, cursor: bigint) => {
    state.cursor = cursor;
    return undefined;
  },
}));
vi.mock("ponder:schema", () =>
  Object.fromEntries(
    [
      "activeGenesisCredit",
      "activeLoan",
      "genesisNft",
      "genesisRewardClaim",
      "harvestedFee",
      "gaugePoolState",
      "gaugeReserveState",
      "managedGaugePosition",
      "marketCandle",
      "marketSwap",
      "phaseOneActivity",
      "phaseOneMarketObservation",
      "phaseOneMarketSwap",
      "poolRewardSlot",
      "positionGaugeState",
      "positionNft",
      "publicPool",
      "rewardRestriction",
      "v4Position",
    ].map((name) => [name, {}])
  )
);
vi.mock("ponder:api", () => {
  const query = {
    select: () => query,
    from: () => query,
    where: () => query,
    orderBy: () => query,
    limit: async (limit: number) => {
      state.limit = limit;
      return Array.from({ length: 101 }, (_, index) => ({
        positionId: BigInt(index + 1),
        owner: `0x${"1".repeat(40)}`,
        stakedBalance: 0n,
        activeLegCount: 0n,
        unresolvedObligationCount: 0n,
        updatedAtBlock: 100n,
      }))
        .filter((row) => row.positionId > state.cursor)
        .slice(0, limit);
    },
  };
  return { db: query };
});
import app from "../src/api";
describe("owned position cursor API", () => {
  it("loads positions after 100 in ascending ID order", async () => {
    const owner = `0x${"1".repeat(40)}`;
    const first = await (await app.request(`/phase-one/wallets/${owner}/positions`)).json();
    expect(first.items).toHaveLength(100);
    expect(state.limit).toBe(101);
    expect(first.items[99].positionId).toBe("100");
    expect(first.nextCursor).toBeTruthy();
    const second = await (
      await app.request(`/phase-one/wallets/${owner}/positions?cursor=${first.nextCursor}`)
    ).json();
    expect(state.cursor).toBe(100n);
    expect(second.items.map((row: { positionId: string }) => row.positionId)).toEqual(["101"]);
    expect(second.nextCursor).toBeNull();
  });
  it("rejects malformed cursors", async () => {
    expect(
      (await app.request(`/phase-one/wallets/0x${"1".repeat(40)}/positions?cursor=nope`)).status
    ).toBe(400);
  });
});
