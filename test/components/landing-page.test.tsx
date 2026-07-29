import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LandingPage } from "@/components/landing/LandingPage";
import { SiteHeader } from "@/components/landing/SiteHeader";

describe("landing page", () => {
  it("preserves the approved message while reporting the public testnet beta", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", { name: /static assets.*dynamic markets/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/system status:/i)).toHaveTextContent("Public testnet beta");
    expect(screen.getByText(/Network: Robinhood Testnet/i)).toBeInTheDocument();
    expect(screen.getByText(/Deployment: Testnet live/i)).toBeInTheDocument();
    expect(screen.getByText("Testnet live", { selector: "dd" })).toBeInTheDocument();
    expect(screen.queryByText("19,482,731")).not.toBeInTheDocument();
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
  });

  // The panel states protocol properties, which are true before any deployment
  // exists. Metrics would have to read "--" five times over, which says nothing
  // and reads as a dead page.
  it("states fixed protocol properties rather than empty metrics", () => {
    render(<LandingPage />);

    expect(screen.getByRole("heading", { name: /what's fixed/i })).toBeInTheDocument();
    expect(screen.getByText("In kind")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.queryByText(/total value locked/i)).not.toBeInTheDocument();
  });

  // Both were on the page and neither was true: an owner still holds
  // setFeeConfiguration and quarantineBasket, and governance is unbuilt. These
  // are checkable in a block explorer, so they cannot go back without the claim
  // becoming true first.
  it("makes no trustlessness claim the deployed contracts do not support", () => {
    render(<LandingPage />);

    const page = document.body.textContent ?? "";
    expect(page).not.toMatch(/no centralized admins/i);
    expect(page).not.toMatch(/timelocked/i);
  });

  it("routes launch controls to the app and keeps future destinations visible but inert", () => {
    render(<LandingPage />);

    const launchLinks = screen.getAllByRole("link", { name: /launch app/i });
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
