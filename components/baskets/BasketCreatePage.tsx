"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  encodeFunctionData,
  formatEther,
  getAddress,
  parseEventLogs,
  parseUnits,
  type Address,
} from "viem";
import { usePublicClient } from "wagmi";

import { basketTokenAbi, buildCreateBasketTransaction, staticsAbi } from "@statics-protocol/sdk";

import { EmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import {
  ProtocolActionScope,
  useProtocolSurface,
} from "@/components/protocol/ProtocolAvailability";
import {
  ProtocolSlippageControl,
  useProtocolSlippage,
} from "@/components/protocol/ProtocolSlippage";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { useDeployment } from "@/providers/deployment-context";
import { calculateBasketLaunchQuote, type BasketLaunchQuote } from "@/lib/baskets/creation";
import { loadTokenMetadata, type TokenMetadata } from "@/lib/baskets/baskets";
import { verifyDollarDeployment } from "@/lib/dollar/deployment";
import {
  executeProtocolActionPlan,
  protocolActionProgressLabel,
  type ProtocolActionProgress,
} from "@/lib/protocol/action-plan";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import {
  bpsToPercentInput,
  formatTokenAmount,
  parseRecipientAddress,
  percentInputToBps,
} from "@/lib/protocol/ux";
import { slippagePercentToBps } from "@/lib/portal/slippage";
import { searchTokenList, type TokenListEntry } from "@/lib/token-list";
import { useWalletState } from "@/providers/wallet-context";

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

export function BasketCreatePage() {
  return (
    <ProtocolActionScope>
      <BasketCreateWalletGate />
    </ProtocolActionScope>
  );
}

function BasketCreateWalletGate() {
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject="Basket creation" />;
  return <BasketCreateRuntime />;
}

function BasketCreateRuntime() {
  const t = useTranslations("creation");
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const protocolSlippage = useProtocolSlippage();
  const protocol = useProtocolSurface();
  const configuredDeployment = protocol.deployment;
  const { active } = useDeployment();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const chainId = active.descriptor.chainId;
  const walletTokens = useWalletTokens(chainId, active.protocol ?? active.launch);
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
  const MAX_LOAN_DURATION_DAYS = Math.floor(Number((1n << 40n) - 1n) / 86_400);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProtocolActionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const creation = useQuery({
    queryKey: ["basket-creation-fee", configuredDeployment?.protocolCommit ?? null],
    enabled:
      protocol.available &&
      Boolean(publicClient) &&
      walletState.status === "ready" &&
      walletState.isTargetChain,
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
    enabled: protocol.available && Boolean(publicClient && wallet && constituents.length),
    queryFn: async (): Promise<readonly AssetRuntime[]> => {
      if (!publicClient || !wallet || !configuredDeployment) return [];
      return Promise.all(
        constituents.map(async ({ asset }) => {
          const [metadata, walletBalance, allowance] = await Promise.all([
            loadTokenMetadata(publicClient, asset),
            publicClient
              .readContract({
                address: asset,
                abi: basketTokenAbi,
                functionName: "balanceOf",
                args: [wallet],
              })
              .catch(() => 0n),
            publicClient
              .readContract({
                address: asset,
                abi: basketTokenAbi,
                functionName: "allowance",
                args: [wallet, configuredDeployment.contracts.diamond],
              })
              .catch(() => 0n),
          ]);
          return { metadata, walletBalance, allowance };
        })
      );
    },
  });

  if (!wallet) {
    return <EmptyState title={t("connectTitle")} description={t("connectDescription")} />;
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
  let flatFeesValid = false;
  try {
    flatFeesValid = parseUnits(mintFee, 18) >= 0n && parseUnits(redemptionFee, 18) >= 0n;
  } catch {
    flatFeesValid = false;
  }
  const economicsValid =
    flatFeesValid &&
    Object.values(economics).every((value) => value !== null) &&
    Number.isSafeInteger(durationDays) &&
    durationDays > 0 &&
    durationDays <= MAX_LOAN_DURATION_DAYS &&
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
      if (!refreshed.data?.every((item) => item.metadata.metadataAvailable)) {
        throw new Error("Every launch asset must remain a readable ERC-20.");
      }
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
          ...freshQuote.assets.map((item) => ({
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
    .filter(
      (token) =>
        !constituents.some(
          (constituent) => constituent.asset.toLowerCase() === token.address.toLowerCase()
        )
    )
    .slice(0, 8);
  const steps = [
    t("stepIdentity"),
    t("stepAssets"),
    t("stepPools"),
    t("stepEconomics"),
    t("stepReview"),
  ];

  return (
    <div className="creation-workspace">
      <section className="ui-card">
        <p className="dapp-section-label">{t("permissionless")}</p>
        <h2>{t("title")}</h2>
        <p>{t("description")}</p>
        <p>
          <strong>{t("creationFee")}</strong>{" "}
          {creation.data === undefined ? t("loading") : `${formatEther(creation.data)} ETH`} ·{" "}
          {t("creatorShare")}
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
              <span>{t("basketName")}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
              <small>{t("basketNameHelp")}</small>
            </label>
            <label className="basket-field">
              <span>{t("symbol")}</span>
              <input
                value={symbol}
                maxLength={11}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              />
              <small>{t("symbolHelp")}</small>
            </label>
          </div>
        )}

        {step === 1 && (
          <>
            <label className="basket-field">
              <span>{t("findToken")}</span>
              <input
                value={tokenSearch}
                placeholder={t("searchPlaceholder")}
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
              <summary>{t("customToken")}</summary>
              <div className="protocol-address-input">
                <input
                  value={customAddress}
                  placeholder="0x…"
                  onChange={(event) => setCustomAddress(event.target.value.trim())}
                />
                <button
                  type="button"
                  disabled={!parseRecipientAddress(customAddress) || constituents.length >= 16}
                  onClick={() => {
                    const address = parseRecipientAddress(customAddress);
                    if (address) addAsset({ address });
                  }}
                >
                  {t("validateAdd")}
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
                      <strong>{metadata?.symbol ?? t("checkingToken")}</strong>
                      <small>{metadata?.name ?? row.asset}</small>
                      {metadata && !metadata.metadataAvailable && (
                        <small className="dapp-inline-error">{t("unreadableToken")}</small>
                      )}
                    </div>
                    <label>
                      {t("tokensInBasket", { symbol: symbol || t("basketFallback") })}
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
                      {t("remove")}
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p>{t("poolsHelp")}</p>
            <div className="creation-assets">
              {constituents.map((row, index) => {
                const metadata = assets.data?.[index]?.metadata;
                const assetQuote = quote?.assets[index];
                return (
                  <article key={row.asset}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{metadata?.symbol ?? t("tokenFallback")}</strong>
                      <small>
                        {t("wallet")}{" "}
                        {metadata
                          ? formatTokenAmount(assets.data![index]!.walletBalance, metadata.decimals)
                          : "—"}
                      </small>
                    </div>
                    <div>
                      <label>
                        {t("priceLabel", {
                          basket: symbol || "BASKET",
                          asset: metadata?.symbol ?? t("assetFallback"),
                        })}
                        <input
                          inputMode="decimal"
                          value={row.price}
                          onChange={(event) => update(index, "price", event.target.value)}
                        />
                      </label>
                      <label>
                        {t("seedLabel", { asset: metadata?.symbol ?? t("assetFallback") })}
                        <input
                          inputMode="decimal"
                          value={row.seed}
                          onChange={(event) => update(index, "seed", event.target.value)}
                        />
                      </label>
                      {assetQuote && (
                        <small>
                          {t("poolReceives", {
                            basketAmount: formatTokenAmount(assetQuote.poolBasketAmount, 18),
                            basket: symbol || "BASKET",
                            assetAmount: formatTokenAmount(
                              assetQuote.poolAssetAmount,
                              assetQuote.decimals
                            ),
                            asset: assetQuote.symbol,
                          })}
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
              <p className="dapp-section-label">{t("standardEconomics")}</p>
              <h3>{t("balancedDefaults")}</h3>
              <p>{t("feeDefaults")}</p>
              <p>{t("loanDefaults")}</p>
              <label className="protocol-checkbox">
                <input
                  type="checkbox"
                  checked={advancedEconomics}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setAdvancedEconomics(enabled);
                    if (!enabled) {
                      setMintFee("0.001");
                      setRedemptionFee("0.001");
                      setFlashFeePercent("0.05");
                      setOriginationFeePercent("1");
                      setExtensionFeePercent("0.25");
                      setLtvPercent("75");
                      setRecoveryPercent("5");
                      setLoanDurationDays("30");
                    }
                  }}
                />
                {t("customizeEconomics")}
              </label>
            </section>
            {advancedEconomics && (
              <section className="remaining-form-grid">
                <EconomicInput label={t("mintFee")} value={mintFee} onChange={setMintFee} />
                <EconomicInput
                  label={t("redemptionFee")}
                  value={redemptionFee}
                  onChange={setRedemptionFee}
                />
                <EconomicInput
                  label={t("flashFee")}
                  value={flashFeePercent}
                  onChange={setFlashFeePercent}
                  percent
                />
                <EconomicInput
                  label={t("originationFee")}
                  value={originationFeePercent}
                  onChange={setOriginationFeePercent}
                  percent
                />
                <EconomicInput
                  label={t("extensionFee")}
                  value={extensionFeePercent}
                  onChange={setExtensionFeePercent}
                  percent
                />
                <EconomicInput
                  label={t("maximumLtv")}
                  value={ltvPercent}
                  onChange={setLtvPercent}
                  percent
                />
                <EconomicInput
                  label={t("recoveryPenalty")}
                  value={recoveryPercent}
                  onChange={setRecoveryPercent}
                  percent
                />
                <EconomicInput
                  label={t("loanDuration")}
                  value={loanDurationDays}
                  onChange={setLoanDurationDays}
                />
              </section>
            )}
            {!economicsValid && (
              <p className="dapp-inline-error" role="alert">
                {t("economicsInvalid")}
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="creation-review">
            <section>
              <p className="dapp-section-label">{t("immutableBasket")}</p>
              <h3>
                {name} ({symbol})
              </h3>
              <ul>
                <li>{t("fixedAssets", { count: constituents.length })}</li>
                <li>
                  {t("initialSupply", {
                    amount: quote ? formatTokenAmount(quote.basketShares, 18) : "—",
                    symbol,
                  })}
                </li>
                <li>{t("creatorRevenue")}</li>
                <li>
                  {t("creationFee")}{" "}
                  {creation.data === undefined ? "—" : `${formatEther(creation.data)} ETH`}
                </li>
                <li>{t("approvalsRequired", { count: approvalCount })}</li>
              </ul>
            </section>
            <section>
              <p className="dapp-section-label">{t("funding")}</p>
              <h3>{t("maximumDebit")}</h3>
              <ul>
                {quote?.assets.map((item) => (
                  <li key={item.address}>
                    <strong>
                      {formatTokenAmount(item.maximumAmount, item.decimals)} {item.symbol}
                    </strong>
                    <small>
                      {t("fundingBreakdown", {
                        pool: formatTokenAmount(item.poolAssetAmount, item.decimals),
                        backing: formatTokenAmount(item.backingAmount, item.decimals),
                        status:
                          item.shortfall > 0n
                            ? t("short", {
                                amount: formatTokenAmount(item.shortfall, item.decimals),
                              })
                            : t("funded"),
                      })}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
            <details className="liquidity-position-diagnostics">
              <summary>{t("technicalDetails")}</summary>
              <p>
                {t("economicsSummary", {
                  flash: flashFeePercent,
                  origination: originationFeePercent,
                  extension: extensionFeePercent,
                  ltv: ltvPercent,
                  recovery: recoveryPercent,
                  days: loanDurationDays,
                })}
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
            {t("back")}
          </button>
          {step < steps.length - 1 ? (
            <button
              className="creation-next"
              type="button"
              disabled={busy || !nextAllowed}
              onClick={() => setStep((current) => current + 1)}
            >
              {t("continue")}
            </button>
          ) : (
            <button
              className="dollar-submit"
              type="button"
              disabled={busy || !quote || hasShortfall || creation.data === undefined}
              onClick={() => void launch()}
            >
              {busy ? t("launching") : hasShortfall ? t("fundWallet") : t("launch")}
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
