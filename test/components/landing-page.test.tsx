import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LandingPage } from "@/components/landing/LandingPage";
import { SiteHeader } from "@/components/landing/SiteHeader";

describe("landing page", () => {
  it("preserves the approved message while reporting truthful pre-launch state", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", { name: /static assets.*own your position/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/system status:/i)).toHaveTextContent("Pre-launch");
    expect(screen.getByText(/Deployment: Not deployed/i)).toBeInTheDocument();
    expect(screen.getByText("Not deployed", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(5);
    expect(screen.queryByText("19,482,731")).not.toBeInTheDocument();
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
  });

  it("routes launch controls to the app and keeps future destinations visible but inert", () => {
    render(<LandingPage />);

    const launchLinks = screen.getAllByRole("link", { name: /launch dapp/i });
    expect(launchLinks).toHaveLength(2);
    for (const link of launchLinks) expect(link).toHaveAttribute("href", "/app");

    expect(screen.getAllByText("Docs").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Docs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "GitHub" })).not.toBeInTheDocument();
    expect(screen.getByText("GitHub")).toHaveAttribute("aria-disabled", "true");
  });

  it("opens and closes mobile navigation with accurate accessible state", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const toggle = screen.getByRole("button", { name: "Toggle navigation" });
    const nav = screen.getByRole("navigation", { name: "Main menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav).not.toHaveClass("open");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(nav).toHaveClass("open");

    await user.click(screen.getByRole("link", { name: "Baskets" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav).not.toHaveClass("open");
  });
});
