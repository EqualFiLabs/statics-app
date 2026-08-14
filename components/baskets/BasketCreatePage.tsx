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
} from "viem";
import { usePublicClient } from "wagmi";

import {
  basketTokenAbi,
  buildCreateBasketTransaction,
  encodeSqrtPriceAssetPerBasketX96,
  staticsAbi,
} from "@statics-protocol/sdk";

import { EmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import { loadTokenMetadata } from "@/lib/baskets/baskets";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import {
  executeProtocolActionPlan,
  protocolActionProgressLabel,
  type ProtocolActionProgress,
} from "@/lib/protocol/action-plan";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();
const configuredDeployment =
  deploymentState.status === "configured" ? deploymentState.deployment : null;

type ConstituentDraft = {
  asset: string;
  bundle: string;
  price: string;
  liquidity: string;
  maximum: string;
};
const emptyConstituent = (): ConstituentDraft => ({
  asset: "",
  bundle: "1",
  price: "1",
  liquidity: "1",
  maximum: "2",
});

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
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [constituents, setConstituents] = useState<ConstituentDraft[]>([emptyConstituent()]);
  const [mintFee, setMintFee] = useState("0.001");
  const [redemptionFee, setRedemptionFee] = useState("0.001");
  const [flashFeeBps, setFlashFeeBps] = useState("5");
  const [originationFeeBps, setOriginationFeeBps] = useState("100");
  const [extensionFeeBps, setExtensionFeeBps] = useState("25");
  const [ltvBps, setLtvBps] = useState("7500");
  const [recoveryBps, setRecoveryBps] = useState("500");
  const [loanDurationDays, setLoanDurationDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProtocolActionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const creation = useQuery({
    queryKey: ["basket-creation-fee", configuredDeployment?.protocolCommit ?? null],
    enabled:
      Boolean(configuredDeployment) &&
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

  if (!wallet)
    return (
      <EmptyState
        title="Connect your wallet"
        description="Connect to configure, fund, and launch an index basket."
      />
    );

  const update = (index: number, field: keyof ConstituentDraft, value: string) => {
    setConstituents((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );
    setError(null);
  };

  const launch = async () => {
    if (!publicClient || creation.data === undefined) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      if (!name.trim() || !/^[A-Za-z][A-Za-z0-9-]{1,10}$/.test(symbol.trim()))
        throw new Error("Enter a basket name and a 2-11 character symbol.");
      if (!constituents.length || constituents.length > 16)
        throw new Error("A basket needs between 1 and 16 constituents.");
      if (constituents.some((row) => !isAddress(row.asset)))
        throw new Error("Every constituent needs a valid token address.");
      const addresses = constituents.map((row) => getAddress(row.asset));
      if (new Set(addresses).size !== addresses.length)
        throw new Error("Each constituent token may appear only once.");
      const bps = {
        flash: Number(flashFeeBps),
        origination: Number(originationFeeBps),
        extension: Number(extensionFeeBps),
        ltv: Number(ltvBps),
        recovery: Number(recoveryBps),
      };
      if (Object.values(bps).some((value) => !Number.isInteger(value) || value < 0))
        throw new Error("Fee, LTV, and recovery settings must be whole non-negative BPS values.");
      if (bps.flash > 10_000 || bps.origination > 10_000 || bps.extension > 10_000)
        throw new Error("Fee settings cannot exceed 10,000 BPS.");
      if (bps.ltv > 9_500) throw new Error("Loan-to-value cannot exceed 9,500 BPS.");
      if (bps.recovery > 10_000 || bps.ltv + Math.ceil((bps.ltv * bps.recovery) / 10_000) > 10_000)
        throw new Error("The recovery penalty is too high for the selected loan-to-value.");
      const durationDays = Number(loanDurationDays);
      if (!Number.isSafeInteger(durationDays) || durationDays <= 0 || durationDays > 49_710_269)
        throw new Error("Loan duration must be a positive whole number of days.");
      const mintFeeShares = parseUnits(mintFee, 18);
      const redemptionFeeShares = parseUnits(redemptionFee, 18);
      if (mintFeeShares < 0n || redemptionFeeShares < 0n)
        throw new Error("Mint and redemption fees cannot be negative.");
      const metadata = await Promise.all(
        addresses.map((address) => loadTokenMetadata(publicClient, address))
      );
      const bundleAmounts = constituents.map((row, index) =>
        parseUnits(row.bundle, metadata[index]!.decimals)
      );
      const maxAmountsIn = constituents.map((row, index) =>
        parseUnits(row.maximum, metadata[index]!.decimals)
      );
      const pools = constituents.map((row, index) => ({
        sqrtPriceAssetPerBasketX96: encodeSqrtPriceAssetPerBasketX96(
          parseUnits(row.price, metadata[index]!.decimals),
          10n ** 18n
        ),
        pairedAssetAmount: parseUnits(row.liquidity, metadata[index]!.decimals),
      }));
      if (
        bundleAmounts.some((value) => value <= 0n) ||
        maxAmountsIn.some((value) => value <= 0n) ||
        pools.some((pool) => pool.pairedAssetAmount <= 0n)
      )
        throw new Error("Bundle, price, liquidity, and maximum funding values must be positive.");
      const block = await publicClient.getBlock();
      const transaction = buildCreateBasketTransaction(
        {
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          assets: addresses,
          bundleAmounts,
          mintFeeTiers: [{ minActionShares: 0n, feeShares: mintFeeShares }],
          redemptionFeeTiers: [{ minActionShares: 0n, feeShares: redemptionFeeShares }],
          flashFeeBps: bps.flash,
          originationFeeBps: bps.origination,
          extensionFeeBps: bps.extension,
          ltvBps: bps.ltv,
          recoveryPenaltyBps: bps.recovery,
          loanDuration: durationDays * 24 * 60 * 60,
        },
        pools,
        maxAmountsIn,
        block.timestamp + 3_600n,
        creation.data
      );
      const deployment = configuredDeployment!;
      const diamond = deployment.contracts.diamond;
      const steps = await Promise.all(
        addresses.map(async (address, index) => ({
          id: `approve-${address}`,
          label: `Approve ${metadata[index]!.symbol}`,
          isSatisfied: async () =>
            (await publicClient.readContract({
              address,
              abi: basketTokenAbi,
              functionName: "allowance",
              args: [wallet, diamond],
            })) >= maxAmountsIn[index]!,
          run: () =>
            executeProtocolTransaction({
              publicClient,
              wallet,
              chainId: deployment.chainId,
              kind: "approve-basket-asset",
              label: `Approve ${metadata[index]!.symbol} for basket launch`,
              amount: `${constituents[index]!.maximum} ${metadata[index]!.symbol}`,
              to: address,
              data: encodeFunctionData({
                abi: basketTokenAbi,
                functionName: "approve",
                args: [diamond, MAX_ERC20_ALLOWANCE],
              }),
              sendTransaction: walletState.sendEvmTransaction,
              describeError: (caught) =>
                caught instanceof Error ? caught.message : "Approval failed.",
            }).then(() => undefined),
        }))
      );
      await executeProtocolActionPlan(
        [
          ...steps,
          {
            id: "launch",
            label: "Launch and fund basket",
            run: () =>
              executeProtocolTransaction({
                publicClient,
                wallet,
                chainId: deployment.chainId,
                kind: "create-basket",
                label: `Launch ${symbol.trim().toUpperCase()} basket`,
                amount: `${formatEther(creation.data)} ETH creation fee plus reviewed constituent funding`,
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
                  if (!created.some((event) => getAddress(event.args.creator) === wallet))
                    throw new Error("The receipt did not contain the reviewed basket creation.");
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

  return (
    <div className="creation-workspace">
      <section className="dapp-card">
        <p className="dapp-section-label">Permissionless launch</p>
        <h2>Configure and fund an index</h2>
        <p>
          The creation fee is paid entirely to treasury. Your basket earns the configured 5% creator
          share of swap fees, which you claim from Rewards.
        </p>
        <p>
          <strong>Current creation fee:</strong>{" "}
          {creation.data === undefined ? "Loading…" : `${formatEther(creation.data)} ETH`}
        </p>
      </section>
      <section className="dapp-card creation-form">
        <label>
          Basket name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Symbol
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            maxLength={11}
          />
        </label>
        {constituents.map((row, index) => (
          <fieldset key={index}>
            <legend>Constituent {index + 1}</legend>
            <label>
              Token address
              <input
                value={row.asset}
                onChange={(event) => update(index, "asset", event.target.value)}
                placeholder="0x…"
              />
            </label>
            <label>
              Tokens per basket
              <input
                inputMode="decimal"
                value={row.bundle}
                onChange={(event) => update(index, "bundle", event.target.value)}
              />
            </label>
            <label>
              Initial asset price per basket
              <input
                inputMode="decimal"
                value={row.price}
                onChange={(event) => update(index, "price", event.target.value)}
              />
            </label>
            <label>
              Initial pool funding
              <input
                inputMode="decimal"
                value={row.liquidity}
                onChange={(event) => update(index, "liquidity", event.target.value)}
              />
            </label>
            <label>
              Maximum token spend
              <input
                inputMode="decimal"
                value={row.maximum}
                onChange={(event) => update(index, "maximum", event.target.value)}
              />
            </label>
            {constituents.length > 1 && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setConstituents((current) => current.filter((_, item) => item !== index))
                }
              >
                Remove constituent
              </button>
            )}
          </fieldset>
        ))}
        <button
          type="button"
          disabled={busy || constituents.length >= 16}
          onClick={() => setConstituents((current) => [...current, emptyConstituent()])}
        >
          Add constituent
        </button>
        <label>
          Flat mint fee (BasketToken)
          <input
            inputMode="decimal"
            value={mintFee}
            onChange={(event) => setMintFee(event.target.value)}
          />
        </label>
        <label>
          Flat redemption fee (BasketToken)
          <input
            inputMode="decimal"
            value={redemptionFee}
            onChange={(event) => setRedemptionFee(event.target.value)}
          />
        </label>
        <label>
          Flash fee BPS
          <input
            inputMode="numeric"
            value={flashFeeBps}
            onChange={(event) => setFlashFeeBps(event.target.value)}
          />
        </label>
        <label>
          Loan origination fee BPS
          <input
            inputMode="numeric"
            value={originationFeeBps}
            onChange={(event) => setOriginationFeeBps(event.target.value)}
          />
        </label>
        <label>
          Loan extension fee BPS
          <input
            inputMode="numeric"
            value={extensionFeeBps}
            onChange={(event) => setExtensionFeeBps(event.target.value)}
          />
        </label>
        <label>
          Loan-to-value BPS
          <input
            inputMode="numeric"
            value={ltvBps}
            onChange={(event) => setLtvBps(event.target.value)}
          />
        </label>
        <label>
          Recovery penalty BPS
          <input
            inputMode="numeric"
            value={recoveryBps}
            onChange={(event) => setRecoveryBps(event.target.value)}
          />
        </label>
        <label>
          Loan duration (days)
          <input
            inputMode="numeric"
            value={loanDurationDays}
            onChange={(event) => setLoanDurationDays(event.target.value)}
          />
        </label>
        <div className="creation-review">
          <h3>Immutable launch review</h3>
          <p>
            {constituents.length} constituents · {mintFee || "0"} BasketToken mint fee ·{" "}
            {redemptionFee || "0"} BasketToken redemption fee · {flashFeeBps || "0"} BPS flash fee ·{" "}
            {originationFeeBps || "0"} BPS origination fee · {extensionFeeBps || "0"} BPS extension
            fee · {loanDurationDays || "0"}-day loans.
          </p>
        </div>
        {progress && <p role="status">{protocolActionProgressLabel(progress)}</p>}
        {error && (
          <div className="dapp-error" role="alert">
            {error}
          </div>
        )}
        <button
          className="dollar-submit"
          type="button"
          disabled={busy || creation.data === undefined}
          onClick={() => void launch()}
        >
          {busy ? "Launching…" : "Review wallet prompts and launch"}
        </button>
      </section>
    </div>
  );
}
