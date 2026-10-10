import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import { IndexedPoolSwapFee } from "@/components/common/IndexedPoolSwapFee";

const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/indexer/phase-one", () => ({ loadIndexedPublicPools: load }));

beforeEach(() => {
  load.mockReset();
});

describe("indexed pool fees", () => {
  it("shares one request across labels and matches pool IDs case-insensitively", async () => {
    load.mockResolvedValue({
      items: [
        { poolId: "0xAB", inputFeeBps: 5, outputFeeBps: 5 },
        { poolId: "0xcd", inputFeeBps: 10, outputFeeBps: 20 },
      ],
    });
    render(
      <>
        <IndexedPoolSwapFee deploymentId="first" poolId="0xab" lpFee={3000} />
        <IndexedPoolSwapFee deploymentId="first" poolId="0xCD" lpFee={3000} />
      </>
    );
    expect(await screen.findByText("≈ 0.40% fee", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("≈ 0.60% fee", { exact: false })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith("first");
  });
  it("does not reuse another deployment's rates", async () => {
    load.mockImplementation(async (id: string) => ({
      items: id === "first" ? [{ poolId: "0xab", inputFeeBps: 5, outputFeeBps: 5 }] : [],
    }));
    const view = render(<IndexedPoolSwapFee deploymentId="first" poolId="0xab" lpFee={3000} />);
    await screen.findByText("≈ 0.40% fee", { exact: false });
    view.rerender(<IndexedPoolSwapFee deploymentId="second" poolId="0xab" lpFee={3000} />);
    expect(screen.getByText("Fee unavailable")).toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenCalledWith("second"));
    expect(screen.queryByText("≈ 0.40% fee", { exact: false })).not.toBeInTheDocument();
  });
  it("keeps missing or failed rates unavailable rather than showing only the LP fee", async () => {
    load.mockRejectedValue(new Error("Indexer unavailable"));
    render(<IndexedPoolSwapFee deploymentId="first" poolId="0xab" lpFee={3000} />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Fee unavailable")).toBeInTheDocument();
    expect(screen.queryByText("0.30% fee")).not.toBeInTheDocument();
  });
});
