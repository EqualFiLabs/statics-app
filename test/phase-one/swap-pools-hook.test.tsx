import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAddress } from "viem";
import { v4PoolId } from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { AllocationDirectoryPage, IndexedAllocationPool } from "@/lib/indexer/phase-one";
import { AllocationDirectoryChangedError } from "@/lib/indexer/phase-one";
import { loadSwapPools, usePhaseOnePools, discoveryRoot } from "@/hooks/usePhaseOnePools";
const mocks = vi.hoisted(() => ({ page: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/indexer/phase-one", async (original) => ({
  ...(await original<typeof import("@/lib/indexer/phase-one")>()),
  loadAllocationDirectory: mocks.page,
}));
vi.mock("wagmi/actions", () => ({ getPublicClient: mocks.rpc }));
const address = (n: string) => getAddress(`0x${n.repeat(40)}`);
const hook = address("4");
const key = {
  currency0: address("1"),
  currency1: address("2"),
  fee: 3000,
  tickSpacing: 60,
  hooks: hook,
};
const row = {
  poolId: v4PoolId(key),
  poolKey: key,
  token0: { address: key.currency0, symbol: "AAA", name: "AAA", decimals: 18 },
  token1: { address: key.currency1, symbol: "BBB", name: "BBB", decimals: 18 },
  quarantined: false,
  decommissioned: false,
  decommissionStarted: false,
  decommissionFinalized: false,
} as IndexedAllocationPool;
const deployment = {
  descriptor: { deploymentId: "test", chainId: 4663 },
  contracts: { publicHook: hook },
  supportedPools: [],
} as unknown as PhaseOneDeployment;
const page = (items: IndexedAllocationPool[], nextCursor: string | null = null, revision = 1n) =>
  ({ items, nextCursor, directoryRevision: revision }) as AllocationDirectoryPage;
function Probe() {
  const { pools, discovering } = usePhaseOnePools(deployment);
  return (
    <output>
      {discovering ? "loading" : pools.map((p) => `${p.poolId}:${p.swappable}`).join("|")}
    </output>
  );
}
beforeEach(() => vi.clearAllMocks());
describe("indexed swap pool discovery", () => {
  it("loads more than 100 pools sequentially without chain reads", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({
      ...row,
      poolId: `0x${BigInt(i + 1)
        .toString(16)
        .padStart(64, "0")}` as `0x${string}`,
    }));
    mocks.page
      .mockResolvedValueOnce(page(rows.slice(0, 100), "next"))
      .mockResolvedValueOnce(page(rows.slice(100)));
    expect(await loadSwapPools("test")).toHaveLength(101);
    expect(mocks.page.mock.calls[1][0].filters.cursor).toBe("next");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects mixed revisions and repeated cursors", async () => {
    mocks.page.mockResolvedValueOnce(page([row], "next")).mockResolvedValueOnce(page([], null, 2n));
    await expect(loadSwapPools("test")).rejects.toBeInstanceOf(AllocationDirectoryChangedError);
    mocks.page.mockResolvedValueOnce(page([row], "same")).mockResolvedValueOnce(page([], "same"));
    await expect(loadSwapPools("test")).rejects.toThrow("repeated a cursor");
  });
  it("honors cancellation before requesting another page", async () => {
    const controller = new AbortController();
    mocks.page.mockImplementationOnce(async () => {
      controller.abort();
      return page([row], "next");
    });
    await expect(loadSwapPools("test", mocks.page, controller.signal)).rejects.toThrow();
    expect(mocks.page).toHaveBeenCalledTimes(1);
  });
  it("updates quarantine flags immediately from refreshed indexer data", async () => {
    mocks.page.mockResolvedValue(page([row]));
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(`${row.poolId}:true`));
    client.setQueryData([discoveryRoot, "test", "indexed"], [{ ...row, quarantined: true }]);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(`${row.poolId}:false`)
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
