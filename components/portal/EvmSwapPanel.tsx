"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  createPublicClient,
  custom,
  encodeFunctionData,
  formatUnits,
  getAddress,
  isAddress,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import {
  buildV4ExactInputSingleSwap,
  dopplerStaticsTokenAbi,
  permit2AllowanceAbi,
} from "@statics-protocol/sdk";

import {
  getDefaultEvmSwapTokens,
  normalizeUniswapTransaction,
  uniswapError,
  type EvmSwapToken,
} from "@/lib/portal/uniswap";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { usePhaseOnePools } from "@/hooks/usePhaseOnePools";
import { isReviewedToken } from "@/lib/phase-one/pool-discovery";
import { useDeployment } from "@/providers/deployment-context";
import { getFundingNetwork } from "@/lib/funding-networks";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import {
  SlippageInlineControl,
  SlippageSettingsDialog,
} from "@/components/portal/SlippageSettingsDialog";
import { usePortalSlippage } from "@/hooks/usePortalSlippage";
import { writePortalSlippage } from "@/lib/portal/slippage";
import { useWalletState, walletRecoveryAction } from "@/providers/wallet-context";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import { minimumWithSlippage } from "@/lib/baskets/baskets";
import { maximumTokenApproval, swapDeadlineBase } from "@/lib/trade/canonical-market";
import {
  MAX_PERMIT2_ALLOWANCE,
  MAX_PERMIT2_EXPIRATION,
  hasUsablePermit2Allowance,
} from "@/lib/protocol/approvals";
import { slippagePercentToBps } from "@/lib/portal/slippage";
import { isUniswapSwapChainId } from "@/lib/portal/uniswap";
import { quoteSwapRoute, selectSwapRoute } from "@/lib/trade/swap-routing";
import { buildV4ExactInputPathSwap, type PathHop } from "@/lib/trade/v4-path";

const PERMIT_TTL = 20n * 60n;

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

type QuotePayload = {
  routeId?: string;
  /** The Statics pools a multi-pool quote goes through, in order. */
  path?: readonly PathHop[];
  routing?: string;
  quote?: {
    input: { amount: string; token: string };
    output: { amount: string; token: string };
    aggregatedOutputs?: Array<{ amount: string; minAmount?: string; token: string }>;
    gasFeeUSD?: string;
    priceImpact?: number;
    quoteId?: string;
  };
  detail?: string;
  error?: string;
};

type SubmitState = "idle" | "approving" | "swapping";

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.slice(0, 500) };
  }
}

function displayAmount(raw: string | undefined, token: EvmSwapToken | undefined): string {
  if (!raw || !token) return "";
  const value = formatUnits(BigInt(raw), token.decimals);
  const [whole, fraction = ""] = value.split(".");
  return fraction
    ? `${whole}.${fraction.slice(0, 6).replace(/0+$/, "")}`.replace(/\.$/, "")
    : whole;
}

export function EvmSwapPanel({
  staticsNetwork = false,
  initialIn,
  initialOut,
}: {
  staticsNetwork?: boolean;
  /** Token addresses (or "ETH") to open with, e.g. from a pool's Swap link. */
  initialIn?: string;
  initialOut?: string;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("portal");
  const locale = useAppLocale();
  const wallet = useWalletState();
  const slippage = usePortalSlippage();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { active } = useDeployment();
  const selectedChainId = staticsNetwork ? active.descriptor.chainId : wallet.fundingChainId;
  const selectedNetworkName = staticsNetwork
    ? active.descriptor.network
    : wallet.fundingNetworkName;
  const walletOnSelectedChain = wallet.chainId === selectedChainId;
  const launch =
    active.launch && active.launch.descriptor.chainId === selectedChainId ? active.launch : null;
  const phaseOne =
    staticsNetwork && active.phaseOne?.descriptor.chainId === selectedChainId
      ? active.phaseOne
      : null;
  const walletTokens = useWalletTokens(selectedChainId, active.protocol ?? active.launch);
  // Reviewed manifest pools plus indexed public pools registered since.
  const discovery = usePhaseOnePools(phaseOne);
  const tokens = useMemo(() => {
    const native = getDefaultEvmSwapTokens(selectedChainId).filter(
      (token) => token.kind === "native"
    );
    const canonical: EvmSwapToken[] = launch
      ? [
          {
            address: launch.contracts.statics,
            decimals: 18,
            kind: "erc20",
            name: "Statics",
            symbol: "STATICS",
          },
          {
            address: launch.contracts.weth,
            decimals: 18,
            kind: "erc20",
            name: "Wrapped Ether",
            symbol: "WETH",
          },
        ]
      : [];
    const registered: EvmSwapToken[] = discovery.pools
      .filter((pool) => pool.swappable)
      .flatMap((pool) => [pool.token0, pool.token1])
      .map((token) => ({
        address: token.address,
        decimals: token.decimals,
        name: token.name,
        symbol: token.symbol,
        kind: "erc20" as const,
        reviewed: isReviewedToken(token),
      }))
      // Reviewed tokens list first; a token reviewed anywhere counts as reviewed.
      .sort((a, b) => Number(b.reviewed) - Number(a.reviewed));
    const discovered = walletTokens.tokens.map((token): EvmSwapToken => ({
      address: token.address,
      decimals: token.decimals,
      kind: "erc20",
      name: token.name,
      symbol: token.symbol,
    }));
    return [...native, ...canonical, ...registered, ...discovered].filter(
      (token, index, values) =>
        values.findIndex(
          (candidate) => candidate.address.toLowerCase() === token.address.toLowerCase()
        ) === index
    );
  }, [discovery.pools, launch, selectedChainId, walletTokens.tokens]);
  const requested = (value: string | undefined) =>
    value && /^(eth|native)$/i.test(value)
      ? zeroAddress
      : value && isAddress(value)
        ? getAddress(value)
        : undefined;
  const [sourceAddress, setSourceAddress] = useState<string>(requested(initialIn) ?? zeroAddress);
  const [destinationAddress, setDestinationAddress] = useState<string>(
    requested(initialOut) ?? launch?.contracts.statics ?? ""
  );
  /** The unreviewed pair the user has acknowledged, so the warning is answered once per pair. */
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceVersion, setBalanceVersion] = useState(0);
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const { address: walletAddress, getEthereumProvider } = wallet;
  const source = tokens.find(
    (token) => token.address.toLowerCase() === sourceAddress.toLowerCase()
  );
  const destination = tokens.find(
    (token) =>
      token.address.toLowerCase() === destinationAddress.toLowerCase() &&
      token.address !== source?.address
  );
  const parsedAmount = (() => {
    try {
      return source ? parseLocalizedUnits(amount, source.decimals, locale) : 0n;
    } catch {
      return 0n;
    }
  })();
  const insufficient = balance !== null && parsedAmount > balance;
  const submitting = submitState !== "idle";
  const outputRaw = quote?.quote?.output.amount;
  const minimumRaw =
    quote?.quote?.aggregatedOutputs?.[0]?.minAmount ??
    quote?.quote?.aggregatedOutputs?.[0]?.amount ??
    outputRaw;
  const route =
    source && destination
      ? selectSwapRoute(
          active,
          selectedChainId,
          source,
          destination,
          staticsNetwork,
          phaseOne ? discovery.pools : undefined
        )
      : null;
  const unreviewed = [source, destination].filter(
    (token): token is EvmSwapToken => token?.reviewed === false
  );
  const pairKey = `${source?.address}:${destination?.address}`;
  const needsAcknowledgement = unreviewed.length > 0 && acknowledged !== pairKey;
  const identity = [
    wallet.address,
    wallet.chainId,
    wallet.status,
    wallet.walletKind,
    selectedChainId,
    route?.id,
    route?.kind === "direct" ? `${route.router}:${route.quoter}:${route.permit2}` : "",
    active.descriptor.deploymentId,
    initialIn,
    initialOut,
    acknowledged,
    source?.address,
    destination?.address,
    parsedAmount.toString(),
    slippage,
  ].join(":");
  const identityRef = useRef(identity);
  const [review, setReview] = useState<{
    identity: string;
    minimum: bigint;
    path?: readonly PathHop[];
  } | null>(null);
  useEffect(() => {
    identityRef.current = identity;
    const timer = window.setTimeout(() => {
      setReview(null);
      setReviewing(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [identity]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSourceAddress(
        requested(initialIn) ?? tokens.find((token) => token.kind === "native")?.address ?? ""
      );
      setDestinationAddress(
        requested(initialOut) ??
          tokens.find((token) => token.symbol === "STATICS")?.address ??
          tokens[1]?.address ??
          ""
      );
      setAmount("");
      setQuote(null);
      setReviewing(false);
      setError(null);
    }, 0);
    return () => window.clearTimeout(timeout);
    // Discovery can refresh balances/metadata while the user types. Reset only
    // when the network, deployment or requested pair changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedChainId,
    launch?.contracts.statics,
    active.descriptor.deploymentId,
    initialIn,
    initialOut,
  ]);

  useEffect(() => {
    let active = true;
    const reset = window.setTimeout(() => {
      if (active) setBalance(null);
    }, 0);
    if (!walletAddress || !source || !walletOnSelectedChain) return;
    void (async () => {
      try {
        const provider = await getEthereumProvider();
        const network = getFundingNetwork(selectedChainId);
        if (!provider || !network) return;
        const publicClient = createPublicClient({
          chain: network.chain,
          transport: custom(provider),
        });
        const value =
          source.kind === "native"
            ? await publicClient.getBalance({ address: getAddress(walletAddress) })
            : await publicClient.readContract({
                address: source.address,
                abi: erc20BalanceAbi,
                functionName: "balanceOf",
                args: [getAddress(walletAddress)],
              });
        if (active) setBalance(value);
      } catch {
        if (active) setBalance(null);
      }
    })();
    return () => {
      active = false;
      window.clearTimeout(reset);
    };
  }, [
    source,
    walletAddress,
    selectedChainId,
    walletOnSelectedChain,
    getEthereumProvider,
    balanceVersion,
  ]);

  const requestQuote = async (
    signal?: AbortSignal,
    pinnedPath?: readonly PathHop[]
  ): Promise<QuotePayload> => {
    if (!wallet.address || !source || !destination || !route || parsedAmount <= 0n) {
      throw new Error("Enter an amount and choose two assets.");
    }
    if (route.kind === "direct") {
      const provider = await wallet.getEthereumProvider();
      const network = getFundingNetwork(selectedChainId);
      if (!provider || !network) throw new Error("The selected wallet is unavailable.");
      const publicClient = createPublicClient({
        chain: network.chain,
        transport: custom(provider),
      });
      const { amountOut, path } = await quoteSwapRoute(
        publicClient,
        pinnedPath ? { ...route, paths: [pinnedPath] } : route,
        parsedAmount,
        getAddress(wallet.address)
      );
      const bps = slippagePercentToBps(slippage);
      if (bps === null) throw new Error("Choose a valid slippage tolerance.");
      return {
        routeId: route.id,
        path,
        quote: {
          input: { amount: parsedAmount.toString(), token: source.address },
          output: { amount: amountOut.toString(), token: destination.address },
          aggregatedOutputs: [
            {
              amount: amountOut.toString(),
              minAmount: minimumWithSlippage(amountOut, bps).toString(),
              token: destination.address,
            },
          ],
        },
      };
    }
    if (!isUniswapSwapChainId(selectedChainId))
      throw new Error("No swap route is available for this pair on this network.");
    const response = await fetch("/api/uniswap/quote", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chainId: selectedChainId,
        tokenIn: source.address,
        tokenOut: destination.address,
        amount: parsedAmount.toString(),
        swapper: wallet.address,
        slippageTolerance: slippage,
      }),
    });
    const payload = (await readJson(response)) as QuotePayload;
    if (!response.ok || !payload.quote)
      throw new Error(uniswapError(payload, "No swap route is available."));
    return { ...payload, routeId: route.id };
  };

  useEffect(() => {
    const canQuote =
      wallet.status === "ready" &&
      walletOnSelectedChain &&
      parsedAmount > 0n &&
      !insufficient &&
      Boolean(source && destination);
    if (!canQuote) {
      const timeout = window.setTimeout(() => {
        setQuote(null);
        setQuoteLoading(false);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setQuoteLoading(true);
      setError(null);
      void requestQuote(controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) setQuote(next);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) {
            setQuote(null);
            setError(cause instanceof Error ? cause.message : "No swap route is available.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoteLoading(false);
        });
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
    // requestQuote is intentionally reconstructed from the listed quote inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wallet.address,
    wallet.status,
    selectedChainId,
    walletOnSelectedChain,
    source?.address,
    destination?.address,
    parsedAmount,
    insufficient,
    route?.id,
    slippage,
  ]);

  const sendTransaction = async (
    raw: unknown,
    kind: "approve-swap" | "swap",
    label: string,
    assertCurrent: () => void
  ) => {
    if (!wallet.address) throw new Error("Connect a wallet first.");
    const provider = await wallet.getEthereumProvider();
    const network = getFundingNetwork(selectedChainId);
    if (!provider || !network) throw new Error("The selected wallet is unavailable.");
    const account = getAddress(wallet.address);
    const transaction = normalizeUniswapTransaction(raw, {
      chainId: selectedChainId,
      wallet: account,
    });
    const publicClient = createPublicClient({
      chain: network.chain,
      transport: custom(provider),
    });
    return executeProtocolTransaction({
      publicClient,
      wallet: account,
      chainId: selectedChainId,
      deploymentId: active.descriptor.deploymentId,
      kind,
      label,
      amount: `${amount} ${source?.symbol ?? ""}`.trim(),
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
      sendTransaction: (request) => {
        assertCurrent();
        return wallet.sendEvmTransaction(request);
      },
      describeError: (cause) =>
        cause instanceof Error ? cause.message : "The wallet transaction failed.",
    });
  };

  const confirmSwap = async () => {
    if (
      !source ||
      !destination ||
      !quote?.quote ||
      !wallet.address ||
      !route ||
      !review ||
      submitting
    )
      return;
    const accepted = review;
    const assertCurrent = () => {
      if (identityRef.current !== accepted.identity)
        throw new Error("The wallet, network, or swap inputs changed. Review the swap again.");
    };
    const refreshQuote = async () => {
      assertCurrent();
      const fresh = await requestQuote(undefined, accepted.path);
      assertCurrent();
      const freshMinimum = fresh.quote?.aggregatedOutputs?.[0]?.minAmount;
      const executableMinimum = route.kind === "direct" ? fresh.quote?.output.amount : freshMinimum;
      if (
        fresh.routeId !== route.id ||
        !executableMinimum ||
        BigInt(executableMinimum) < accepted.minimum
      ) {
        setQuote(fresh);
        setReviewing(false);
        setReview(null);
        throw new Error("The quote moved below the reviewed minimum. Review the new quote.");
      }
      return fresh;
    };
    setSubmitState("approving");
    setError(null);
    try {
      await refreshQuote();
      if (route.kind === "direct") {
        const provider = await wallet.getEthereumProvider();
        const network = getFundingNetwork(selectedChainId);
        if (!provider || !network) throw new Error("The selected wallet is unavailable.");
        const account = getAddress(wallet.address);
        const publicClient = createPublicClient({
          chain: network.chain,
          transport: custom(provider),
        });
        const send = (input: {
          to: Address;
          data: Hex;
          value?: bigint;
          label: string;
          kind: "approve-swap" | "approve-permit2" | "swap" | "phase-one-swap";
        }) => {
          assertCurrent();
          return executeProtocolTransaction({
            ...input,
            publicClient,
            wallet: account,
            chainId: selectedChainId,
            deploymentId: route.deploymentId,
            amount: `${amount} ${source.symbol}`,
            sendTransaction: (request) => {
              assertCurrent();
              return wallet.sendEvmTransaction(request);
            },
            describeError: (cause) =>
              cause instanceof Error ? cause.message : "The transaction failed.",
          });
        };
        if (source.kind !== "native") {
          const key = [
            "direct-swap-allowances",
            route.deploymentId,
            selectedChainId,
            account,
            route.inputToken,
            route.permit2,
            route.router,
          ] as const;
          const allowanceQuery = {
            queryKey: key,
            staleTime: 0,
            queryFn: async () => {
              const [token, permit] = await Promise.all([
                publicClient.readContract({
                  address: route.inputToken,
                  abi: dopplerStaticsTokenAbi,
                  functionName: "allowance",
                  args: [account, route.permit2],
                }),
                publicClient.readContract({
                  address: route.permit2,
                  abi: permit2AllowanceAbi,
                  functionName: "allowance",
                  args: [account, route.inputToken, route.router],
                }),
              ]);
              return { token, permit };
            },
          };
          const allowance = await queryClient.fetchQuery(allowanceQuery);
          let approved = false;
          if (allowance.token < parsedAmount) {
            await send({
              to: route.inputToken,
              data: maximumTokenApproval(route.permit2),
              kind: "approve-swap",
              label: `Enable ${source.symbol} swaps`,
            });
            approved = true;
          }
          const [block, pending] = await Promise.all([
            publicClient.getBlock(),
            publicClient.getBlock({ blockTag: "pending" }).catch(() => null),
          ]);
          const now = Number(
            swapDeadlineBase(
              block.timestamp,
              pending?.timestamp ?? null,
              BigInt(Math.floor(Date.now() / 1000))
            )
          );
          if (
            !hasUsablePermit2Allowance(allowance.permit[0], allowance.permit[1], parsedAmount, now)
          ) {
            await send({
              to: route.permit2,
              data: encodeFunctionData({
                abi: permit2AllowanceAbi,
                functionName: "approve",
                args: [
                  route.inputToken,
                  route.router,
                  MAX_PERMIT2_ALLOWANCE,
                  MAX_PERMIT2_EXPIRATION,
                ],
              }),
              kind: "approve-permit2",
              label: `Authorize ${source.symbol} swaps`,
            });
            approved = true;
          }
          if (approved) await queryClient.fetchQuery(allowanceQuery);
        }
        await refreshQuote();
        const [block, pendingBlock] = await Promise.all([
          publicClient.getBlock(),
          publicClient.getBlock({ blockTag: "pending" }).catch(() => null),
        ]);
        const deadline =
          swapDeadlineBase(
            block.timestamp,
            pendingBlock?.timestamp ?? null,
            BigInt(Math.floor(Date.now() / 1000))
          ) + PERMIT_TTL;
        // Execution keeps the exact path accepted in review, including after approvals.
        const execution = accepted.path
          ? buildV4ExactInputPathSwap({
              router: route.router,
              currencyIn: route.inputToken,
              path: accepted.path,
              amountIn: parsedAmount,
              amountOutMinimum: accepted.minimum,
              deadline,
              settlement: route.settlement,
            })
          : buildV4ExactInputSingleSwap({
              router: route.router,
              poolKey: route.poolKey,
              zeroForOne: route.zeroForOne,
              amountIn: parsedAmount,
              amountOutMinimum: accepted.minimum,
              deadline,
              settlement: route.settlement,
            });
        setSubmitState("swapping");
        await send({
          to: execution.target,
          data: execution.calldata,
          value: execution.value,
          kind: route.phaseOne ? "phase-one-swap" : "swap",
          label: `${source.symbol} to ${destination.symbol}`,
        });
      } else {
        if (source.kind === "erc20") {
          const response = await fetch("/api/uniswap/check-approval", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              chainId: selectedChainId,
              token: source.address,
              tokenOut: destination.address,
              amount: parsedAmount.toString(),
              walletAddress: wallet.address,
            }),
          });
          const approval = (await readJson(response)) as { cancel?: unknown; approval?: unknown };
          if (!response.ok) throw new Error(uniswapError(approval, "Approval check failed."));
          assertCurrent();
          if (approval.cancel)
            await sendTransaction(
              approval.cancel,
              "approve-swap",
              "Reset swap approval",
              assertCurrent
            );
          assertCurrent();
          if (approval.approval)
            await sendTransaction(
              approval.approval,
              "approve-swap",
              `Approve ${source.symbol}`,
              assertCurrent
            );
        }
        const fresh = await refreshQuote();
        // The API's quote is opaque. Only accept its unchanged executable minimum
        // when it still protects the floor the user reviewed, including fee outputs.
        const provider = await wallet.getEthereumProvider();
        const network = getFundingNetwork(selectedChainId);
        if (!provider || !network) throw new Error("The selected wallet is unavailable.");
        const client = createPublicClient({ chain: network.chain, transport: custom(provider) });
        const [block, pending] = await Promise.all([
          client.getBlock(),
          client.getBlock({ blockTag: "pending" }).catch(() => null),
        ]);
        const deadline = Number(
          swapDeadlineBase(
            block.timestamp,
            pending?.timestamp ?? null,
            BigInt(Math.floor(Date.now() / 1000))
          ) + PERMIT_TTL
        );
        setSubmitState("swapping");
        const response = await fetch("/api/uniswap/swap", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ quote: fresh.quote, deadline }),
        });
        const swap = (await readJson(response)) as { swap?: unknown };
        if (!response.ok || !swap.swap)
          throw new Error(uniswapError(swap, "Uniswap could not build the swap transaction."));
        assertCurrent();
        await sendTransaction(
          swap.swap,
          "swap",
          `${source.symbol} to ${destination.symbol}`,
          assertCurrent
        );
      }
      setBalanceVersion((version) => version + 1);
      setAmount("");
      setQuote(null);
      setReview(null);
      setReviewing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Swap failed.");
    } finally {
      setSubmitState("idle");
    }
  };

  const walletRecovery = walletRecoveryAction(wallet.status);
  const nextAction = () => {
    if (walletRecovery === "login") return wallet.login();
    if (walletRecovery === "create-wallet") return void wallet.createWallet();
    if (wallet.status !== "ready") return;
    if (wallet.address && !walletOnSelectedChain) {
      return staticsNetwork
        ? void wallet.switchNetwork()
        : void wallet.selectFundingNetwork(selectedChainId);
    }
    if (quote?.quote && route && minimumRaw) {
      setReview({
        identity,
        minimum: BigInt(minimumRaw),
        path: quote.path?.map((hop) => Object.freeze({ ...hop })),
      });
      setReviewing(true);
    }
  };

  const actionLabel =
    walletRecovery === "login"
      ? t("connectWallet")
      : walletRecovery === "create-wallet"
        ? t("createEmbeddedWallet")
        : wallet.address && !walletOnSelectedChain
          ? t("switchTo", { network: selectedNetworkName })
          : quoteLoading
            ? t("findingRoute")
            : insufficient
              ? t("insufficientBalance")
              : t("reviewSwap");
  const actionDisabled =
    wallet.status === "unconfigured" ||
    wallet.status === "loading" ||
    submitting ||
    quoteLoading ||
    (wallet.status === "ready" &&
      walletOnSelectedChain &&
      (!quote?.quote || insufficient || needsAcknowledgement));

  return (
    <div className="portal-panel" role="tabpanel">
      <fieldset disabled={submitting} className="portal-swap-fields">
        {settingsOpen && (
          <SlippageSettingsDialog
            value={slippage}
            onApply={writePortalSlippage}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        {!staticsNetwork && (
          <label className="portal-field">
            <span>{t("fundingNetwork")}</span>
            <select
              value={wallet.fundingChainId}
              onChange={(event) => {
                setQuote(null);
                setReviewing(false);
                setError(null);
                void wallet.selectFundingNetwork(Number(event.target.value));
              }}
            >
              {wallet.fundingNetworks.map((network) => (
                <option key={network.chainId} value={network.chainId}>
                  {network.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <SwapAssetField
          label={t("youPay")}
          slippage={slippage}
          onEditSlippage={() => setSettingsOpen(true)}
          tokens={tokens}
          selected={source}
          excluded={destination?.address}
          amount={amount}
          balance={balance === null || !source ? "--" : displayAmount(balance.toString(), source)}
          onMax={
            balance === null || balance === 0n || !source || source.kind === "native"
              ? undefined
              : () => {
                  setAmount(displayAmount(balance.toString(), source));
                  setQuote(null);
                  setReviewing(false);
                  setError(null);
                }
          }
          onAmount={(value) => {
            setAmount(value);
            setQuote(null);
            setReviewing(false);
            setError(null);
          }}
          onToken={(address) => {
            setSourceAddress(address);
            setQuote(null);
            setReviewing(false);
            setError(null);
          }}
        />
        <button
          className="portal-switch-assets"
          type="button"
          aria-label={t("switchSwapDirection")}
          disabled={submitting || !source || !destination}
          onClick={() => {
            setSourceAddress(destination!.address);
            setDestinationAddress(source!.address);
            setQuote(null);
            setReviewing(false);
            setError(null);
          }}
        >
          ⇅
        </button>
        <SwapAssetField
          label={t("youReceive")}
          tokens={tokens}
          selected={destination}
          excluded={source?.address}
          amount={displayAmount(outputRaw, destination)}
          balance="--"
          readOnly
          onToken={(address) => {
            setDestinationAddress(address);
            setQuote(null);
            setReviewing(false);
            setError(null);
          }}
        />
      </fieldset>
      {quote?.quote && (
        <dl className="portal-quote-grid">
          <QuoteDatum
            label={t("minimumReceived")}
            value={
              minimumRaw && destination
                ? `${displayAmount(minimumRaw, destination)} ${destination.symbol}`
                : "--"
            }
          />
          <QuoteDatum
            label={t("priceImpact")}
            value={
              quote.quote.priceImpact === undefined
                ? "--"
                : `${quote.quote.priceImpact.toFixed(2)}%`
            }
            tone={priceImpactTone(quote.quote.priceImpact)}
          />
          <QuoteDatum
            label={t("networkCost")}
            value={quote.quote.gasFeeUSD ? `$${quote.quote.gasFeeUSD}` : "--"}
          />
        </dl>
      )}
      {unreviewed.length > 0 && (
        <div className="portal-unreviewed" role="note">
          <strong>{t("unreviewedTitle")}</strong>
          <p>
            {t("unreviewedHelp", {
              tokens: unreviewed.map((token) => `${token.symbol} (${token.address})`).join(", "),
            })}
          </p>
          <label>
            <input
              type="checkbox"
              checked={acknowledged === pairKey}
              onChange={(event) => setAcknowledged(event.target.checked ? pairKey : null)}
            />
            {t("unreviewedAcknowledge")}
          </label>
        </div>
      )}
      {(!source || !destination) && !discovery.discovering && (
        <p className="portal-error" role="alert">
          {t("linkedPairUnavailable")}
        </p>
      )}
      {error && (
        <p className="portal-error" role="alert">
          {error}
        </p>
      )}
      {reviewing && quote?.quote ? (
        <div className="portal-review">
          <div>
            <span>
              {amount || "--"} {source?.symbol}
            </span>
            <strong>→</strong>
            <span>
              {displayAmount(outputRaw, destination)} {destination?.symbol}
            </span>
          </div>
          <button
            className="portal-primary-action"
            type="button"
            disabled={submitting}
            onClick={() => void confirmSwap()}
          >
            {submitState === "approving"
              ? t("checkingApproval")
              : submitState === "swapping"
                ? t("swapping")
                : t("confirmSwap")}
          </button>
        </div>
      ) : (
        <button
          className="portal-primary-action"
          type="button"
          disabled={actionDisabled}
          onClick={nextAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function SwapAssetField({
  label,
  tokens,
  selected,
  excluded,
  amount,
  balance,
  readOnly = false,
  onAmount,
  onToken,
  onMax,
  slippage,
  onEditSlippage,
}: {
  label: string;
  tokens: EvmSwapToken[];
  selected: EvmSwapToken | undefined;
  excluded?: Address;
  amount: string;
  balance: string;
  readOnly?: boolean;
  onAmount?: (value: string) => void;
  onToken: (address: string) => void;
  onMax?: () => void;
  slippage?: number;
  onEditSlippage?: () => void;
}) {
  const t = useTranslations("portal");
  const unreviewedLabel = t("unreviewed");
  return (
    // A div rather than a label, because the slippage control lives in this
    // card and a button inside a label would also activate the amount input.
    <div className="portal-field portal-asset-field">
      <div className="portal-asset-field-head">
        <span className="portal-field-label">{label}</span>
        {slippage !== undefined && onEditSlippage && (
          <SlippageInlineControl value={slippage} onEdit={onEditSlippage} />
        )}
      </div>
      <div>
        <input
          inputMode="decimal"
          value={amount}
          readOnly={readOnly}
          aria-label={`${label} amount`}
          placeholder="0.00"
          onChange={(event) => onAmount?.(event.target.value)}
        />
        <select
          aria-label={`${label} asset`}
          value={selected?.address ?? ""}
          onChange={(event) => onToken(event.target.value)}
        >
          {!selected && <option value="">{t("selectAsset")}</option>}
          {tokens
            .filter((token) => token.address !== excluded)
            .map((token) => (
              <option key={token.address} value={token.address}>
                {token.reviewed === false
                  ? `${token.symbol} · ${unreviewedLabel} · ${token.address.slice(0, 6)}…${token.address.slice(-4)}`
                  : token.symbol}
              </option>
            ))}
        </select>
      </div>
      <div className="portal-asset-field-foot">
        <small>{readOnly ? "--" : t("balance", { balance })}</small>
        {onMax && (
          <button className="portal-asset-max" type="button" onClick={onMax}>
            {t("max")}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Price impact is the one figure here that carries a warning, so it is the one
 * that earns colour. Semantic, and separate from the accent.
 */
function priceImpactTone(impact: number | undefined): QuoteTone {
  if (impact === undefined) return "neutral";
  if (impact >= 5) return "negative";
  if (impact >= 1) return "warning";
  return "positive";
}

type QuoteTone = "neutral" | "positive" | "warning" | "negative";

function QuoteDatum({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: QuoteTone;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={tone === "neutral" ? undefined : `is-${tone}`}>{value}</dd>
    </div>
  );
}
