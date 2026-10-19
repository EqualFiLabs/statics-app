import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { generatePrivateKey } from "viem/accounts";
import { getAddress, zeroHash } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenesisPage } from "@/components/genesis/GenesisPage";
import { launchDeploymentManifests } from "@/deployments/launch-manifests";
import { parseLaunchDeploymentManifest } from "@/lib/deployments/launch-manifest";
import type { DeploymentOption } from "@/lib/deployments/types";
import type { DollarDeployment } from "@/lib/dollar/deployment";
import { ROBINHOOD_CALIBUR } from "@/lib/genesis/calibur";
import {
  EMPTY_GENESIS_PORTFOLIO,
  ownedGenesisQueryKey,
  type OwnedGenesis,
} from "@/lib/genesis/owned";
import { DeploymentContext } from "@/providers/deployment-context";
import { WalletContext, defaultWalletState, type WalletState } from "@/providers/wallet-context";
import { act, fireEvent, render, screen, waitFor, within } from "@/test/render";

const mocks = vi.hoisted(() => ({ getCode: vi.fn(), signAuthorization: vi.fn() }));
const publicClient = { getCode: mocks.getCode };
vi.mock("wagmi", () => ({ usePublicClient: () => publicClient }));
vi.mock("@privy-io/react-auth", () => ({
  useSign7702Authorization: () => ({ signAuthorization: mocks.signAuthorization }),
}));

const wallet = getAddress("0x1111111111111111111111111111111111111111");
const launch = parseLaunchDeploymentManifest(launchDeploymentManifests["robinhood-genesis"]);
const protocol: DollarDeployment = {
  chainId: 4663,
  deploymentStartBlock: 1n,
  wethProfileId: 1n,
  protocolCommit: "calibur-controls-test",
  source: "checked-in-manifest",
  contracts: {
    diamond: wallet,
    core: wallet,
    gateway: wallet,
    dollar: wallet,
    risk: wallet,
    weth: wallet,
    oracle: wallet,
  },
  runtimeCodeHashes: {
    diamond: zeroHash,
    core: zeroHash,
    gateway: zeroHash,
    dollar: zeroHash,
    risk: zeroHash,
    weth: zeroHash,
    oracle: zeroHash,
  },
  genesis: {
    token: wallet,
    collection: wallet,
    renderer: wallet,
    avatarSvg: wallet,
    tokenCodeHash: zeroHash,
    collectionCodeHash: zeroHash,
    rendererCodeHash: zeroHash,
    avatarSvgCodeHash: zeroHash,
  },
};
const launchOption: DeploymentOption = {
  networkId: "robinhood",
  descriptor: launch.descriptor,
  launch,
  protocol: null,
};
const localForkLaunch = parseLaunchDeploymentManifest(
  {
    ...launchDeploymentManifests["robinhood-genesis"],
    deploymentId: "local-anvil-genesis",
    network: "Robinhood mainnet fork",
  },
  "development-fixture"
);
const localForkOption: DeploymentOption = {
  ...launchOption,
  descriptor: localForkLaunch.descriptor,
  launch: localForkLaunch,
};
const protocolOption: DeploymentOption = {
  ...launchOption,
  launch: null,
  protocol: { kind: "protocol", descriptor: launch.descriptor, protocol },
};
const connectedWallet: WalletState = {
  ...defaultWalletState,
  status: "ready",
  authenticated: true,
  address: wallet,
  walletKind: "embedded",
  chainId: 4663,
  targetChainId: 4663,
  isTargetChain: true,
};

function seedOperators(client: QueryClient, count: number, option = launchOption) {
  const deploymentId = option.launch?.descriptor.deploymentId ?? launch.descriptor.deploymentId;
  const items: OwnedGenesis[] = Array.from({ length: count }, (_, index) => ({
    id: BigInt(index + 1),
    tier: 0,
    multiplierBps: 10_000,
    registered: true,
    rewardWeight: 10_000n,
    pendingStatics: 0n,
    pendingWeth: 0n,
    creditActive: false,
    creditPrincipal: 0n,
    creditMaturity: 0,
  }));
  client.setQueryData(ownedGenesisQueryKey(deploymentId, wallet), {
    ...EMPTY_GENESIS_PORTFOLIO,
    items,
    tierCosts: [0n, 0n, 0n, 0n, 0n],
  });
  client.setQueryData(["genesis-vault-epoch", deploymentId], {
    epochActive: false,
    maximumSupply: 5555n,
    circulatingGenesis: BigInt(count),
    vaultPrice: 0n,
  });
  client.setQueryData(["genesis-portfolio", wallet, protocol.protocolCommit], {
    genesis: items.map((item) => ({
      id: item.id,
      state: { tier: item.tier, multiplierBps: item.multiplierBps, linkedPositionId: 0n },
    })),
    positions: [],
    balance: 0n,
    allowance: 0n,
    costs: [0n, 0n, 0n, 0n],
  });
}

function renderPage(option: DeploymentOption, count: number, walletState = connectedWallet) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  seedOperators(client, count, option);
  render(
    <QueryClientProvider client={client}>
      <DeploymentContext.Provider
        value={{ active: option, options: [option], selectNetwork: vi.fn() }}
      >
        <WalletContext.Provider value={walletState}>
          <GenesisPage />
        </WalletContext.Provider>
      </DeploymentContext.Provider>
    </QueryClientProvider>
  );
  return client;
}

async function expectWalletControls() {
  if (!screen.queryByRole("dialog", { name: "Calibur settings" })) {
    fireEvent.click(screen.getByRole("button", { name: "Calibur settings" }));
  }
  expect(
    await screen.findByRole("button", { name: "Review Calibur delegation removal" })
  ).toBeEnabled();
  expect(await screen.findByRole("button", { name: "Recover unused relay ETH" })).toBeEnabled();
  expect(screen.getAllByRole("dialog", { name: "Calibur settings" })).toHaveLength(1);
  expect(mocks.signAuthorization).not.toHaveBeenCalled();
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.sessionStorage.setItem(
    `statics:calibur-browser-relay:4663:${wallet.toLowerCase()}`,
    JSON.stringify({ privateKey: generatePrivateKey() })
  );
  mocks.getCode.mockReset().mockResolvedValue(`0xef0100${ROBINHOOD_CALIBUR.slice(2)}`);
  mocks.signAuthorization.mockReset();
});

describe.each([
  ["launch", launchOption],
  ["local mainnet fork", localForkOption],
  ["full protocol", protocolOption],
] as const)("%s Calibur wallet controls", (_name, option) => {
  it.each([0, 1, 2])(
    "keeps removal and refund recovery available with %i Operators",
    async (count) => {
      renderPage(option, count);
      await expectWalletControls();
    }
  );

  it("keeps wallet and bulk controls behind separate dialogs and preserves selection", async () => {
    renderPage(option, 2);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Review Calibur delegation removal" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    const settings = screen.getByRole("button", { name: "Calibur settings" });
    settings.focus();
    fireEvent.click(settings);
    await expectWalletControls();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(settings).toHaveFocus();
    expect(settings).toHaveAttribute("aria-expanded", "false");

    const manage = screen.getByRole("button", { name: "Manage Operators together" });
    manage.focus();
    fireEvent.click(manage);
    const dialog = screen.getByRole("dialog", { name: "Manage Operators together" });
    const selection = within(dialog).getAllByRole("checkbox")[0];
    fireEvent.click(selection);
    expect(selection).toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(manage).toHaveFocus();
    fireEvent.click(manage);
    expect(screen.getAllByRole("checkbox")[0]).toBeChecked();
    expect(mocks.signAuthorization).not.toHaveBeenCalled();
  });

  it("preserves the controls when holdings fall from two to one to zero", async () => {
    const client = renderPage(option, 2);
    await expectWalletControls();
    for (const count of [1, 0]) {
      act(() => seedOperators(client, count, option));
      await expectWalletControls();
    }
    await waitFor(() => expect(screen.getByText(/No Operators/)).toBeInTheDocument());
  });

  it("keeps the controls hidden for external wallets", () => {
    renderPage(option, 2, { ...connectedWallet, walletKind: "external" });
    expect(screen.queryByRole("button", { name: "Calibur settings" })).toBeNull();
  });

  it("offers activation for an undelegated embedded wallet with no Operators", async () => {
    mocks.getCode.mockResolvedValue("0x");
    renderPage(option, 0);
    fireEvent.click(screen.getByRole("button", { name: "Calibur settings" }));
    expect(await screen.findByRole("button", { name: "Review Calibur activation" })).toBeEnabled();
    expect(mocks.signAuthorization).not.toHaveBeenCalled();
  });

  it("keeps the controls hidden on other chains", () => {
    const otherChain: DeploymentOption = option.launch
      ? {
          ...option,
          launch: {
            ...option.launch,
            descriptor: { ...option.launch.descriptor, chainId: 31337 },
          },
        }
      : {
          ...option,
          protocol: {
            ...option.protocol!,
            protocol: { ...protocol, chainId: 31337 },
          },
        };
    renderPage(otherChain, 2);
    expect(screen.queryByRole("button", { name: "Calibur settings" })).toBeNull();
  });
});

it("keeps full-protocol development deployments without verified Calibur support hidden", () => {
  renderPage(
    {
      ...protocolOption,
      protocol: {
        ...protocolOption.protocol!,
        protocol: { ...protocol, source: "development-environment" },
      },
    },
    2
  );
  expect(screen.queryByRole("button", { name: "Calibur settings" })).toBeNull();
});
