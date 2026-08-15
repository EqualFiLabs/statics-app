"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  encodeFunctionData,
  formatEther,
  getAddress,
  isAddress,
  parseEventLogs,
  parseUnits,
  type Address,
} from "viem";
import { usePublicClient } from "wagmi";

import { basketTokenAbi, buildCreateBasketTransaction, staticsAbi } from "@statics-protocol/sdk";

import { EmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import {
  ProtocolSlippageControl,
  useProtocolSlippage,
} from "@/components/protocol/ProtocolSlippage";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { calculateBasketLaunchQuote, type BasketLaunchQuote } from "@/lib/baskets/creation";
import { loadTokenMetadata, type TokenMetadata } from "@/lib/baskets/baskets";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import {
  executeProtocolActionPlan,
  protocolActionProgressLabel,
  type ProtocolActionProgress,
} from "@/lib/protocol/action-plan";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { bpsToPercentInput, formatTokenAmount, percentInputToBps } from "@/lib/protocol/ux";
import { slippagePercentToBps } from "@/lib/portal/slippage";
import { searchTokenList, type TokenListEntry } from "@/lib/token-list";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();
const configuredDeployment =
  deploymentState.status === "configured" ? deploymentState.deployment : null;

type ConstituentDraft = {
  asset: Address;
  bundle: string;
  price: string;
  seed: string;
};

type AssetRuntime = {
  metadata: TokenMetadata;
  walletBalance: bigint;
  allowance: bigint;
};

const steps = ["Identity", "Assets & composition", "Starting pools", "Economics", "Review"];

export function BasketCreatePage() {
  if (!configuredDeployment) return <UnconfiguredSurface subject="Basket creation" />;
  return <BasketCreateWalletGate />;
}

function BasketCreateWalletGate() {
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject="Basket creation" />;
  return <BasketCreateRuntime />;
}

function BasketCreateRuntime() {
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const protocolSlippage = useProtocolSlippage();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const chainId = configuredDeployment!.chainId;
  const walletTokens = useWalletTokens(chainId);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [constituents, setConstituents] = useState<ConstituentDraft[]>([]);
  const [tokenSearch, setTokenSearch] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [advancedEconomics, setAdvancedEconomics] = useState(false);
  const [mintFee, setMintFee] = useState("0.001");
  const [redemptionFee, setRedemptionFee] = useState("0.001");
  const [flashFeePercent, setFlashFeePercent] = useState(bpsToPercentInput(5));
  const [originationFeePercent, setOriginationFeePercent] = useState(bpsToPercentInput(100));
  const [extensionFeePercent, setExtensionFeePercent] = useState(bpsToPercentInput(25));
  const [ltvPercent, setLtvPercent] = useState(bpsToPercentInput(7_500));
  const [recoveryPercent, setRecoveryPercent] = useState(bpsToPercentInput(500));
  const [loanDurationDays, setLoanDurationDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProtocolActionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const creation = useQuery({
    queryKey: ["basket-creation-fee", configuredDeployment?.protocolCommit ?? null],
    enabled: Boolean(publicClient) && walletState.status === "ready" && walletState.isTargetChain,
    queryFn: async () => {
      if (!publicClient || !configuredDeployment) throw new Error("No verified deployment.");
      await verifyDollarDeployment(publicClient, configuredDeployment);
      return publicClient.readContract({
        address: configuredDeployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "creationFee",
      });
    },
  });

  const assets = useQuery({
    queryKey: [
      "basket-launch-assets",
      configuredDeployment?.protocolCommit,
      wallet,
      constituents.map((item) => item.asset).join(","),
    ],
    enabled: Boolean(publicClient && wallet && constituents.length),
    queryFn: async (): Promise<readonly AssetRuntime[]> => {
      if (!publicClient || !wallet || !configuredDeployment) return [];
      return Promise.all(
        constituents.map(async ({ asset }) => {
          const [metadata, walletBalance, allowance] = await Promise.all([
            loadTokenMetadata(publicClient, asset),
            publicClient.readContract({
              address: asset,
              abi: basketTokenAbi,
              functionName: "balanceOf",
              args: [wallet],
            }),
            publicClient.readContract({
              address: asset,
              abi: basketTokenAbi,
              functionName: "allowance",
              args: [wallet, configuredDeployment.contracts.diamond],
            }),
          ]);
          return { metadata, walletBalance, allowance };
        })
      );
    },
  });

  if (!wallet) {
    return (
      <EmptyState
        title="Connect your wallet"
        description="Connect to configure, fund, and launch an index basket."
      />
    );
  }

  const addAsset = (token: Pick<TokenListEntry, "address">) => {
    const address = getAddress(token.address);
    if (constituents.some((row) => row.asset === address)) return;
    setConstituents((current) => [
      ...current,
      { asset: address, bundle: "1", price: "1", seed: "1" },
    ]);
    setTokenSearch("");
    setCustomAddress("");
    setError(null);
  };

  const update = (index: number, field: "bundle" | "price" | "seed", value: string) => {
    setConstituents((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );
    setError(null);
  };

  const makeQuote = (runtime: readonly AssetRuntime[] | undefined): BasketLaunchQuote | null => {
    if (!runtime || runtime.length !== constituents.length) return null;
    try {
      return calculateBasketLaunchQuote(
        constituents.map((row, index) => ({
          address: row.asset,
          symbol: runtime[index]!.metadata.symbol,
          decimals: runtime[index]!.metadata.decimals,
          bundleAmount: parseUnits(row.bundle, runtime[index]!.metadata.decimals),
          assetPerBasket: parseUnits(row.price, runtime[index]!.metadata.decimals),
          seedAssetAmount: parseUnits(row.seed, runtime[index]!.metadata.decimals),
          walletBalance: runtime[index]!.walletBalance,
        })),
        parseUnits(mintFee, 18),
        BigInt(slippagePercentToBps(protocolSlippage))
      );
    } catch {
      return null;
    }
  };

  const quote = makeQuote(assets.data);
  const economics = {
    flash: percentInputToBps(flashFeePercent),
    origination: percentInputToBps(originationFeePercent),
    extension: percentInputToBps(extensionFeePercent),
    ltv: percentInputToBps(ltvPercent, 95),
    recovery: percentInputToBps(recoveryPercent),
  };
  const durationDays = Number(loanDurationDays);
  const economicsValid =
    Object.values(economics).every((value) => value !== null) &&
    Number.isSafeInteger(durationDays) &&
    durationDays > 0 &&
    (economics.ltv ?? 0) + Math.ceil(((economics.ltv ?? 0) * (economics.recovery ?? 0)) / 10_000) <=
      10_000;
  const identityValid = Boolean(name.trim()) && /^[A-Za-z][A-Za-z0-9-]{1,10}$/.test(symbol.trim());
  const assetsValid =
    constituents.length > 0 &&
    constituents.length <= 16 &&
    Boolean(assets.data?.every((item) => item.metadata.metadataAvailable)) &&
    constituents.every((row) => {
      try {
        return parseUnits(row.bundle, 18) > 0n;
      } catch {
        return false;
      }
    });
  const poolsValid = quote !== null;
  const approvalCount =
    quote?.assets.filter(
      (item, index) => (assets.data?.[index]?.allowance ?? 0n) < item.maximumAmount
    ).length ?? 0;
  const hasShortfall = Boolean(quote?.assets.some((item) => item.shortfall > 0n));

  const nextAllowed = [identityValid, assetsValid, poolsValid, economicsValid, false][step];

  const launch = async () => {
    if (!publicClient || creation.data === undefined || !configuredDeployment) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      if (!identityValid) throw new Error("Enter a basket name and a 2-11 character symbol.");
      if (!economicsValid) throw new Error("Review the basket economics and loan safety limits.");
      const refreshed = await assets.refetch();
      const freshQuote = makeQuote(refreshed.data);
      if (!freshQuote) throw new Error("A fresh launch quote could not be calculated.");
      if (freshQuote.assets.some((item) => item.shortfall > 0n)) {
        throw new Error("Your wallet does not hold enough of every launch asset.");
      }
      const block = await publicClient.getBlock({ blockTag: "latest" });
      const transaction = buildCreateBasketTransaction(
        {
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          assets: freshQuote.assets.map((item) => item.address),
          bundleAmounts: freshQuote.assets.map((item) => item.bundleAmount),
          mintFeeTiers: [{ minActionShares: 0n, feeShares: parseUnits(mintFee, 18) }],
          redemptionFeeTiers: [{ minActionShares: 0n, feeShares: parseUnits(redemptionFee, 18) }],
          flashFeeBps: economics.flash!,
          originationFeeBps: economics.origination!,
          extensionFeeBps: economics.extension!,
          ltvBps: economics.ltv!,
          recoveryPenaltyBps: economics.recovery!,
          loanDuration: durationDays * 86_400,
        },
        freshQuote.assets.map((item) => ({
          sqrtPriceAssetPerBasketX96: item.sqrtPriceAssetPerBasketX96,
          pairedAssetAmount: item.seedAssetAmount,
        })),
        freshQuote.assets.map((item) => item.maximumAmount),
        block.timestamp + 1_200n,
        creation.data
      );
      const diamond = configuredDeployment.contracts.diamond;
      await executeProtocolActionPlan(
        [
          ...freshQuote.assets.map((item, index) => ({
            id: `approve-${item.address}`,
            label: `Approve ${item.symbol}`,
            isSatisfied: async () =>
              (await publicClient.readContract({
                address: item.address,
                abi: basketTokenAbi,
                functionName: "allowance",
                args: [wallet, diamond],
              })) >= item.maximumAmount,
            run: () =>
              executeProtocolTransaction({
                publicClient,
                wallet,
                chainId,
                kind: "approve-basket-asset",
                label: `Approve ${item.symbol}`,
                amount: `${formatTokenAmount(item.maximumAmount, item.decimals)} ${item.symbol}`,
                to: item.address,
                data: encodeFunctionData({
                  abi: basketTokenAbi,
                  functionName: "approve",
                  args: [diamond, MAX_ERC20_ALLOWANCE],
                }),
                sendTransaction: walletState.sendEvmTransaction,
                describeError: (caught) =>
                  caught instanceof Error ? caught.message : "Approval failed.",
              }).then(() => undefined),
          })),
          {
            id: "launch",
            label: "Launch and fund basket",
            run: () =>
              executeProtocolTransaction({
                publicClient,
                wallet,
                chainId,
                kind: "create-basket",
                label: `Launch ${symbol.trim().toUpperCase()} basket`,
                amount: `${formatEther(creation.data)} ETH plus reviewed asset funding`,
                to: diamond,
                data: transaction.data,
                value: transaction.value,
                sendTransaction: walletState.sendEvmTransaction,
                describeError: (caught) =>
                  caught instanceof Error ? caught.message : "Basket launch failed.",
                verifyConfirmation: async (receipt) => {
                  const created = parseEventLogs({
                    abi: staticsAbi,
                    eventName: "BasketCreated",
                    logs: receipt.logs,
                    strict: true,
                  });
                  if (!created.some((event) => getAddress(event.args.creator) === wallet)) {
                    throw new Error("The receipt did not contain the reviewed basket creation.");
                  }
                },
              }).then(() => undefined),
          },
        ],
        setProgress
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Basket launch failed.");
    } finally {
      setBusy(false);
    }
  };

  const catalogMatches = [
    ...walletTokens.tokens,
    ...searchTokenList(
      chainId,
      tokenSearch,
      constituents.map((item) => item.asset)
    ),
  ]
    .filter(
      (token, index, all) =>
        all.findIndex(
          (candidate) => candidate.address.toLowerCase() === token.address.toLowerCase()
        ) === index
    )
    .filter((token) => {
      const query = tokenSearch.trim().toLowerCase();
      return (
        !query ||
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query)
      );
    })
    .slice(0, 8);

  return (
    <div className="creation-workspace">
      <section className="ui-card">
        <p className="dapp-section-label">Permissionless launch</p>
        <h2>Launch an index basket</h2>
        <p>
          Choose a fixed bundle, seed one permanent pool per asset, and review every immutable
          setting before signing.
        </p>
        <p>
          <strong>Creation fee:</strong>{" "}
          {creation.data === undefined ? "Loading…" : `${formatEther(creation.data)} ETH`} · creator
          earns 5% of basket swap fees
        </p>
      </section>

      <ol className="creation-steps">
        {steps.map((label, index) => (
          <li key={label} className={step === index ? "is-current" : undefined}>
            <button
              type="button"
              disabled={index > step}
              aria-current={step === index ? "step" : undefined}
              onClick={() => index < step && setStep(index)}
            >
              <span>{index + 1}</span> {label}
            </button>
          </li>
        ))}
      </ol>

      <section className="ui-card creation-form">
        {step === 0 && (
          <div className="remaining-form-grid">
            <label className="basket-field">
              <span>Basket name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
              <small>The descriptive name shown throughout Statics.</small>
            </label>
            <label className="basket-field">
              <span>Symbol</span>
              <input
                value={symbol}
                maxLength={11}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              />
              <small>2–11 characters, beginning with a letter.</small>
            </label>
          </div>
        )}

        {step === 1 && (
          <>
            <label className="basket-field">
              <span>Find a token</span>
              <input
                value={tokenSearch}
                placeholder="Search by name or symbol"
                onChange={(event) => setTokenSearch(event.target.value)}
              />
            </label>
            <div className="creation-token-results">
              {catalogMatches.map((token) => (
                <button key={token.address} type="button" onClick={() => addAsset(token)}>
                  <strong>{token.symbol}</strong>
                  <span>{token.name}</span>
                  <small>{token.address}</small>
                </button>
              ))}
            </div>
            <details
              open={showCustom}
              onToggle={(event) => setShowCustom(event.currentTarget.open)}
            >
              <summary>Advanced: add a custom token</summary>
              <div className="protocol-address-input">
                <input
                  value={customAddress}
                  placeholder="0x…"
                  onChange={(event) => setCustomAddress(event.target.value.trim())}
                />
                <button
                  type="button"
                  disabled={!isAddress(customAddress) || constituents.length >= 16}
                  onClick={() => isAddress(customAddress) && addAsset({ address: customAddress })}
                >
                  Validate and add
                </button>
              </div>
            </details>
            <div className="creation-assets">
              {constituents.map((row, index) => {
                const metadata = assets.data?.[index]?.metadata;
                return (
                  <article key={row.asset}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{metadata?.symbol ?? "Checking token…"}</strong>
                      <small>{metadata?.name ?? row.asset}</small>
                      {metadata && !metadata.metadataAvailable && (
                        <small className="dapp-inline-error">
                          This address is not a readable ERC-20.
                        </small>
                      )}
                    </div>
                    <label>
                      Tokens in 1 {symbol || "basket"}
                      <input
                        inputMode="decimal"
                        value={row.bundle}
                        onChange={(event) => update(index, "bundle", event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setConstituents((current) => current.filter((_, item) => item !== index))
                      }
                    >
                      Remove
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p>
              Set a human starting price and the asset amount to seed. Statics calculates the
              BasketToken side and locks the resulting full-range liquidity permanently.
            </p>
            <div className="creation-assets">
              {constituents.map((row, index) => {
                const metadata = assets.data?.[index]?.metadata;
                const assetQuote = quote?.assets[index];
                return (
                  <article key={row.asset}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{metadata?.symbol ?? "Token"}</strong>
                      <small>
                        Wallet:{" "}
                        {metadata
                          ? formatTokenAmount(assets.data![index]!.walletBalance, metadata.decimals)
                          : "—"}
                      </small>
                    </div>
                    <div>
                      <label>
                        1 {symbol || "BASKET"} = X {metadata?.symbol ?? "asset"}
                        <input
                          inputMode="decimal"
                          value={row.price}
                          onChange={(event) => update(index, "price", event.target.value)}
                        />
                      </label>
                      <label>
                        Seed {metadata?.symbol ?? "asset"}
                        <input
                          inputMode="decimal"
                          value={row.seed}
                          onChange={(event) => update(index, "seed", event.target.value)}
                        />
                      </label>
                      {assetQuote && (
                        <small>
                          Pool receives {formatTokenAmount(assetQuote.poolBasketAmount, 18)}{" "}
                          {symbol || "BASKET"} +{" "}
                          {formatTokenAmount(assetQuote.poolAssetAmount, assetQuote.decimals)}{" "}
                          {assetQuote.symbol}
                        </small>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <ProtocolSlippageControl />
          </>
        )}

        {step === 3 && (
          <div className="creation-economics">
            <section>
              <p className="dapp-section-label">Standard economics</p>
              <h3>Balanced defaults</h3>
              <p>Mint 0.001 · redeem 0.001 · flash 0.05% · origination 1% · extension 0.25%</p>
              <p>Maximum LTV 75% · recovery penalty 5% · duration 30 days</p>
              <label className="protocol-checkbox">
                <input
                  type="checkbox"
                  checked={advancedEconomics}
                  onChange={(event) => setAdvancedEconomics(event.target.checked)}
                />
                Customize immutable economics
              </label>
            </section>
            {advancedEconomics && (
              <section className="remaining-form-grid">
                <EconomicInput
                  label="Mint fee (BasketToken)"
                  value={mintFee}
                  onChange={setMintFee}
                />
                <EconomicInput
                  label="Redemption fee (BasketToken)"
                  value={redemptionFee}
                  onChange={setRedemptionFee}
                />
                <EconomicInput
                  label="Flash fee"
                  value={flashFeePercent}
                  onChange={setFlashFeePercent}
                  percent
                />
                <EconomicInput
                  label="Loan origination fee"
                  value={originationFeePercent}
                  onChange={setOriginationFeePercent}
                  percent
                />
                <EconomicInput
                  label="Loan extension fee"
                  value={extensionFeePercent}
                  onChange={setExtensionFeePercent}
                  percent
                />
                <EconomicInput
                  label="Maximum loan-to-value"
                  value={ltvPercent}
                  onChange={setLtvPercent}
                  percent
                />
                <EconomicInput
                  label="Recovery penalty"
                  value={recoveryPercent}
                  onChange={setRecoveryPercent}
                  percent
                />
                <EconomicInput
                  label="Loan duration (days)"
                  value={loanDurationDays}
                  onChange={setLoanDurationDays}
                />
              </section>
            )}
            {!economicsValid && (
              <p className="dapp-inline-error" role="alert">
                Enter valid percentages. Maximum LTV plus its recovery penalty must remain fully
                collateralized.
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="creation-review">
            <section>
              <p className="dapp-section-label">Immutable basket</p>
              <h3>
                {name} ({symbol})
              </h3>
              <ul>
                <li>{constituents.length} fixed constituents</li>
                <li>
                  Initial supply: {quote ? formatTokenAmount(quote.basketShares, 18) : "—"} {symbol}
                </li>
                <li>Creator revenue share: 5% of this basket's swap fees</li>
                <li>
                  Creation fee:{" "}
                  {creation.data === undefined ? "—" : `${formatEther(creation.data)} ETH`}
                </li>
                <li>
                  {approvalCount} token approval{approvalCount === 1 ? "" : "s"} required
                </li>
              </ul>
            </section>
            <section>
              <p className="dapp-section-label">Funding</p>
              <h3>Maximum wallet debit</h3>
              <ul>
                {quote?.assets.map((item) => (
                  <li key={item.address}>
                    <strong>
                      {formatTokenAmount(item.maximumAmount, item.decimals)} {item.symbol}
                    </strong>
                    <small>
                      pool {formatTokenAmount(item.poolAssetAmount, item.decimals)} · backing{" "}
                      {formatTokenAmount(item.backingAmount, item.decimals)}
                      {item.shortfall > 0n
                        ? ` · short ${formatTokenAmount(item.shortfall, item.decimals)}`
                        : " · funded"}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
            <details className="liquidity-position-diagnostics">
              <summary>Technical details</summary>
              <p>
                Flash {flashFeePercent}% · origination {originationFeePercent}% · extension{" "}
                {extensionFeePercent}% · LTV {ltvPercent}% · recovery {recoveryPercent}% ·{" "}
                {loanDurationDays} days
              </p>
            </details>
          </div>
        )}

        {progress && <p role="status">{protocolActionProgressLabel(progress)}</p>}
        {error && (
          <div className="dapp-error" role="alert">
            {error}
          </div>
        )}
        <div className="creation-footer">
          <button
            type="button"
            disabled={busy || step === 0}
            onClick={() => setStep((current) => current - 1)}
          >
            Back
          </button>
          {step < steps.length - 1 ? (
            <button
              className="creation-next"
              type="button"
              disabled={busy || !nextAllowed}
              onClick={() => setStep((current) => current + 1)}
            >
              Continue
            </button>
          ) : (
            <button
              className="dollar-submit"
              type="button"
              disabled={busy || !quote || hasShortfall || creation.data === undefined}
              onClick={() => void launch()}
            >
              {busy
                ? "Launching and verifying…"
                : hasShortfall
                  ? "Fund wallet to launch"
                  : "Launch basket"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function EconomicInput({
  label,
  value,
  onChange,
  percent = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  percent?: boolean;
}) {
  return (
    <label className="basket-field">
      <span>{label}</span>
      <div className={percent ? "protocol-percent-input" : undefined}>
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {percent && <span>%</span>}
      </div>
    </label>
  );
}
