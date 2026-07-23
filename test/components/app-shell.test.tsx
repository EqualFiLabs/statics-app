import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell/AppShell";

describe("DApp foundation shell", () => {
  it("shows honest readiness without wallet or protocol controls", () => {
    render(
      <AppShell>
        <section>Overview body</section>
      </AppShell>
    );

    expect(
      screen.getByRole("heading", { name: "Protocol interface foundation." })
    ).toBeInTheDocument();
    expect(screen.getByText("Foundation ready")).toBeInTheDocument();
    expect(screen.getByText("Not integrated")).toBeInTheDocument();
    expect(screen.getAllByText("Not deployed")).toHaveLength(1);
    expect(screen.getByText("Dollar")).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("button", { name: /connect/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/0x[0-9a-f]{8}/i)).not.toBeInTheDocument();
  });
});
