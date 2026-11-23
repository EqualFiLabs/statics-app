"use client";

import { useState } from "react";
import {
  buildBasketConversionZapCall,
  quoteReviewedBasketConversion,
} from "@statics-protocol/sdk/basket-conversion";
import { encodeFunctionData, erc20Abi, formatUnits, getAddress, parseUnits } from "viem";
import { usePublicClient } from "wagmi";

import {
  phaseTwoExitAbi,
  reviewPhaseTwoMarket,
  verifyPhaseTwo,
  verifyPhaseTwoExit,
  type PhaseTwoManifest,
  type PhaseTwoMarket,
} from "@/lib/baskets/phase-two";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useDeployment } from "@/providers/deployment-context";
import { BasketListPage } from "@/components/baskets/BasketListPage";
import { UnconfiguredSurface } from "@/components/common/EmptyState";
import { useWalletState } from "@/providers/wallet-context";

type Quote = Awaited<ReturnType<typeof quoteReviewedBasketConversion>>;

export function PhaseTwoConversion() {
  const { active } = useDeployment();
  const wallet = useWalletState();
  const manifest = active.phaseTwo;
  if (!manifest?.markets.length) return <BasketListPage />;
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject="Basket conversion" />;
  return (
    <section className="basket-catalog" aria-label="Basket conversion">
      <h2>Basket conversion</h2>
      {manifest.markets.map((market) => (
        <ConversionMarket key={market.poolId} manifest={manifest} market={market} />
      ))}
    </section>
  );
}

function ConversionMarket({
  manifest,
  market,
}: {
  manifest: PhaseTwoManifest;
  market: PhaseTwoMarket;
}) {
  const wallet = useWalletState();
  const client = usePublicClient({ chainId: manifest.chainId });
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState<{ payer: string; shares: bigint; quote: Quote } | null>(
    null
  );
  const [exit, setExit] = useState<{
    payer: string;
    shares: bigint;
    impaired: boolean;
    amounts: readonly bigint[];
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const reviewed = reviewPhaseTwoMarket(manifest, market);

  const reset = () => {
    setReview(null);
    setExit(null);
    setMessage("");
  };
  const run = async (action: "quote" | "approve" | "trade" | "review-exit" | "exit") => {
    if (!wallet.address) {
      wallet.connectWallet();
      return;
    }
    if (!wallet.isTargetChain) {
      await wallet.switchNetwork();
      return;
    }
    if (!client || pending) return;
    setPending(true);
    setMessage("");
    try {
      const payer = getAddress(wallet.address);
      const shares = parseUnits(amount, 18);
      if (shares <= 0n) throw new Error("Enter a positive basket amount.");
      const isExit = action === "review-exit" || action === "exit";
      if (!isExit) await verifyPhaseTwo(client, manifest);
      const common = {
        publicClient: client,
        wallet: payer,
        chainId: manifest.chainId,
        amount: `${amount} ${market.symbol}`,
        sendTransaction: wallet.sendEvmTransaction,
        describeError: () => "The transaction could not execute at the reviewed terms.",
      };

      if (action === "quote") {
        reset();
        const quote = await quoteReviewedBasketConversion(
          client,
          manifest.diamond.address,
          manifest.quoter.address,
          reviewed,
          mode,
          shares,
          50n
        );
        if (getAddress(quote.zap) !== getAddress(manifest.zap.address))
          throw new Error("The conversion contract changed.");
        setReview({ payer, shares, quote });
        return;
      }
      if (action === "review-exit" || action === "exit") {
        const blockNumber = await verifyPhaseTwoExit(client, manifest);
        const impaired = (
          await Promise.all(
            market.assets.map((asset) =>
              client.readContract({
                address: manifest.diamond.address,
                abi: phaseTwoExitAbi,
                functionName: "isBasketAssetImpaired",
                args: [reviewed.basketId, asset],
                blockNumber,
              })
            )
          )
        ).some(Boolean);
        if (action === "review-exit") {
          reset();
          const amounts = await client.readContract({
            address: manifest.diamond.address,
            abi: phaseTwoExitAbi,
            functionName: impaired ? "quoteRedeemImpaired" : "quoteRedeem",
            args: [reviewed.basketId, shares],
            blockNumber,
          });
          setExit({ payer, shares, impaired, amounts });
          return;
        }
        if (!exit || exit.payer !== payer || exit.shares !== shares || exit.impaired !== impaired) {
          setExit(null);
          throw new Error("Review the current redemption again.");
        }
        await executeProtocolTransaction({
          ...common,
          kind: "redeem-basket",
          label: impaired ? "Redeem healthy assets" : "Redeem constituents",
          to: manifest.diamond.address,
          data: encodeFunctionData({
            abi: phaseTwoExitAbi,
            functionName: impaired ? "redeemImpaired" : "redeem",
            args: [reviewed.basketId, shares, payer, exit.amounts],
          }),
        });
        reset();
        setMessage("Redemption confirmed.");
        return;
      }

      if (!review || review.payer !== payer || review.shares !== shares) {
        setReview(null);
        throw new Error("Review a new quote for this wallet and amount.");
      }
      const { quote } = review;
      const timestamp = (await client.getBlock({ blockTag: "latest" })).timestamp;
      if (timestamp >= quote.request.deadline) {
        setReview(null);
        throw new Error("The quote expired. Request a new quote.");
      }
      const input = mode === "buy" ? manifest.quote.address : quote.basketToken;
      const required = mode === "buy" ? quote.request.limit : shares;
      const [balance, allowance] = await Promise.all([
        client.readContract({
          address: input,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [payer],
        }),
        client.readContract({
          address: input,
          abi: erc20Abi,
          functionName: "allowance",
          args: [payer, quote.zap],
        }),
      ]);
      if (balance < required) throw new Error("Your balance is below the reviewed spending limit.");
      if (allowance < required) {
        if (action !== "approve")
          throw new Error("Approve the reviewed spend before submitting the trade.");
        await executeProtocolTransaction({
          ...common,
          kind: mode === "buy" ? "approve-basket-asset" : "approve-basket-token",
          label: "Approve conversion spend",
          to: input,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [quote.zap, required],
          }),
        });
        setMessage("Approval confirmed. Review the quote before submitting.");
        return;
      }
      if (action === "approve") {
        setMessage("Conversion spend is already approved.");
        return;
      }

      await executeProtocolTransaction({
        ...common,
        kind: mode === "buy" ? "mint-basket" : "redeem-basket",
        label: mode === "buy" ? "Buy basket with USDG" : "Sell basket for USDG",
        to: quote.zap,
        data: buildBasketConversionZapCall(mode, market.poolId, shares, payer, quote.request),
        describeError: () =>
          "Conversion failed at the reviewed terms. Request a fresh quote before trying again.",
      }).catch((error: unknown) => {
        setReview(null);
        throw error;
      });
      reset();
      setMessage("Conversion confirmed.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The basket action could not be completed."
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <article className="basket-card">
      <h3>{market.name}</h3>
      <label>
        Action{" "}
        <select
          value={mode}
          disabled={pending}
          onChange={(event) => {
            setMode(event.target.value === "sell" ? "sell" : "buy");
            reset();
          }}
        >
          <option value="buy">Buy with USDG</option>
          <option value="sell">Sell for USDG</option>
        </select>
      </label>
      <label>
        Basket amount ({market.symbol}){" "}
        <input
          value={amount}
          inputMode="decimal"
          disabled={pending}
          onChange={(event) => {
            setAmount(event.target.value);
            reset();
          }}
        />
      </label>
      <div className="basket-section-actions">
        <button type="button" disabled={pending} onClick={() => void run("quote")}>
          {!wallet.address
            ? "Connect wallet"
            : !wallet.isTargetChain
              ? "Switch network"
              : "Get quote"}
        </button>
        <button type="button" disabled={pending} onClick={() => void run("review-exit")}>
          Review constituent redemption
        </button>
      </div>
      {review && (
        <>
          <p>
            Estimated {formatUnits(review.quote.total, 6)} USDG.{" "}
            {mode === "buy" ? "Maximum spend" : "Minimum receipt"}{" "}
            {formatUnits(review.quote.request.limit, 6)} USDG.
          </p>
          <button type="button" disabled={pending} onClick={() => void run("approve")}>
            Approve spend
          </button>
          <button type="button" disabled={pending} onClick={() => void run("trade")}>
            {mode === "buy" ? "Buy basket" : "Sell basket"}
          </button>
        </>
      )}
      {exit && (
        <>
          {exit.impaired && <p>Redeeming permanently forfeits backing in impaired assets.</p>}
          <ul>
            {exit.amounts.map((raw, index) => (
              <li key={market.assets[index]}>
                {market.assets[index]} · {raw.toString()} base units
              </li>
            ))}
          </ul>
          <button type="button" disabled={pending} onClick={() => void run("exit")}>
            {exit.impaired ? "Confirm forfeiture and redeem" : "Redeem constituents"}
          </button>
        </>
      )}
      {pending && <p role="status">Checking transaction…</p>}
      {message && <p role="status">{message}</p>}
    </article>
  );
}
