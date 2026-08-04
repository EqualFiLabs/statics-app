import { fireEvent, render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";

import { EmptyState, SurfaceBoundary, SurfaceEmptyState } from "@/components/common/EmptyState";
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
  it("explains an unconfigured deployment instead of rendering a parallel sample screen", () => {
    renderWithWallet(
      <SurfaceBoundary state="unconfigured" subject="positions" empty={empty}>
        <p>Live positions</p>
      </SurfaceBoundary>
    );

    expect(screen.getByText("Statics is not configured")).toBeInTheDocument();
    expect(screen.queryByText("Live positions")).not.toBeInTheDocument();
  });

  it("asks a disconnected visitor to connect rather than claiming they have nothing", () => {
    const connectWallet = vi.fn();
    renderWithWallet(<SurfaceEmptyState state="disconnected" subject="positions" empty={empty} />, {
      status: "disconnected",
      connectWallet,
    });

    expect(screen.getByText("Connect a wallet to see your positions")).toBeInTheDocument();
    // The regression this guards: a disconnected visitor being told their
    // (possibly full) account is empty.
    expect(screen.queryByText(empty.title)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(connectWallet).toHaveBeenCalledOnce();
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
