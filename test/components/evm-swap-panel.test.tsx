import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@/test/render";
import {
  decodeFunctionData,
  decodeAbiParameters,
  parseAbiParameters,
  encodeFunctionResult,
  getAddress,
  maxUint256,
  zeroAddress,
} from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  walletTokenChains: [] as number[],
  tokens: [] as { address: `0x${string}`; decimals: number; name: string; symbol: string }[],
  call: vi.fn(),
  readContract: vi.fn(),
  getBalance: vi.fn(),
  getBlock: vi.fn(),
  execute: vi.fn(),
  discovered: [] as import("@/lib/phase-one/pool-discovery").PhaseOnePool[],
}));
vi.mock("@/hooks/usePhaseOnePools", async () => {
  const { mergePhaseOnePools } = await vi.importActual<
    typeof import("@/lib/phase-one/pool-discovery")
  >("@/lib/phase-one/pool-discovery");
  return {
    usePhaseOnePools: (deployment: PhaseOneDeployment | null) => ({
      pools: deployment ? mergePhaseOnePools(deployment.supportedPools, mocks.discovered) : [],
      discovering: false,
    }),
  };
});
vi.mock("viem", async (original) => ({
  ...(await original<typeof import("viem")>()),
  createPublicClient: () => ({
    call: mocks.call,
    readContract: mocks.readContract,
    getBalance: mocks.getBalance,
    getBlock: mocks.getBlock,
  }),
}));
vi.mock("@/lib/protocol/transactions", () => ({ executeProtocolTransaction: mocks.execute }));
import {
  buildV4ExactInputSingleSwap,
  universalRouterAbi,
  v4QuoterAbi,
} from "@statics-protocol/sdk";

vi.mock("@/hooks/useWalletTokens", () => ({
  useWalletTokens: (chainId: number) => {
    mocks.walletTokenChains.push(chainId);
    return { tokens: mocks.tokens };
  },
}));

import { selectSwapRoute } from "@/lib/trade/swap-routing";
import { EvmSwapPanel } from "@/components/portal/EvmSwapPanel";
import type {
  DeploymentOption,
  LaunchDeployment,
  PhaseOneDeployment,
} from "@/lib/deployments/types";
import { DeploymentContext } from "@/providers/deployment-context";
import { WalletContext, defaultWalletState } from "@/providers/wallet-context";

const walletAddress = getAddress("0x2222222222222222222222222222222222222222");
const descriptor = {
  deploymentId: "launch-fixture",
  label: "Statics Operators",
  network: "Robinhood Chain",
  chainId: 4_663,
  stage: "launch",
  capabilities: ["overview", "canonical-statics-market", "genesis-vault"],
  available: true,
} as const;
const deployment = {
  kind: "launch",
  descriptor,
  deploymentStartBlock: 1n,
  protocolCommit: "fixture",
  source: "development-fixture",
  contracts: {
    statics: getAddress("0x1111111111111111111111111111111111111111"),
    weth: getAddress("0x7777777777777777777777777777777777777777"),
    genesis: zeroAddress,
    vault: zeroAddress,
    activationRegistry: zeroAddress,
    feeReceiver: zeroAddress,
    launchDistributor: zeroAddress,
    poolManager: zeroAddress,
    stateView: zeroAddress,
    quoter: zeroAddress,
    universalRouter: zeroAddress,
    permit2: zeroAddress,
  },
  runtimeCodeHashes: {},
  market: {
    poolId: `0x${"1".repeat(64)}`,
    poolKey: {
      currency0: getAddress("0x1111111111111111111111111111111111111111"),
      currency1: getAddress("0x7777777777777777777777777777777777777777"),
      fee: 10_000,
      tickSpacing: 8,
      hooks: zeroAddress,
    },
  },
} as const satisfies LaunchDeployment;
const option = {
  networkId: "robinhood",
  descriptor,
  launch: deployment,
  protocol: null,
} satisfies DeploymentOption;

function renderCanonicalTrade(chainId: number, connected = false) {
  const switchNetwork = vi.fn().mockResolvedValue(undefined);
  const selectFundingNetwork = vi.fn().mockResolvedValue(undefined);
  const client = new QueryClient();
  const element = (chainId: number) => (
    <DeploymentContext.Provider
      value={{ active: option, options: [option], selectNetwork: vi.fn() }}
    >
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          status: "ready",
          authenticated: true,
          address: walletAddress,
          chainId,
          targetChainId: descriptor.chainId,
          isTargetChain: chainId === descriptor.chainId,
          fundingChainId: 42_161,
          fundingNetworkName: "Arbitrum",
          fundingWalletOnSelectedChain: chainId === 42_161,
          switchNetwork,
          selectFundingNetwork,
          getEthereumProvider: async () =>
            connected ? { request: vi.fn(), on: vi.fn(), removeListener: vi.fn() } : null,
        }}
      >
        <QueryClientProvider client={client}>
          <EvmSwapPanel staticsNetwork />
        </QueryClientProvider>
      </WalletContext.Provider>
    </DeploymentContext.Provider>
  );
  const view = render(element(chainId));
  return {
    switchNetwork,
    selectFundingNetwork,
    changeChain: (next: number) => view.rerender(element(next)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.walletTokenChains.length = 0;
  mocks.tokens = [];
  mocks.getBalance.mockResolvedValue(100n * 10n ** 18n);
  mocks.getBlock.mockResolvedValue({ timestamp: BigInt(Math.floor(Date.now() / 1000)) });
  mocks.call.mockResolvedValue({
    data: encodeFunctionResult({
      abi: v4QuoterAbi,
      functionName: "quoteExactInputSingle",
      result: [10000n * 10n ** 18n, 100000n],
    }),
  });
  mocks.execute.mockResolvedValue(`0x${"a".repeat(64)}`);
});
afterEach(() => vi.restoreAllMocks());

describe("canonical Trade network", () => {
  it("ignores a remembered Arbitrum funding selection on Robinhood", async () => {
    renderCanonicalTrade(descriptor.chainId);

    expect(await screen.findByRole("button", { name: "Review swap" })).toBeDisabled();
    expect(screen.queryByText(/Arbitrum/)).not.toBeInTheDocument();
    expect(mocks.walletTokenChains).toContain(descriptor.chainId);
    expect(mocks.walletTokenChains).not.toContain(42_161);
  });

  it("switches an off-chain wallet to Robinhood instead of the remembered funding chain", async () => {
    const { switchNetwork, selectFundingNetwork } = renderCanonicalTrade(42_161);

    fireEvent.click(await screen.findByRole("button", { name: "Switch to Robinhood Chain" }));
    expect(switchNetwork).toHaveBeenCalledTimes(1);
    expect(selectFundingNetwork).not.toHaveBeenCalled();
  });
});

describe("integrated swap execution", () => {
  const usd = getAddress("0x8888888888888888888888888888888888888888");
  const apiQuote = (minimum = "199000000", output = "200000000") => ({
    quote: {
      input: { amount: "1000000000000000000", token: zeroAddress },
      output: { amount: output, token: usd },
      aggregatedOutputs: [{ amount: output, minAmount: minimum, token: usd }],
    },
  });
  const unsupported = async () => {
    mocks.tokens = [{ address: usd, decimals: 6, name: "Dollar", symbol: "USD" }];
    renderCanonicalTrade(descriptor.chainId, true);
    fireEvent.change(await screen.findByRole("combobox", { name: "You receive asset" }), {
      target: { value: usd },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "You pay amount" }), {
      target: { value: "1" },
    });
  };
  it("executes unsupported-pair API fixtures on the selected chain and preserves the reviewed floor", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
      Response.json(
        String(url) === "/api/uniswap/swap"
          ? {
              swap: {
                to: usd,
                from: walletAddress,
                chainId: 4663,
                data: "0x1234",
                value: "1000000000000000000",
              },
            }
          : apiQuote()
      )
    );
    await unsupported();
    await waitFor(() => expect(screen.getByRole("button", { name: "Review swap" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Review swap" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm swap" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    expect(mocks.call).not.toHaveBeenCalled();
    const requests = fetchSpy.mock.calls.map(([url, options]) => ({
      url,
      body: JSON.parse(options!.body as string),
    }));
    expect(
      requests.filter((r) => r.url === "/api/uniswap/quote").every((r) => r.body.chainId === 4663)
    ).toBe(true);
    expect(
      requests.find((r) => r.url === "/api/uniswap/swap")?.body.quote.aggregatedOutputs[0].minAmount
    ).toBe("199000000");
    expect(mocks.execute.mock.calls[0][0]).toMatchObject({
      chainId: 4663,
      to: usd,
      data: "0x1234",
    });
  });
  it("aborts obsolete API requests and discards responses even when the transport ignores cancellation", async () => {
    let finish!: (response: Response) => void;
    let signal: AbortSignal | undefined;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async (_url, options) => {
        signal = options!.signal as AbortSignal;
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      })
      .mockResolvedValue(Response.json(apiQuote("398000000", "400000000")));
    await unsupported();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole("textbox", { name: "You pay amount" }), {
      target: { value: "2" },
    });
    expect(signal?.aborted).toBe(true);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "You receive amount" })).toHaveValue("400")
    );
    await act(async () => finish(Response.json(apiQuote())));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "You receive amount" })).toHaveValue("400")
    );
  });
  it("does not fall back to API when a supported direct quote fails", async () => {
    mocks.call.mockRejectedValueOnce(new Error("Pool quote failed"));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderCanonicalTrade(descriptor.chainId, true);
    fireEvent.change(await screen.findByRole("textbox", { name: "You pay amount" }), {
      target: { value: "1" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Pool quote failed");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("debounces direct quotes without deployment, gauge or reward reads", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderCanonicalTrade(descriptor.chainId, true);
    const input = await screen.findByRole("textbox", { name: "You pay amount" });
    await waitFor(() => expect(input).toHaveValue(""));
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.change(input, { target: { value: "2" } });
    expect(mocks.call).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Review swap" })).toBeEnabled());
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(mocks.readContract).not.toHaveBeenCalled();
    expect(mocks.getBlock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("requires a new review after a quote falls below the accepted minimum", async () => {
    renderCanonicalTrade(descriptor.chainId, true);
    const input = await screen.findByRole("textbox", { name: "You pay amount" });
    await waitFor(() => expect(input).toHaveValue(""));
    fireEvent.change(input, { target: { value: "1" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Review swap" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Review swap" }));
    mocks.call.mockResolvedValue({
      data: encodeFunctionResult({
        abi: v4QuoterAbi,
        functionName: "quoteExactInputSingle",
        result: [8000n * 10n ** 18n, 100000n],
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm swap" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("reviewed minimum");
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Confirm swap" })).not.toBeInTheDocument();
  });

  it("renews a Permit2 allowance that expires before the pending fork block", async () => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    mocks.getBlock.mockImplementation((input) =>
      Promise.resolve({ timestamp: now + (input?.blockTag === "pending" ? 3600n : 0n) })
    );
    mocks.readContract.mockImplementation((input) =>
      Promise.resolve(
        input.functionName === "balanceOf"
          ? 100n * 10n ** 18n
          : input.address === deployment.contracts.permit2
            ? [10n ** 18n, Number(now + 100n), 0]
            : maxUint256
      )
    );
    renderCanonicalTrade(descriptor.chainId, true);
    fireEvent.change(await screen.findByRole("combobox", { name: "You pay asset" }), {
      target: { value: deployment.contracts.weth },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "You pay amount" }), {
      target: { value: "1" },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Review swap" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Review swap" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm swap" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(2));
    expect(mocks.execute.mock.calls.map(([request]) => request.kind)).toEqual([
      "approve-permit2",
      "swap",
    ]);
  });

  it("discards a pending quote when the wallet changes networks", async () => {
    let resolve!: (value: { data: `0x${string}` }) => void;
    mocks.call.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const view = renderCanonicalTrade(descriptor.chainId, true);
    const input = await screen.findByRole("textbox", { name: "You pay amount" });
    fireEvent.change(input, { target: { value: "1" } });
    await waitFor(() => expect(mocks.call).toHaveBeenCalledTimes(1));
    view.changeChain(42161);
    resolve({
      data: encodeFunctionResult({
        abi: v4QuoterAbi,
        functionName: "quoteExactInputSingle",
        result: [10000n, 1n],
      }),
    });
    expect(
      await screen.findByRole("button", { name: "Switch to Robinhood Chain" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Minimum received")).not.toBeInTheDocument();
  });

  it("keeps the reviewed floor and wraps native input after refreshing", async () => {
    renderCanonicalTrade(descriptor.chainId, true);
    const input = await screen.findByRole("textbox", { name: "You pay amount" });
    await waitFor(() => expect(input).toHaveValue(""));
    fireEvent.change(input, { target: { value: "1" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Review swap" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Review swap" }));
    mocks.call.mockResolvedValue({
      data: encodeFunctionResult({
        abi: v4QuoterAbi,
        functionName: "quoteExactInputSingle",
        result: [11000n * 10n ** 18n, 100000n],
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm swap" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    const execution = mocks.execute.mock.calls[0]![0];
    const decoded = decodeFunctionData({ abi: universalRouterAbi, data: execution.data });
    const deadline = decoded.args![2]!;
    expect(deadline).toBeGreaterThanOrEqual(
      (await mocks.getBlock.mock.results[0]!.value).timestamp + 1200n
    );
    const expected = buildV4ExactInputSingleSwap({
      router: deployment.contracts.universalRouter,
      poolKey: deployment.market.poolKey,
      zeroForOne: false,
      amountIn: 10n ** 18n,
      amountOutMinimum: 9950n * 10n ** 18n,
      deadline,
      settlement: { input: "native", output: "erc20", wrappedNative: deployment.contracts.weth },
    });
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expected.calldata,
        value: expected.value,
      })
    );
  });
});

describe("route precedence", () => {
  const native = {
    address: zeroAddress,
    decimals: 18,
    kind: "native" as const,
    name: "Ether",
    symbol: "ETH",
  };
  const statics = {
    ...native,
    address: deployment.contracts.statics,
    kind: "erc20" as const,
    symbol: "STATICS",
  };
  const other = { ...statics, address: getAddress("0x8888888888888888888888888888888888888888") };
  const pool = {
    poolId: `0x${"2".repeat(64)}` as const,
    poolKey: deployment.market.poolKey,
    enabled: true,
    token0: { ...statics, metadataSource: "reviewed-manifest" as const },
    token1: { ...other, metadataSource: "reviewed-manifest" as const },
    provenance: { deploymentId: "phase-one", protocolCommit: "fixture", registrationBlock: 1n },
  };
  const phaseOne = {
    descriptor: { ...descriptor, deploymentId: "phase-one" },
    contracts: deployment.contracts,
    supportedPools: [pool],
  } as unknown as PhaseOneDeployment;
  it("prefers Genesis when both deployments support the canonical pair", () => {
    expect(
      selectSwapRoute({ ...option, phaseOne }, descriptor.chainId, native, statics)
    ).toMatchObject({ kind: "direct", phaseOne: false });
  });
  it("selects the first enabled exact Phase 1 pair and uses API only for unsupported pairs", () => {
    const publicPool = { ...pool, poolKey: { ...pool.poolKey, currency0: other.address } };
    const active = {
      ...option,
      phaseOne: { ...phaseOne, supportedPools: [{ ...publicPool, enabled: false }, publicPool] },
    };
    expect(selectSwapRoute(active, descriptor.chainId, native, other)).toMatchObject({
      kind: "direct",
      phaseOne: true,
      settlement: { input: "native" },
    });
    expect(selectSwapRoute(active, descriptor.chainId, statics, other)).toMatchObject({
      kind: "uniswap",
    });
    expect(selectSwapRoute(active, 8453, native, statics)).toMatchObject({
      kind: "uniswap",
      chainId: 8453,
    });
  });
  it("routes through verified discovered pools and skips ones closed to trading", () => {
    const third = getAddress("0x9999999999999999999999999999999999999999");
    const discovered = {
      poolId: `0x${"3".repeat(64)}` as const,
      poolKey: { ...pool.poolKey, currency0: other.address, currency1: third },
      swappable: true,
    };
    const active = { ...option, phaseOne };
    const out = { ...other, address: third, symbol: "NEW" };
    expect(
      selectSwapRoute(active, descriptor.chainId, other, out, true, [discovered])
    ).toMatchObject({ kind: "direct", phaseOne: true, id: `phase-one:${discovered.poolId}` });
    expect(
      selectSwapRoute(active, descriptor.chainId, other, out, true, [
        { ...discovered, swappable: false },
      ])
    ).toMatchObject({ kind: "uniswap" });
    // With no single pool for the pair, the route goes through two pools.
    const viaOther = selectSwapRoute(active, descriptor.chainId, statics, out, true, [
      { ...discovered, poolKey: { ...discovered.poolKey } },
      {
        poolId: `0x${"4".repeat(64)}`,
        poolKey: { ...pool.poolKey, currency0: statics.address, currency1: other.address },
        swappable: true,
      },
    ]);
    expect(viaOther).toMatchObject({ kind: "direct", phaseOne: true });
    expect(
      viaOther.kind === "direct" && viaOther.paths?.[0]?.map((hop) => hop.intermediateCurrency)
    ).toEqual([other.address, third]);
    // The canonical STATICS pair keeps its launch pool even when a Phase 1 pool exists.
    expect(
      selectSwapRoute({ ...option, phaseOne }, descriptor.chainId, native, statics, true, [
        { poolId: pool.poolId, poolKey: pool.poolKey, swappable: true },
      ])
    ).toMatchObject({ kind: "direct", phaseOne: false });
  });
});

describe("discovered pools in the swap card", () => {
  afterEach(() => {
    mocks.discovered = [];
  });
  it("opens on a linked pair, labels an unreviewed token and asks for its address to be checked", async () => {
    const fresh = getAddress("0x9999999999999999999999999999999999999999");
    const weth = deployment.contracts.weth;
    mocks.discovered = [
      {
        poolId: `0x${"3".repeat(64)}`,
        poolKey: {
          currency0: weth,
          currency1: fresh,
          fee: 3000,
          tickSpacing: 60,
          hooks: zeroAddress,
        },
        token0: {
          address: weth,
          symbol: "WETH",
          name: "Wrapped Ether",
          decimals: 18,
          metadataSource: "onchain-import",
        },
        token1: {
          address: fresh,
          symbol: "USDG",
          name: "Lookalike",
          decimals: 18,
          metadataSource: "onchain-import",
        },
        reviewed: false,
        swappable: true,
      },
    ];
    const phaseOne = {
      descriptor: { ...descriptor, deploymentId: "phase-one" },
      contracts: { ...deployment.contracts, publicHook: zeroAddress },
      supportedPools: [],
    } as unknown as PhaseOneDeployment;
    const active = { ...option, phaseOne };
    render(
      <DeploymentContext.Provider value={{ active, options: [active], selectNetwork: vi.fn() }}>
        <WalletContext.Provider
          value={{
            ...defaultWalletState,
            status: "ready",
            authenticated: true,
            address: walletAddress,
            chainId: descriptor.chainId,
            targetChainId: descriptor.chainId,
            isTargetChain: true,
            getEthereumProvider: async () => ({
              request: vi.fn(),
              on: vi.fn(),
              removeListener: vi.fn(),
            }),
          }}
        >
          <QueryClientProvider client={new QueryClient()}>
            <EvmSwapPanel staticsNetwork initialIn={weth} initialOut={fresh} />
          </QueryClientProvider>
        </WalletContext.Provider>
      </DeploymentContext.Provider>
    );
    const receive = await screen.findByRole("combobox", { name: "You receive asset" });
    await waitFor(() => expect(receive).toHaveValue(fresh));
    expect(screen.getByRole("combobox", { name: "You pay asset" })).toHaveValue(weth);
    expect(
      screen.getByRole("option", {
        name: `USDG · unreviewed · ${fresh.slice(0, 6)}…${fresh.slice(-4)}`,
      })
    ).toBeInTheDocument();
    const warning = screen.getByRole("note");
    expect(warning).toHaveTextContent(fresh);
    fireEvent.change(screen.getByRole("textbox", { name: "You pay amount" }), {
      target: { value: "1" },
    });
    const review = screen.getByRole("button", { name: "Review swap" });
    await waitFor(() => expect(mocks.call).toHaveBeenCalled());
    expect(review).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I have checked the address and want to trade this token.",
      })
    );
    await waitFor(() => expect(review).toBeEnabled());
  });
});

import { v4PathQuoterAbi } from "@/lib/trade/v4-path";
describe("review regressions", () => {
  const usd = getAddress("0x8888888888888888888888888888888888888888");
  const middle = getAddress("0x5555555555555555555555555555555555555555");
  const middle2 = getAddress("0x6666666666666666666666666666666666666666");
  let client = new QueryClient();
  beforeEach(() => {
    client = new QueryClient();
  });
  const ui = (active: DeploymentOption, out: string) => (
    <DeploymentContext.Provider value={{ active, options: [active], selectNetwork: vi.fn() }}>
      <WalletContext.Provider
        value={{
          ...defaultWalletState,
          status: "ready",
          authenticated: true,
          address: walletAddress,
          chainId: descriptor.chainId,
          targetChainId: descriptor.chainId,
          isTargetChain: true,
          getEthereumProvider: async () => ({
            request: vi.fn(),
            on: vi.fn(),
            removeListener: vi.fn(),
          }),
        }}
      >
        <QueryClientProvider client={client}>
          <EvmSwapPanel staticsNetwork initialIn="ETH" initialOut={out} />
        </QueryClientProvider>
      </WalletContext.Provider>
    </DeploymentContext.Provider>
  );
  it("applies URL pair changes to an already mounted card", async () => {
    mocks.tokens = [{ address: usd, decimals: 18, name: "Dollar", symbol: "USD" }];
    const view = render(ui(option, deployment.contracts.statics));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "You receive asset" })).toHaveValue(
        deployment.contracts.statics
      )
    );
    view.rerender(ui(option, usd));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "You receive asset" })).toHaveValue(usd)
    );
  });
  it("warns in review when the route passes through an unreviewed pool", async () => {
    const reviewedToken = (address: `0x${string}`, symbol: string) => ({
      address,
      symbol,
      name: symbol,
      decimals: 18,
      metadataSource: "reviewed-manifest" as const,
    });
    const weth = deployment.contracts.weth;
    // USD is reviewed through its own pool; the only route to it uses discovered pools.
    const phaseOne = {
      descriptor: { ...descriptor, deploymentId: "phase-one" },
      contracts: { ...deployment.contracts, publicHook: zeroAddress },
      supportedPools: [
        {
          poolId: `0x${"7".repeat(64)}`,
          poolKey: {
            currency0: middle2,
            currency1: usd,
            fee: 3000,
            tickSpacing: 60,
            hooks: zeroAddress,
          },
          enabled: true,
          token0: reviewedToken(middle2, "OTHER"),
          token1: reviewedToken(usd, "USD"),
        },
      ],
    } as unknown as PhaseOneDeployment;
    const unreviewed = (address: `0x${string}`, symbol: string) => ({
      address,
      symbol,
      name: symbol,
      decimals: 18,
      metadataSource: "onchain-import" as const,
    });
    mocks.discovered = [
      [weth, middle],
      [middle, usd],
    ].map(([x, y], i) => ({
      poolId: `0x${String(i + 8).repeat(64)}` as `0x${string}`,
      poolKey: { currency0: x!, currency1: y!, fee: 3000, tickSpacing: 60, hooks: zeroAddress },
      token0: x === weth ? reviewedToken(weth, "WETH") : unreviewed(x!, "MID"),
      token1: y === usd ? reviewedToken(usd, "USD") : unreviewed(y!, "MID"),
      reviewed: false,
      swappable: true,
    }));
    mocks.call.mockResolvedValue({
      data: encodeFunctionResult({
        abi: v4PathQuoterAbi,
        functionName: "quoteExactInput",
        result: [100n * 10n ** 18n, 1n],
      }),
    });
    render(ui({ ...option, phaseOne }, usd));
    const amount = screen.getByRole("textbox", { name: "You pay amount" });
    await waitFor(() => expect(amount).toHaveValue(""));
    fireEvent.change(amount, { target: { value: "1" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Review swap" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Review swap" }));
    expect(
      screen.getByText(`Route: ETH → MID (${middle.slice(0, 6)}…${middle.slice(-4)}) → USD`)
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("has not been reviewed");
    mocks.discovered = [];
  });
  it("does not quote a different pair when a linked token is unavailable", async () => {
    render(ui(option, usd));
    fireEvent.change(screen.getByRole("textbox", { name: "You pay amount" }), {
      target: { value: "1" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("token pair is unavailable");
    expect(screen.getByRole("button", { name: "Review swap" })).toBeDisabled();
    expect(mocks.call).not.toHaveBeenCalled();
  });
  it.each([80n, 110n])(
    "keeps the reviewed path when its refreshed output is %s",
    async (refreshedOutput) => {
      const token = (address: `0x${string}`, symbol: string) => ({
        address,
        symbol,
        name: symbol,
        decimals: 18,
        metadataSource: "reviewed-manifest" as const,
      });
      const supportedPools = [
        [deployment.contracts.weth, middle],
        [middle, usd],
        [deployment.contracts.weth, middle2],
        [middle2, usd],
      ].map(([x, y], i) => ({
        poolId: `0x${String(i + 3).repeat(64)}` as `0x${string}`,
        poolKey: { currency0: x!, currency1: y!, fee: 3000, tickSpacing: 60, hooks: zeroAddress },
        enabled: true,
        token0: token(x!, `T${i}a`),
        token1: token(y!, `T${i}b`),
      }));
      const phaseOne = {
        descriptor: { ...descriptor, deploymentId: "phase-one" },
        contracts: { ...deployment.contracts, publicHook: zeroAddress },
        supportedPools,
      } as unknown as PhaseOneDeployment;
      let refreshed = false,
        calls = 0;
      mocks.call.mockImplementation(async () => ({
        data: encodeFunctionResult({
          abi: v4PathQuoterAbi,
          functionName: "quoteExactInput",
          result: [
            (refreshed
              ? calls++ % 2 === 0
                ? refreshedOutput
                : 120n
              : calls++ % 2 === 0
                ? 100n
                : 90n) *
              10n ** 18n,
            1n,
          ],
        }),
      }));
      render(ui({ ...option, phaseOne }, usd));
      const amount = screen.getByRole("textbox", { name: "You pay amount" });
      await waitFor(() => expect(amount).toHaveValue(""));
      fireEvent.change(amount, { target: { value: "1" } });
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Review swap" })).toBeEnabled()
      );
      fireEvent.click(screen.getByRole("button", { name: "Review swap" }));
      // Review names the exact pools the swap will use.
      expect(screen.getByText(/^Route: ETH → T0b → /)).toBeInTheDocument();
      expect(screen.getByText("2 Statics pools on this route")).toBeInTheDocument();
      expect(screen.queryByText(/has not been reviewed/)).not.toBeInTheDocument();
      refreshed = true;
      calls = 0;
      fireEvent.click(screen.getByRole("button", { name: "Confirm swap" }));
      if (refreshedOutput < 100n) {
        expect(await screen.findByRole("alert")).toHaveTextContent("reviewed minimum");
        expect(mocks.execute).not.toHaveBeenCalled();
      } else {
        await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
        const { args } = decodeFunctionData({
          abi: universalRouterAbi,
          data: mocks.execute.mock.calls[0][0].data,
        });
        const [, params] = decodeAbiParameters(
          parseAbiParameters("bytes actions,bytes[] params"),
          args![1]![1]!
        );
        const [swap] = decodeAbiParameters(
          parseAbiParameters(
            "(address currencyIn,(address intermediateCurrency,uint24 fee,int24 tickSpacing,address hooks,bytes hookData)[] path,uint256[] maxHopSlippage,uint128 amountIn,uint128 amountOutMinimum)"
          ),
          params[0]!
        );
        expect(swap.path[0].intermediateCurrency).toBe(middle);
        expect(swap.amountOutMinimum).toBe(995n * 10n ** 17n);
      }
    }
  );
});
