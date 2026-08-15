import { fireEvent, render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";

import { BorrowUtilizationSlider } from "@/components/loans/BorrowUtilizationSlider";

describe("borrow utilization slider", () => {
  it("shows evenly defined allocation marks and reports slider changes", () => {
    const onChange = vi.fn();
    render(<BorrowUtilizationSlider value={50} onChange={onChange} />);

    const slider = screen.getByRole("slider", {
      name: "Use of available borrowed principal",
    });
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "100");
    expect(slider).toHaveAttribute("step", "25");
    expect(slider).toHaveAttribute("aria-valuetext", "50%");
    expect(screen.getByText("Max")).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "75" } });
    expect(onChange).toHaveBeenCalledWith(75);
  });

  it("describes the maximum position without exposing 100 as the primary label", () => {
    render(<BorrowUtilizationSlider value={100} onChange={vi.fn()} />);

    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "Maximum");
    expect(screen.getByText("Maximum")).toBeInTheDocument();
  });
});
