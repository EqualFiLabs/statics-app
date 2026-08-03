import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState, SurfaceEmptyState } from "@/components/common/EmptyState";
import { WalletContext, defaultWalletState, type WalletState } from "@/providers/wallet-context";

function renderWithWallet(ui: React.ReactNode, overrides: Partial<WalletState> = {}) {
  return render(
    <WalletContext.Provider value={{ ...defaultWalletState, ...overrides }}>
      {ui}
    </WalletContext.Provider>
  );
}

const empty = {
  title: "You do not have any positions yet",
  description: "A position is where your baskets, loans, and Dollar live together.",
  action: { label: "Create position", onClick: vi.fn() },
};

describe("empty state", () => {
  it("always offers a way forward", () => {
    const onClick = vi.fn();
    render(
      <EmptyState title="Nothing here" description="Yet." action={{ label: "Do it", onClick }} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Do it" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders a link action as a link, not a button", () => {
    render(
      <EmptyState
        title="No baskets yet"
        description="Be first."
        action={{ label: "Create", href: "/app/create" }}
      />
    );

    expect(screen.getByRole("link", { name: "Create" })).toHaveAttribute("href", "/app/create");
  });
});

describe("surface empty state", () => {
  it("asks a signed-out visitor to sign in rather than claiming they have nothing", () => {
    const login = vi.fn();
    renderWithWallet(<SurfaceEmptyState state="signed-out" subject="positions" empty={empty} />, {
      status: "signed-out",
      login,
    });

    expect(screen.getByText("Sign in to see your positions")).toBeInTheDocument();
    // The regression this guards: a signed-out visitor being told their
    // (possibly full) account is empty.
    expect(screen.queryByText(empty.title)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(login).toHaveBeenCalledOnce();
  });

  it("offers a wallet when the account has none", () => {
    const createWallet = vi.fn().mockResolvedValue(undefined);
    renderWithWallet(
      <SurfaceEmptyState state="wallet-missing" subject="positions" empty={empty} />,
      {
        status: "wallet-missing",
        createWallet,
      }
    );

    fireEvent.click(screen.getByRole("button", { name: "Create wallet" }));
    expect(createWallet).toHaveBeenCalledOnce();
  });

  it("offers the switch when the chain is wrong", () => {
    const switchNetwork = vi.fn().mockResolvedValue(undefined);
    renderWithWallet(
      <SurfaceEmptyState state="wrong-network" subject="positions" empty={empty} />,
      {
        status: "ready",
        isTargetChain: false,
        networkName: "Anvil",
        switchNetwork,
      }
    );

    expect(screen.getByText(/switch to Anvil/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch network" }));
    expect(switchNetwork).toHaveBeenCalledOnce();
  });

  it("distinguishes a failed read from an empty one, and can retry", () => {
    const onRetry = vi.fn();
    renderWithWallet(
      <SurfaceEmptyState state="error" subject="positions" empty={empty} onRetry={onRetry} />,
      { status: "ready" }
    );

    expect(screen.getByText("Could not load your positions")).toBeInTheDocument();
    expect(screen.queryByText(empty.title)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows the surface's own copy only when it is genuinely empty", () => {
    renderWithWallet(<SurfaceEmptyState state="empty" subject="positions" empty={empty} />, {
      status: "ready",
    });

    expect(screen.getByText(empty.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create position" })).toBeInTheDocument();
  });

  it("renders nothing once the surface has data", () => {
    const { container } = renderWithWallet(
      <SurfaceEmptyState state="ready" subject="positions" empty={empty} />,
      { status: "ready" }
    );

    expect(container).toBeEmptyDOMElement();
  });
});
