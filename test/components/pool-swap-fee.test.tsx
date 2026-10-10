import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { PoolSwapFee } from "@/components/common/PoolSwapFee";

describe("pool swap fee presentation", () => {
  it("does not show an incomplete total while hook rates are loading or unavailable", () => {
    render(<PoolSwapFee lpFee={3000} source="phase-one" hook={null} />);
    expect(screen.getByText("Fee unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/0.30% fee/)).not.toBeInTheDocument();
  });
  it("labels the sum as approximate and exposes each rate", () => {
    render(<PoolSwapFee lpFee={3000} source="phase-one" hook={{ inputBps: 5, outputBps: 10 }} />);
    expect(screen.getByText("≈ 0.45% fee", { exact: false })).toHaveAttribute(
      "title",
      "0.30% LP fee; 0.05% input fee; 0.10% output fee. Combined rate is approximate."
    );
  });
  it("shows the native LP rate for Genesis independently of hook discovery", () => {
    render(<PoolSwapFee lpFee={15000} source="genesis" hook={null} />);
    expect(screen.getByText("1.50% fee")).toBeInTheDocument();
  });
  it("does not round a positive low fee tier to zero", () => {
    render(<PoolSwapFee lpFee={1} source="genesis" hook={null} />);
    expect(screen.getByText("0.0001% fee")).toBeInTheDocument();
  });
});
