"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  decodeFunctionResult,
  formatEther,
  getAddress,
  isAddress,
  parseEventLogs,
  parseUnits,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

import {
  buildCreateBasketTransaction,
  staticsAbi,
  type CreateBasketParams,
  type FeeTier,
} from "@statics-protocol/sdk";

import { BasketCreatePreview } from "@/components/preview/RemainingSurfacesPreview";
import { dappPreviewEnabled } from "@/lib/dapp-preview";
import { describeBasketError, loadTokenMetadata } from "@/lib/baskets/baskets";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();
type AssetDraft = { address: string; amount: string };
type TierDraft = { threshold: string; feeShares: string };

function equalBigints(left: readonly bigint[], right: readonly bigint[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function parseBasketCreationBps(value: string): number | null {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return null;
  const bps = Math.round(Number(value) * 100);
  return Number.isSafeInteger(bps) && bps >= 0 && bps <= 10_000 ? bps : null;
}

export function parseBasketCreationTiers(tiers: readonly TierDraft[]): readonly FeeTier[] | null {
  try {
    const parsed = tiers.map((tier) => ({
      minActionShares: parseUnits(tier.threshold || "0", 18),
      feeShares: parseUnits(tier.feeShares || "0", 18),
    }));
    return parsed.some(
      (tier, index) => index > 0 && tier.minActionShares <= parsed[index - 1]!.minActionShares
    )
      ? null
      : parsed;
  } catch {
    return null;
  }
}

export function BasketCreatePage() {
  const wallet = useWalletState();
  if (dappPreviewEnabled) {
    return <BasketCreatePreview />;
  }
  if (wallet.status === "unconfigured") return <BasketCreatePreview />;
  return <BasketCreateRuntime />;
}

function BasketCreateRuntime() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [assets, setAssets] = useState<readonly AssetDraft[]>([
    {
      address:
        deploymentState.status === "configured" ? deploymentState.deployment.contracts.dollar : "",
      amount: "1",
    },
  ]);
  const [mintTiers, setMintTiers] = useState<readonly TierDraft[]>([
    { threshold: "0", feeShares: "0.001" },
  ]);
  const [redemptionTiers, setRedemptionTiers] = useState<readonly TierDraft[]>([
    { threshold: "0", feeShares: "0.001" },
  ]);
  const [fees, setFees] = useState({
    flash: "0.05",
    origination: "1",
    extension: "0.25",
    ltv: "75",
    durationDays: "30",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creationFee = useQuery({
    queryKey: ["basket-creation-fee", deploymentState.status],
    enabled: deploymentState.status === "configured" && Boolean(publicClient),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!publicClient || deploymentState.status !== "configured")
        throw new Error("No deployment.");
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      return publicClient.readContract({
        address: deploymentState.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "creationFee",
      });
    },
  });

  const issues = useMemo(() => {
    const next: string[] = [];
    if (!name.trim() || !symbol.trim()) next.push("Name and symbol are required.");
    if (assets.length < 1 || assets.length > 16) next.push("Use between 1 and 16 constituents.");
    if (assets.some((asset) => !isAddress(asset.address)))
      next.push("Every constituent needs a valid address.");
    const normalized = assets
      .filter((asset) => isAddress(asset.address))
      .map((asset) => asset.address.toLowerCase());
    if (new Set(normalized).size !== normalized.length)
      next.push("Constituent addresses must be unique.");
    if (assets.some((asset) => !asset.amount || Number(asset.amount) <= 0))
      next.push("Bundle amounts must be positive.");
    const bps = [fees.flash, fees.origination, fees.extension, fees.ltv].map(
      parseBasketCreationBps
    );
    if (bps.some((value) => value === null))
      next.push("Percentage values must be between 0% and 100%.");
    if ((bps[3] ?? 0) > 9_500) next.push("Maximum LTV is 95%.");
    if (!/^\d+$/.test(fees.durationDays) || Number(fees.durationDays) <= 0)
      next.push("Loan duration must be positive whole days.");
    if (!parseBasketCreationTiers(mintTiers) || !parseBasketCreationTiers(redemptionTiers))
      next.push("Tier thresholds must be valid and strictly ascending.");
    return next;
  }, [assets, fees, mintTiers, name, redemptionTiers, symbol]);

  const buildParams = async (): Promise<CreateBasketParams> => {
    if (!publicClient || issues.length)
      throw new Error(issues[0] ?? "The basket draft is invalid.");
    const metadata = await Promise.all(
      assets.map(async (asset) => {
        const address = getAddress(asset.address);
        const code = await publicClient.getCode({ address });
        if (!code || code === "0x") throw new Error(`${address} has no contract code.`);
        const token = await loadTokenMetadata(publicClient, address);
        if (!token.metadataAvailable)
          throw new Error(`${address} does not expose ERC-20 metadata.`);
        return { token, amount: parseUnits(asset.amount, token.decimals) };
      })
    );
    const loanDuration = Number(fees.durationDays) * 86_400;
    if (!Number.isSafeInteger(loanDuration) || loanDuration > 0xff_ffff_ffff)
      throw new Error("Loan duration exceeds the protocol limit.");
    return {
      name: name.trim(),
      symbol: symbol.trim(),
      assets: metadata.map((item) => item.token.address),
      bundleAmounts: metadata.map((item) => item.amount),
      mintFeeTiers: parseBasketCreationTiers(mintTiers)!,
      redemptionFeeTiers: parseBasketCreationTiers(redemptionTiers)!,
      flashFeeBps: parseBasketCreationBps(fees.flash)!,
      originationFeeBps: parseBasketCreationBps(fees.origination)!,
      extensionFeeBps: parseBasketCreationBps(fees.extension)!,
      ltvBps: parseBasketCreationBps(fees.ltv)!,
      loanDuration,
    };
  };

  const submit = async () => {
    if (!wallet || !publicClient || !walletClient.data || deploymentState.status !== "configured")
      return;
    setPending(true);
    setError(null);
    try {
      const [params, freshFee, countBefore] = await Promise.all([
        buildParams(),
        publicClient.readContract({
          address: deploymentState.deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "creationFee",
        }),
        publicClient.readContract({
          address: deploymentState.deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "basketCount",
        }),
      ]);
      const transaction = buildCreateBasketTransaction(params, freshFee);
      await executeProtocolTransaction({
        publicClient,
        wallet,
        chainId: deploymentState.deployment.chainId,
        kind: "create-basket",
        label: `Create ${params.symbol} basket`,
        amount: `${formatEther(freshFee)} native creation fee`,
        to: deploymentState.deployment.contracts.diamond,
        data: transaction.data,
        value: transaction.value,
        sendTransaction: ({ to, data, value }) =>
          walletClient.data!.sendTransaction({
            account: wallet,
            chain: walletClient.data!.chain,
            to,
            data,
            value,
          }),
        describeError: describeBasketError,
        validateSimulation: (result) => {
          if (!result) throw new Error("Basket creation simulation returned no result.");
          const [basketId] = decodeFunctionResult({
            abi: staticsAbi,
            functionName: "createBasket",
            data: result,
          });
          if (basketId !== countBefore)
            throw new Error("The simulated basket ID is not the next registry ID.");
        },
        verifyConfirmation: async (receipt) => {
          const created = parseEventLogs({
            abi: staticsAbi,
            eventName: "BasketCreated",
            logs: receipt.logs,
            strict: true,
          }).find(
            (item) => item.args.basketId === countBefore && getAddress(item.args.creator) === wallet
          );
          if (!created)
            throw new Error("The receipt did not contain the reviewed BasketCreated event.");
          const configuredEvent = parseEventLogs({
            abi: staticsAbi,
            eventName: "BasketConfigured",
            logs: receipt.logs,
            strict: true,
          }).find((item) => item.args.basketId === countBefore);
          const tierEvents = parseEventLogs({
            abi: staticsAbi,
            eventName: "BasketFeeTiersConfigured",
            logs: receipt.logs,
            strict: true,
          }).filter((item) => item.args.basketId === countBefore);
          const mintEvent = tierEvents.find((item) => item.args.mintAction);
          const redemptionEvent = tierEvents.find((item) => !item.args.mintAction);
          if (
            !configuredEvent ||
            configuredEvent.args.assets.map((asset) => getAddress(asset)).join() !==
              params.assets.join() ||
            !equalBigints(configuredEvent.args.bundleAmounts, params.bundleAmounts) ||
            configuredEvent.args.flashFeeBps !== params.flashFeeBps ||
            configuredEvent.args.originationFeeBps !== params.originationFeeBps ||
            configuredEvent.args.extensionFeeBps !== params.extensionFeeBps ||
            configuredEvent.args.ltvBps !== params.ltvBps ||
            configuredEvent.args.loanDuration !== params.loanDuration ||
            !mintEvent ||
            !equalBigints(
              mintEvent.args.minActionShares,
              params.mintFeeTiers.map((tier) => tier.minActionShares)
            ) ||
            !equalBigints(
              mintEvent.args.feeShares,
              params.mintFeeTiers.map((tier) => tier.feeShares)
            ) ||
            !redemptionEvent ||
            !equalBigints(
              redemptionEvent.args.minActionShares,
              params.redemptionFeeTiers.map((tier) => tier.minActionShares)
            ) ||
            !equalBigints(
              redemptionEvent.args.feeShares,
              params.redemptionFeeTiers.map((tier) => tier.feeShares)
            )
          ) {
            throw new Error("The receipt does not match the reviewed basket configuration.");
          }
          const [countAfter, configured] = await Promise.all([
            publicClient.readContract({
              address: deploymentState.deployment.contracts.diamond,
              abi: staticsAbi,
              functionName: "basketCount",
            }),
            publicClient.readContract({
              address: deploymentState.deployment.contracts.diamond,
              abi: staticsAbi,
              functionName: "basket",
              args: [countBefore],
            }),
          ]);
          if (
            countAfter !== countBefore + 1n ||
            getAddress(configured.token) !== getAddress(created.args.token)
          )
            throw new Error("The confirmed basket registry does not match the receipt.");
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["basket-catalog"] });
      router.push(`/app/baskets/${countBefore.toString()}`);
    } catch (cause) {
      setError(describeBasketError(cause));
    } finally {
      setPending(false);
    }
  };

  if (deploymentState.status === "unavailable") return <BasketCreatePreview />;

  let actionLabel = "Create basket";
  let action: (() => void) | null = () => void submit();
  if (walletState.status === "signed-out" || walletState.status === "error") {
    actionLabel = "Sign in to continue";
    action = walletState.login;
  } else if (walletState.status === "wallet-missing") {
    actionLabel = "Create embedded wallet";
    action = () => void walletState.createWallet();
  } else if (walletState.status === "ready" && !walletState.isTargetChain) {
    actionLabel = `Switch to ${walletState.networkName}`;
    action = () => void walletState.switchNetwork();
  } else if (walletState.status !== "ready") {
    actionLabel = "Wallet loading…";
    action = null;
  }

  const setAsset = (index: number, update: Partial<AssetDraft>) =>
    setAssets((current) =>
      current.map((asset, item) => (item === index ? { ...asset, ...update } : asset))
    );
  const tierEditor = (
    label: string,
    tiers: readonly TierDraft[],
    setter: React.Dispatch<React.SetStateAction<readonly TierDraft[]>>
  ) => (
    <article>
      <strong>{label}</strong>
      {tiers.map((tier, index) => (
        <p key={index}>
          <input
            aria-label={`${label} threshold ${index + 1}`}
            value={tier.threshold}
            onChange={(event) =>
              setter((current) =>
                current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, threshold: event.target.value } : item
                )
              )
            }
          />
          <input
            aria-label={`${label} fee ${index + 1}`}
            value={tier.feeShares}
            onChange={(event) =>
              setter((current) =>
                current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, feeShares: event.target.value } : item
                )
              )
            }
          />
          <button
            type="button"
            aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            onClick={() =>
              setter((current) => current.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            Remove
          </button>
        </p>
      ))}
      <button
        type="button"
        onClick={() => setter((current) => [...current, { threshold: "", feeShares: "" }])}
      >
        Add tier
      </button>
    </article>
  );

  return (
    <>
      <section className="remaining-hero">
        <div>
          <p className="dapp-section-label">Permissionless configuration</p>
          <h2>Create a static basket</h2>
          <p>Define the bundle and economics, then pay the exact current creation fee.</p>
        </div>
        <span className={`remaining-status is-${issues.length ? "warmup" : "active"}`}>
          {issues.length ? `${issues.length} review issues` : "Valid draft"}
        </span>
      </section>
      <ol className="creation-steps" aria-label="Basket creation progress">
        {(
          [
            [1, "Definition"],
            [2, "Economics"],
            [3, "Review"],
          ] as const
        ).map(([number, label]) => (
          <li key={number} className={step === number ? "is-current" : undefined}>
            <button type="button" onClick={() => setStep(number)}>
              <span>0{number}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <section className="creation-workspace">
        {step === 1 && (
          <>
            <div className="remaining-form-grid">
              <label className="basket-field">
                <span>Basket name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="basket-field">
                <span>Symbol</span>
                <input value={symbol} onChange={(event) => setSymbol(event.target.value)} />
              </label>
            </div>
            <div className="creation-assets">
              <div className="remaining-section-heading">
                <h3>Constituents · {assets.length}/16</h3>
                <button
                  type="button"
                  disabled={assets.length >= 16}
                  onClick={() => setAssets((current) => [...current, { address: "", amount: "" }])}
                >
                  Add constituent
                </button>
              </div>
              {assets.map((asset, index) => (
                <article key={index}>
                  <span>0{index + 1}</span>
                  <label>
                    Token address
                    <input
                      value={asset.address}
                      onChange={(event) => setAsset(index, { address: event.target.value })}
                    />
                  </label>
                  <label>
                    Bundle amount
                    <input
                      value={asset.amount}
                      inputMode="decimal"
                      onChange={(event) => setAsset(index, { amount: event.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={assets.length === 1}
                    onClick={() =>
                      setAssets((current) => current.filter((_, item) => item !== index))
                    }
                  >
                    Remove
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <div className="creation-economics">
            <section>
              <h3>Borrowing and flash policy</h3>
              <div className="remaining-form-grid">
                {(
                  [
                    ["Flash fee %", "flash"],
                    ["Origination fee %", "origination"],
                    ["Extension fee %", "extension"],
                    ["Maximum LTV %", "ltv"],
                    ["Loan duration days", "durationDays"],
                  ] as const
                ).map(([label, key]) => (
                  <label className="basket-field" key={key}>
                    <span>{label}</span>
                    <input
                      value={fees[key]}
                      inputMode="decimal"
                      onChange={(event) =>
                        setFees((current) => ({ ...current, [key]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
            <section>
              <h3>Mint and redemption fee shares</h3>
              <div className="creation-tier-grid">
                {tierEditor("Mint tiers", mintTiers, setMintTiers)}
                {tierEditor("Redemption tiers", redemptionTiers, setRedemptionTiers)}
              </div>
            </section>
          </div>
        )}
        {step === 3 && (
          <div className="creation-review">
            <section>
              <h3>{issues.length ? "Review issues" : "Configuration passes local review"}</h3>
              <ul>
                {issues.length ? (
                  issues.map((issue) => <li key={issue}>{issue}</li>)
                ) : (
                  <>
                    <li>{assets.length} unique ERC-20 constituents</li>
                    <li>Bounded fees, LTV, and duration</li>
                    <li>Ascending mint and redemption tiers</li>
                  </>
                )}
              </ul>
            </section>
            <section>
              <p className="dapp-section-label">Exact current payment</p>
              <h3>
                {creationFee.data === undefined
                  ? "Loading…"
                  : `${formatEther(creationFee.data)} native`}
              </h3>
              <p>
                Read again before simulation. Basket creation does not initialize canonical pools.
              </p>
            </section>
          </div>
        )}
        {error && (
          <p className="dapp-inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="creation-footer">
          <button
            type="button"
            disabled={pending || step === 1}
            onClick={() => setStep((step - 1) as 1 | 2)}
          >
            Previous
          </button>
          {step < 3 ? (
            <button
              type="button"
              className="creation-next"
              onClick={() => setStep((step + 1) as 2 | 3)}
            >
              Continue to {step === 1 ? "economics" : "review"} →
            </button>
          ) : (
            <button
              type="button"
              className="dollar-submit"
              disabled={
                pending ||
                action === null ||
                (walletState.status === "ready" && walletState.isTargetChain && issues.length > 0)
              }
              onClick={action ?? undefined}
            >
              {pending ? "Creating basket…" : actionLabel}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
