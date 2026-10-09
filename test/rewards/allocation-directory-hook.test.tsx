import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hex } from "viem";
import type { PhaseOneDeployment } from "@/lib/deployments/types";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/indexer/phase-one", async (original) => ({
  ...(await original<typeof import("@/lib/indexer/phase-one")>()),
  loadAllocationDirectory: mocks.load,
}));
import { AllocationDirectoryChangedError } from "@/lib/indexer/phase-one";
import { useAllocationDirectory, useAllocationPools } from "@/hooks/useAllocationDirectory";

const deployment = { descriptor: { deploymentId: "local" } } as unknown as PhaseOneDeployment;
const pool = (n: number) => ({ poolId: `0x${String(n).padStart(64, "0")}` as Hex });
const page = (items: { poolId: Hex }[], nextCursor: string | null, total = 3) => ({
  deploymentId: "local",
  indexedAtBlock: 1n,
  indexedAtTimestamp: 1n,
  directoryRevision: 1n,
  reserve: null,
  items,
  nextCursor,
  total,
});
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => mocks.load.mockReset());

describe("useAllocationDirectory", () => {
  it("pages with the indexer's cursor and forwards filters", async () => {
    mocks.load
      .mockResolvedValueOnce(page([pool(1), pool(2)], "next"))
      .mockResolvedValueOnce(page([pool(3)], null));
    const { result } = renderHook(
      () => useAllocationDirectory(deployment, { sort: "incentives", hasIncentives: true }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.pools).toHaveLength(2));
    expect(result.current).toMatchObject({ total: 3, hasMore: true });
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.pools).toHaveLength(3));
    expect(result.current.hasMore).toBe(false);
    expect(mocks.load.mock.calls[1][0]).toEqual({
      deploymentId: "local",
      filters: { sort: "incentives", hasIncentives: true, cursor: "next" },
    });
  });

  it("reports a mid-paging directory change and restarts from the first page", async () => {
    mocks.load
      .mockResolvedValueOnce(page([pool(1)], "next"))
      .mockRejectedValueOnce(new AllocationDirectoryChangedError())
      .mockResolvedValueOnce(page([pool(9)], null, 1));
    const { result } = renderHook(() => useAllocationDirectory(deployment, {}), { wrapper });
    await waitFor(() => expect(result.current.pools).toHaveLength(1));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.changed).toBe(true));
    expect(result.current.unavailable).toBe(false);
    act(() => result.current.restart());
    await waitFor(() =>
      expect(result.current.pools.map((p) => p.poolId)).toEqual([pool(9).poolId])
    );
    expect(result.current.changed).toBe(false);
    // The restart re-requests the first page without a cursor.
    expect(mocks.load.mock.calls[2][0].filters.cursor).toBeUndefined();
  });
});

describe("useAllocationPools", () => {
  it("resolves exact pools, including ineligible ones, by pool ID", async () => {
    const wanted = pool(7).poolId;
    mocks.load.mockResolvedValue(page([pool(70), pool(7)], null, 2));
    const { result } = renderHook(() => useAllocationPools(deployment, [wanted, wanted]), {
      wrapper,
    });
    await waitFor(() => expect(result.current.poolOf(wanted)?.poolId).toBe(wanted));
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.load.mock.calls[0][0].filters).toEqual({
      search: wanted,
      eligible: "all",
      limit: 5,
    });
  });
});
