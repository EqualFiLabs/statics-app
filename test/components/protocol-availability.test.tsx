import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";

vi.mock("wagmi", () => ({
  usePublicClient: () => undefined,
  useWalletClient: () => ({ data: undefined }),
}));

import { BasketListPage } from "@/components/baskets/BasketListPage";
import { DollarPage } from "@/components/dollar/DollarPage";
import { LoansPage } from "@/components/loans/LoansPage";
import { PositionListPage } from "@/components/positions/PositionListPage";
import { RewardsPage } from "@/components/rewards/RewardsPage";
import { deploymentRegistry } from "@/lib/deployments/registry";
import { DeploymentContext } from "@/providers/deployment-context";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

const target = deploymentRegistry({ NEXT_PUBLIC_APP_ENV: "production" })[0]!;
const wallet = {
  ...defaultWalletState,
  status: "ready" as const,
  authenticated: true,
  address: "0x0000000000000000000000000000000000000001",
  walletKind: "embedded" as const,
  chainId: 4_663,
  targetChainId: 4_663,
  isTargetChain: true,
};

function renderUnavailable(page: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DeploymentContext.Provider
        value={{ active: target, options: [target], selectNetwork: vi.fn() }}
      >
        <WalletContext.Provider value={wallet}>{page}</WalletContext.Provider>
      </DeploymentContext.Provider>
    </QueryClientProvider>
  );
}

describe("protocol availability", () => {
  it("keeps catalog navigation visible without a protocol deployment", () => {
    renderUnavailable(<BasketListPage />);

    expect(screen.getByRole("heading", { name: "Statics baskets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create basket" })).toHaveAttribute(
      "href",
      "/app/create"
    );
    expect(screen.queryByText(/not live yet|deployment is configured/i)).not.toBeInTheDocument();
  });

  it("renders Position NFT actions but disables the onchain mutation", () => {
    renderUnavailable(<PositionListPage />);

    expect(screen.getByRole("heading", { name: "Your Position NFTs" })).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "Create position" })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getByTitle(/enabled when Statics Protocol is live/i)).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("keeps rewards, loans, and Dollar controls rendered and disabled", () => {
    const rewards = renderUnavailable(<RewardsPage />);
    expect(screen.getByRole("button", { name: "Create staking position" })).toBeDisabled();
    rewards.unmount();

    const loans = renderUnavailable(<LoansPage />);
    expect(screen.getByRole("heading", { name: "Your loans" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /borrow/i })).toBeDisabled();
    loans.unmount();

    renderUnavailable(<DollarPage />);
    for (const button of screen.getAllByRole("button", { name: "Mint Dollar and Risk" })) {
      expect(button).toBeDisabled();
    }
  });
});
