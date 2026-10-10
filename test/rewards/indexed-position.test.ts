import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, InfiniteQueryObserver } from "@tanstack/react-query";
import { waitForIndexedPosition } from "@/lib/rewards/indexed-position";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/indexer/phase-one", () => ({ loadIndexedPhaseOnePositions: mocks.load }));
const wallet = `0x${"1".repeat(40)}` as const;
const item = (id: bigint) => ({
  positionId: id,
  owner: wallet,
  stakedBalance: 0n,
  activeLegCount: 0n,
  unresolvedObligationCount: 0n,
  updatedAtBlock: 1n,
});
const page = (ids: bigint[], cursor: string | null) => ({
  deploymentId: "fixture",
  indexedAtBlock: 1n,
  items: ids.map(item),
  nextCursor: cursor,
});
beforeEach(() => mocks.load.mockReset());
async function ownership() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const observer = new InfiniteQueryObserver(queryClient, {
    queryKey: protocolQueryKeys.phaseOnePositions("fixture", wallet),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => mocks.load(wallet, "fixture", undefined, pageParam),
    getNextPageParam: (next: ReturnType<typeof page>) => next.nextCursor ?? undefined,
  });
  const stop = observer.subscribe(() => {});
  await observer.refetch();
  return {
    queryClient,
    stop: () => {
      stop();
      queryClient.clear();
    },
  };
}
describe("receipt-driven ownership discovery", () => {
  it("follows unloaded ownership pages to discover NFT 101", async () => {
    mocks.load.mockImplementation(async (_w, _d, _u, cursor) =>
      cursor
        ? page([101n], null)
        : page(
            Array.from({ length: 100 }, (_, i) => BigInt(i + 1)),
            "100"
          )
    );
    const query = await ownership();
    expect(
      await waitForIndexedPosition({
        queryClient: query.queryClient,
        deploymentId: "fixture",
        wallet,
        positionId: 101n,
        timeoutMs: 500,
      })
    ).toBe(true);
    expect(mocks.load.mock.calls.some((call) => call[3] === "100")).toBe(true);
    query.stop();
  });
  it("returns incomplete discovery rather than failing a confirmed transaction", async () => {
    mocks.load.mockImplementation(async (_w, _d, _u, cursor) => {
      if (cursor) throw Error("Indexer unavailable");
      return page([1n], "1");
    });
    const query = await ownership();
    expect(
      await waitForIndexedPosition({
        queryClient: query.queryClient,
        deploymentId: "fixture",
        wallet,
        positionId: 2n,
        timeoutMs: 500,
      })
    ).toBe(false);
    query.stop();
  });
  it("stops a repeating ownership cursor", async () => {
    mocks.load.mockResolvedValue(page([1n], "1"));
    const query = await ownership();
    expect(
      await waitForIndexedPosition({
        queryClient: query.queryClient,
        deploymentId: "fixture",
        wallet,
        positionId: 2n,
        timeoutMs: 500,
      })
    ).toBe(false);
    query.stop();
  });
  it("returns immediately when the confirmed NFT is already present", async () => {
    mocks.load.mockResolvedValue(page([1n], null));
    const query = await ownership();
    expect(
      await waitForIndexedPosition({
        queryClient: query.queryClient,
        deploymentId: "fixture",
        wallet,
        positionId: 1n,
        timeoutMs: 0,
      })
    ).toBe(true);
    query.stop();
  });
});
