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
import { act, render, screen, waitFor } from "@/test/render";

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

function seedOperators(client: QueryClient, count: number) {
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
  client.setQueryData(ownedGenesisQueryKey(launch.descriptor.deploymentId, wallet), {
    ...EMPTY_GENESIS_PORTFOLIO,
    items,
    tierCosts: [0n, 0n, 0n, 0n, 0n],
  });
  client.setQueryData(["genesis-vault-epoch", launch.descriptor.deploymentId], {
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
  seedOperators(client, count);
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
  expect(
    await screen.findByRole("button", { name: "Review Calibur delegation removal" })
  ).toBeEnabled();
  expect(await screen.findByRole("button", { name: "Recover unused relay ETH" })).toBeEnabled();
  expect(
    screen.getAllByRole("region", { name: "Activate atomic batches for this Privy wallet" })
  ).toHaveLength(1);
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
  ["full protocol", protocolOption],
] as const)("%s Calibur wallet controls", (_name, option) => {
  it.each([0, 1, 2])(
    "keeps removal and refund recovery available with %i Operators",
    async (count) => {
      renderPage(option, count);
      await expectWalletControls();
    }
  );

  it("preserves the controls when holdings fall from two to one to zero", async () => {
    const client = renderPage(option, 2);
    await expectWalletControls();
    for (const count of [1, 0]) {
      act(() => seedOperators(client, count));
      await expectWalletControls();
    }
    await waitFor(() => expect(screen.getByText(/No Operators/)).toBeInTheDocument());
  });

  it("keeps the controls hidden for external wallets", () => {
    renderPage(option, 2, { ...connectedWallet, walletKind: "external" });
    expect(
      screen.queryByRole("region", { name: "Activate atomic batches for this Privy wallet" })
    ).toBeNull();
  });

  it("keeps the controls hidden for development deployments", () => {
    const development: DeploymentOption = option.launch
      ? { ...option, launch: { ...option.launch, source: "development-fixture" } }
      : {
          ...option,
          protocol: {
            ...option.protocol!,
            protocol: { ...protocol, source: "development-environment" },
          },
        };
    renderPage(development, 2);
    expect(
      screen.queryByRole("region", { name: "Activate atomic batches for this Privy wallet" })
    ).toBeNull();
  });
});
