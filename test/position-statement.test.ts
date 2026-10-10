import { describe, expect, it, vi } from "vitest";
import { zeroAddress } from "viem";
import { parsePositionStatement } from "@/lib/indexer/position-statement";
import { loadPositionStatement, StatementHistoryChangedError } from "@/lib/indexer/phase-one";
const { fetchIndexer } = vi.hoisted(() => ({ fetchIndexer: vi.fn() }));
vi.mock("@/lib/indexer/statics", () => ({
  fetchIndexer,
  configuredIndexerUrlForDeployment: () => "http://localhost:42070",
}));
const hash = `0x${"1".repeat(64)}`,
  wallet = `0x${"1".repeat(40)}` as const,
  token = `0x${"2".repeat(40)}` as const;
const item = {
  key: `selected:${hash}:4`,
  positionId: "30",
  eventName: "RewardClaimed",
  category: "rewards",
  transactionHash: hash,
  logIndex: 4,
  blockNumber: "100",
  blockHash: hash,
  timestamp: "1000",
  transactionSender: wallet,
  ownerBefore: wallet,
  ownerAfter: wallet,
  poolId: null,
  posmTokenId: null,
  newPosmTokenId: null,
  poolCurrencies: null,
  stakingAsset: null,
  payload: { positionId: "30", receiver: wallet, asset: token, debited: "1", received: "1" },
  movements: [
    {
      ordinal: 0,
      asset: { address: token, symbol: null, name: null, decimals: null },
      space: "internal",
      direction: "debit",
      purpose: "reward-payout-debit",
      actor: null as string | null,
      amount: "1",
    },
    {
      ordinal: 1,
      asset: { address: token, symbol: null, name: null, decimals: null },
      space: "wallet",
      direction: "credit",
      purpose: "reward-payout",
      actor: wallet,
      amount: "1",
    },
  ],
};
const page = () => ({
  deploymentId: "selected",
  positionId: "30",
  historyStart: { blockNumber: "90", openingObserved: true },
  observationBoundary: { blockNumber: "100", blockHash: hash, digest: hash, timestamp: "1000" },
  items: [structuredClone(item)],
  nextCursor: null,
});
describe("strict statement loader", () => {
  it("preserves tiny rewards, exact payloads and nullable metadata", () => {
    const parsed = parsePositionStatement(page(), "selected", 30n);
    expect(parsed.items[0].movements[0].amount).toBe(1n);
    expect(parsed.items[0].payload).toMatchObject({ received: 1n });
    expect(parsed.items[0].movements[0].asset.symbol).toBeNull();
  });
  it.each([
    (p: ReturnType<typeof page>) => (p.deploymentId = "other"),
    (p: ReturnType<typeof page>) => (p.items[0].payload.positionId = "31"),
    (p: ReturnType<typeof page>) => (p.items[0].category = "liquidity"),
    (p: ReturnType<typeof page>) => (p.items[0].blockNumber = "101"),
    (p: ReturnType<typeof page>) => (p.items[0].payload.debited = "-1"),
    (p: ReturnType<typeof page>) => (p.items[0].payload.received = String(1n << 256n)),
    (p: ReturnType<typeof page>) => (p.items[0].movements[0].actor = zeroAddress),
    (p: ReturnType<typeof page>) => (p.items[0].movements[0].ordinal = 1),
    (p: ReturnType<typeof page>) => (p.items[0].movements[0].amount = "0"),
    (p: ReturnType<typeof page>) => (p.items[0].movements[1].amount = "100"),
    (p: ReturnType<typeof page>) => (p.items[0].movements[1].actor = token),
    (p: ReturnType<typeof page>) => (p.items[0].movements[1].asset.address = wallet),
    (p: ReturnType<typeof page>) => p.items[0].movements.pop(),
    (p: ReturnType<typeof page>) =>
      p.items[0].movements.push({ ...p.items[0].movements[1], ordinal: 2 }),
    (p: ReturnType<typeof page>) => p.items.push(p.items[0]),
  ])("rejects malformed and inconsistent responses", (mutate) => {
    const response = page();
    mutate(response);
    expect(() => parsePositionStatement(response, "selected", 30n)).toThrow(
      "invalid position statement"
    );
  });
  it("parses tuple movement and exact allocation arrays", () => {
    const response = page(),
      row = response.items[0] as unknown as Record<string, unknown>;
    Object.assign(row, {
      eventName: "ManagedLiquidityChanged",
      category: "liquidity",
      poolId: hash,
      posmTokenId: "8",
      payload: {
        positionId: "30",
        poolId: hash,
        posmTokenId: "8",
        movement: {
          liquidityBefore: "1",
          liquidityAfter: "2",
          payer: wallet,
          receiver: wallet,
          paid0: "3",
          received0: "1",
          paid1: "0",
          received1: "0",
        },
      },
      poolCurrencies: [zeroAddress, token],
      movements: [
        {
          ordinal: 0,
          asset: { address: zeroAddress, symbol: "ETH", name: "Ether", decimals: 18 },
          space: "wallet",
          direction: "debit",
          purpose: "liquidity-funding",
          actor: wallet,
          amount: "3",
        },
        {
          ordinal: 1,
          asset: { address: zeroAddress, symbol: "ETH", name: "Ether", decimals: 18 },
          space: "wallet",
          direction: "credit",
          purpose: "liquidity-refund",
          actor: wallet,
          amount: "1",
        },
      ],
    });
    expect(parsePositionStatement(response, "selected", 30n).items[0].payload).toMatchObject({
      movement: { paid0: 3n, liquidityAfter: 2n },
    });
    const correct = row.movements;
    row.movements = [];
    expect(() => parsePositionStatement(response, "selected", 30n)).toThrow();
    row.movements = correct;
    row.poolCurrencies = [token, zeroAddress];
    expect(() => parsePositionStatement(response, "selected", 30n)).toThrow();
    Object.assign(row, {
      eventName: "PositionGaugeAllocationsSet",
      category: "allocations",
      poolId: null,
      posmTokenId: null,
      poolCurrencies: null,
      movements: [],
      payload: {
        positionId: "30",
        nextAllocationAt: "100",
        totalAllocated: "4",
        poolIds: [hash],
        amounts: ["4"],
      },
    });
    expect(parsePositionStatement(response, "selected", 30n).items[0].payload).toMatchObject({
      amounts: [4n],
      nextAllocationAt: 100,
    });
    (row.payload as Record<string, unknown>).totalAllocated = "5";
    expect(() => parsePositionStatement(response, "selected", 30n)).toThrow();
  });
  it("keeps the mint recipient separate from ownership after a creation callback", () => {
    const response = page();
    Object.assign(response.items[0], {
      eventName: "PositionCreated",
      category: "lifecycle",
      ownerBefore: null,
      ownerAfter: token,
      payload: { positionId: "30", owner: wallet },
      movements: [],
    });
    expect(parsePositionStatement(response, "selected", 30n).items[0].ownerAfter).toBe(token);
  });
  it("preserves filters and recognizes replay restarts and unknown positions", async () => {
    fetchIndexer.mockResolvedValueOnce(new Response(JSON.stringify(page())));
    await loadPositionStatement({
      deploymentId: "selected",
      positionId: 30n,
      filters: { category: "rewards", asset: token, limit: 10 },
    });
    expect(fetchIndexer).toHaveBeenLastCalledWith(
      `http://localhost:42070/phase-one/positions/30/statement?category=rewards&asset=${token}&limit=10`,
      "no-store"
    );
    fetchIndexer.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "STATEMENT_HISTORY_CHANGED" }), { status: 409 })
    );
    await expect(
      loadPositionStatement({ deploymentId: "selected", positionId: 30n })
    ).rejects.toBeInstanceOf(StatementHistoryChangedError);
    fetchIndexer.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    await expect(
      loadPositionStatement({ deploymentId: "selected", positionId: 30n })
    ).rejects.toThrow("404");
  });
});
