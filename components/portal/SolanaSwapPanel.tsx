"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";

import { useSolanaTokens } from "@/hooks/useSolanaTokens";
import { decodeJupiterTransaction, encodeJupiterTransaction } from "@/lib/portal/solana";
import type { SolanaToken } from "@/lib/solana-tokens";
import { useSolanaWalletState } from "@/providers/solana-context";

type JupiterOrder = {
  inAmount?: string;
  outAmount?: string;
  otherAmountThreshold?: string;
  priceImpactPct?: string;
  transaction?: string;
  requestId?: string;
  lastValidBlockHeight?: string | number;
  detail?: string;
  error?: string;
};

async function json(response: Response): Promise<JupiterOrder> {
  const text = await response.text();
  try {
    return JSON.parse(text) as JupiterOrder;
  } catch {
    return { error: text.slice(0, 500) };
  }
}

export function SolanaSwapPanel() {
  const runtime = useSolanaWalletState();
  const managedTokens = useSolanaTokens();
  const tokens = managedTokens.tokens;
  const wallet = runtime.wallets[0];
  const [source, setSource] = useState<SolanaToken>(tokens[0]!);
  const [destination, setDestination] = useState<SolanaToken>(tokens[1]!);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<JupiterOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let rawAmount = 0n;
  try {
    rawAmount = amount ? parseUnits(amount, source.decimals) : 0n;
  } catch {
    rawAmount = 0n;
  }

  const request = async (build: boolean) => {
    const response = await fetch(build ? "/api/jupiter/swap" : "/api/jupiter/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inputMint: source.mint,
        outputMint: destination.mint,
        amount: rawAmount.toString(),
        slippageBps: 50,
        ...(build && wallet ? { taker: wallet.address } : {}),
      }),
    });
    const payload = await json(response);
    if (!response.ok) throw new Error(payload.detail ?? payload.error ?? "No Jupiter route.");
    return payload;
  };

  useEffect(() => {
    if (rawAmount <= 0n) {
      setQuote(null);
      return;
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void request(false)
        .then((result) => {
          if (active) setQuote(result);
        })
        .catch((cause) => {
          if (active) setError(cause instanceof Error ? cause.message : "No Jupiter route.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
    // request is reconstructed from the listed quote inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawAmount, source.mint, destination.mint]);

  const confirm = async () => {
    if (!wallet || !quote || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const built = await request(true);
      if (!built.transaction || !built.requestId) {
        throw new Error("Jupiter did not return a signable transaction.");
      }
      const { signedTransaction } = await runtime.signTransaction({
        wallet,
        chain: "solana:mainnet",
        transaction: decodeJupiterTransaction(built.transaction),
      });
      const response = await fetch("/api/jupiter/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signedTransaction: encodeJupiterTransaction(signedTransaction),
          requestId: built.requestId,
          ...(built.lastValidBlockHeight
            ? { lastValidBlockHeight: String(built.lastValidBlockHeight) }
            : {}),
        }),
      });
      const result = (await json(response)) as JupiterOrder & {
        status?: string;
        signature?: string;
        code?: number;
      };
      if (!response.ok || (result.code !== undefined && result.code !== 0) || !result.signature) {
        throw new Error(result.detail ?? result.error ?? "Jupiter execution failed.");
      }
      setAmount("");
      setQuote(null);
      setReviewing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Jupiter swap failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const output = quote?.outAmount ? formatUnits(BigInt(quote.outAmount), destination.decimals) : "";
  const minimum = quote?.otherAmountThreshold
    ? `${formatUnits(BigInt(quote.otherAmountThreshold), destination.decimals)} ${destination.symbol}`
    : "--";

  return (
    <div className="portal-panel" role="tabpanel">
      <div className="portal-destination">
        <span>Network</span>
        <strong>Solana</strong>
        <small>{wallet ? `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}` : "--"}</small>
      </div>
      <SolanaField
        label="You pay"
        amount={amount}
        tokens={tokens}
        token={source}
        onAmount={setAmount}
        onToken={(next) => {
          setSource(next);
          if (next.mint === destination.mint) {
            setDestination(tokens.find((token) => token.mint !== next.mint) ?? destination);
          }
        }}
      />
      <button
        className="portal-switch-assets"
        type="button"
        onClick={() => {
          setSource(destination);
          setDestination(source);
          setReviewing(false);
        }}
      >
        ⇅
      </button>
      <SolanaField
        label="You receive"
        amount={output}
        tokens={tokens}
        token={destination}
        excludedMint={source.mint}
        readOnly
        onToken={setDestination}
      />
      <dl className="portal-quote-grid">
        <div>
          <dt>Minimum received</dt>
          <dd>{minimum}</dd>
        </div>
        <div>
          <dt>Price impact</dt>
          <dd>{quote?.priceImpactPct ? `${quote.priceImpactPct}%` : "--"}</dd>
        </div>
        <div>
          <dt>Network cost</dt>
          <dd>--</dd>
        </div>
      </dl>
      {error && (
        <p className="portal-error" role="alert">
          {error}
        </p>
      )}
      {!wallet ? (
        <button
          className="portal-primary-action"
          type="button"
          disabled={!runtime.configured || !runtime.ready}
          onClick={() => void runtime.createWallet()}
        >
          Create Solana wallet
        </button>
      ) : reviewing ? (
        <button
          className="portal-primary-action"
          type="button"
          disabled={submitting}
          onClick={() => void confirm()}
        >
          {submitting ? "Submitting…" : "Confirm swap"}
        </button>
      ) : (
        <button
          className="portal-primary-action"
          type="button"
          disabled={loading || !quote?.outAmount}
          onClick={() => setReviewing(true)}
        >
          {loading ? "Finding route…" : "Review swap"}
        </button>
      )}
    </div>
  );
}

function SolanaField({
  label,
  amount,
  tokens,
  token,
  excludedMint,
  readOnly = false,
  onAmount,
  onToken,
}: {
  label: string;
  amount: string;
  tokens: readonly SolanaToken[];
  token: SolanaToken;
  excludedMint?: string;
  readOnly?: boolean;
  onAmount?: (value: string) => void;
  onToken?: (token: SolanaToken) => void;
}) {
  return (
    <label className="portal-field portal-asset-field">
      <span>{label}</span>
      <div>
        <input
          inputMode="decimal"
          value={amount}
          readOnly={readOnly}
          placeholder="0.00"
          onChange={(event) => onAmount?.(event.target.value)}
        />
        <select
          aria-label={`${label} asset`}
          value={token.mint}
          onChange={(event) => {
            const selected = tokens.find((candidate) => candidate.mint === event.target.value);
            if (selected) onToken?.(selected);
          }}
        >
          {tokens
            .filter((candidate) => candidate.mint !== excludedMint)
            .map((candidate) => (
              <option key={candidate.mint} value={candidate.mint}>
                {candidate.symbol}
              </option>
            ))}
        </select>
      </div>
      <small>--</small>
    </label>
  );
}
