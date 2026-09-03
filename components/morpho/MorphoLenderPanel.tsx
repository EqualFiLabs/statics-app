"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { encodeFunctionData, formatUnits, getAddress } from "viem";
import { usePublicClient } from "wagmi";

import {
  basketTokenAbi,
  buildMorphoSupplyCall,
  buildMorphoWithdrawCall,
} from "@statics-protocol/sdk";

import { useProtocolSurface } from "@/components/protocol/ProtocolAvailability";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import { loadMorphoLender } from "@/lib/morpho/morpho";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

function display(value: bigint, precision = 4): string {
  const [whole, fraction = ""] = formatUnits(value, 18).split(".");
  const short = fraction.slice(0, precision).replace(/0+$/, "");
  return short ? `${whole}.${short}` : whole;
}

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return "The wallet request was rejected.";
  return message || "The Morpho lender action failed.";
}

export function MorphoLenderPanel() {
  const locale = useAppLocale();
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const protocol = useProtocolSurface();
  const deployment = protocol.deployment;
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const markets = deployment.morpho?.markets ?? [];
  const [marketId, setMarketId] = useState<string>(markets[0]?.marketId ?? "");
  const [mode, setMode] = useState<"supply" | "withdraw">("supply");
  const [amountInput, setAmountInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = markets.find((market) => market.marketId === marketId) ?? markets[0];

  const snapshot = useQuery({
    queryKey: ["morpho-lender", deployment.deploymentId, wallet, selected?.marketId],
    enabled: Boolean(publicClient && wallet && selected && walletState.isTargetChain),
    queryFn: async () => {
      if (!publicClient || !wallet || !selected || !deployment.morpho) {
        throw new Error("Morpho lender market unavailable.");
      }
      const [lender, balance, allowance] = await Promise.all([
        loadMorphoLender(publicClient, deployment, selected, wallet),
        publicClient.readContract({
          address: deployment.contracts.dollar,
          abi: basketTokenAbi,
          functionName: "balanceOf",
          args: [wallet],
        }),
        publicClient.readContract({
          address: deployment.contracts.dollar,
          abi: basketTokenAbi,
          functionName: "allowance",
          args: [wallet, deployment.morpho.address],
        }),
      ]);
      return { ...lender, balance, allowance };
    },
  });

  let amount = 0n;
  try {
    amount = parseLocalizedUnits(amountInput, 18, locale);
  } catch {
    amount = 0n;
  }
  const maximum =
    mode === "supply" ? (snapshot.data?.balance ?? 0n) : (snapshot.data?.suppliedAssets ?? 0n);

  const send = async (
    kind: Parameters<typeof executeProtocolTransaction>[0]["kind"],
    label: string,
    to: `0x${string}`,
    data: `0x${string}`,
    reviewedAmount: string
  ) => {
    if (!wallet || !publicClient) return;
    await executeProtocolTransaction({
      publicClient,
      wallet,
      chainId: deployment.chainId,
      deploymentId: deployment.deploymentId,
      kind,
      label,
      amount: reviewedAmount,
      to,
      data,
      sendTransaction: walletState.sendEvmTransaction,
      describeError: describe,
    });
  };

  const submit = async () => {
    if (
      !wallet ||
      !publicClient ||
      !selected ||
      !snapshot.data ||
      !deployment.morpho ||
      amount <= 0n
    )
      return;
    if (!walletState.isTargetChain) {
      await walletState.switchNetwork();
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (mode === "supply") {
        if (snapshot.data.allowance < amount) {
          await send(
            "approve-dollar",
            "Approve USDstx for Morpho",
            deployment.contracts.dollar,
            encodeFunctionData({
              abi: basketTokenAbi,
              functionName: "approve",
              args: [deployment.morpho.address, amount],
            }),
            `${display(amount)} USDstx`
          );
          await snapshot.refetch();
          return;
        }
        await send(
          "supply-morpho",
          "Supply USDstx to Morpho",
          deployment.morpho.address,
          buildMorphoSupplyCall(snapshot.data.market.params, amount, 0n, wallet),
          `${display(amount)} USDstx`
        );
      } else {
        await send(
          "withdraw-morpho",
          "Withdraw USDstx from Morpho",
          deployment.morpho.address,
          buildMorphoWithdrawCall(snapshot.data.market.params, amount, 0n, wallet, wallet),
          `${display(amount)} USDstx`
        );
      }
      setAmountInput("");
      await snapshot.refetch();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setPending(false);
    }
  };

  if (!deployment.morpho || !markets.length) return null;
  return (
    <section className="ui-card morpho-lender" aria-labelledby="morpho-lender-title">
      <div className="remaining-section-heading">
        <div>
          <p className="dapp-section-label">Morpho Blue lender</p>
          <h3 id="morpho-lender-title">Earn the market lending rate on USDstx</h3>
          <p>
            Supply directly to an isolated Morpho market. This balance is separate from Position
            collateral and Statics rewards.
          </p>
        </div>
      </div>
      <div className="dollar-tabs" aria-label="Lender action">
        {(["supply", "withdraw"] as const).map((action) => (
          <button
            key={action}
            type="button"
            className={mode === action ? "active" : undefined}
            onClick={() => setMode(action)}
            disabled={pending}
          >
            {action === "supply" ? "Supply" : "Withdraw"}
          </button>
        ))}
      </div>
      <label className="dollar-field">
        <span>Market</span>
        <select
          value={selected?.marketId ?? ""}
          onChange={(event) => setMarketId(event.target.value)}
          disabled={pending}
        >
          {markets.map((market) => (
            <option key={market.marketId} value={market.marketId}>
              {market.kind === "statics" ? "Staked STATICS / USDstx" : "TPA1 / USDstx"}
            </option>
          ))}
        </select>
      </label>
      {snapshot.data && (
        <dl className="genesis-figures">
          <div>
            <dt>Your supplied balance</dt>
            <dd>{display(snapshot.data.suppliedAssets)} USDstx</dd>
          </div>
          <div>
            <dt>Wallet balance</dt>
            <dd>{display(snapshot.data.balance)} USDstx</dd>
          </div>
          <div>
            <dt>Total market supply</dt>
            <dd>{display(snapshot.data.market.market.totalSupplyAssets)} USDstx</dd>
          </div>
          <div>
            <dt>Available liquidity</dt>
            <dd>{display(snapshot.data.market.availableLiquidity)} USDstx</dd>
          </div>
        </dl>
      )}
      <label className="dollar-field">
        <span>{mode === "supply" ? "Supply amount" : "Withdraw amount"}</span>
        <input
          inputMode="decimal"
          value={amountInput}
          onChange={(event) => setAmountInput(event.target.value)}
          placeholder="0.0"
          disabled={pending}
        />
        <small>Available: {display(maximum)} USDstx</small>
      </label>
      {snapshot.isError && (
        <p className="dapp-inline-error" role="alert">
          {describe(snapshot.error)}
        </p>
      )}
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="dollar-submit"
        type="button"
        disabled={pending || !snapshot.data || amount <= 0n || amount > maximum}
        onClick={() => void submit()}
      >
        {pending
          ? mode === "supply" && (snapshot.data?.allowance ?? 0n) < amount
            ? "Approving…"
            : "Waiting for confirmation…"
          : mode === "supply"
            ? (snapshot.data?.allowance ?? 0n) < amount
              ? "Approve USDstx"
              : "Supply USDstx"
            : "Withdraw USDstx"}
      </button>
    </section>
  );
}
