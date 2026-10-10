"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { encodeFunctionData, formatEther, parseEventLogs } from "viem";
import { staticsAbi, staticsSwapFeeHookAbi } from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment, SupportedPublicPool } from "@/lib/deployments/types";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { loadDexTokens, quoteValue } from "@/lib/indexer/dex-market";
import { dexRoot } from "@/hooks/useDexOverview";
import { isReviewedToken } from "@/lib/phase-one/pool-discovery";
import { publicLiquidityDeadline } from "@/lib/phase-one/liquidity";
import {
  candidatePoolId,
  candidatePoolKey,
  pipsToPercent,
  startingSqrtPrice,
} from "@/lib/phase-one/pool-creation";
import type { CreatePoolDraft } from "./NewPositionPair";
import styles from "./pool-creation.module.css";

/**
 * Step 2 for a pool that does not exist: set its starting price and create it. Creation is its
 * own reviewed transaction; once it confirms, the caller continues into range and deposit.
 */
export function CreatePoolStep({
  deployment,
  draft,
  onCreated,
  onBack,
}: {
  deployment: PhaseOneDeployment;
  draft: CreatePoolDraft;
  onCreated: (pool: SupportedPublicPool) => void;
  onBack: () => void;
}) {
  const t = useTranslations("createPool");
  const ux = useTranslations("liquidityUx");
  const action = usePhaseOneAction(
    deployment,
    `create:${draft.tokenA.address}:${draft.tokenB.address}`
  );
  const [inverted, setInverted] = useState(false);
  const [price, setPrice] = useState<string | null>(null);
  const [activatePol, setActivatePol] = useState(false);
  const { tokenA, tokenB, tier, staticsFee } = draft;
  const diamond = deployment.contracts.diamond;
  const hook = deployment.contracts.publicHook;
  const poolId = candidatePoolId(tokenA.address, tokenB.address, tier, hook);
  const key = candidatePoolKey(tokenA.address, tokenB.address, tier, hook);
  const unreviewed = [tokenA, tokenB].filter((token) => !isReviewedToken(token));

  const chain = useQuery({
    queryKey: ["phase-one-pool", deployment.descriptor.deploymentId, poolId, "creation"],
    enabled: Boolean(action.publicClient),
    retry: false,
    queryFn: async () => {
      const client = action.publicClient!;
      const [creationFee, polFee, registration] = await Promise.all([
        client.readContract({ address: diamond, abi: staticsAbi, functionName: "poolCreationFee" }),
        client.readContract({
          address: diamond,
          abi: staticsAbi,
          functionName: "protocolPolActivationFee",
        }),
        client.readContract({
          address: hook,
          abi: staticsSwapFeeHookAbi,
          functionName: "poolRegistration",
          args: [poolId],
        }),
      ]);
      return { creationFee, polFee, exists: registration.registered };
    },
  });
  // Suggest a starting price from indexed USDG prices when both tokens have one.
  const market = useQuery({
    queryKey: [dexRoot, deployment.descriptor.deploymentId, "tokens", "usdg"],
    staleTime: 30_000,
    retry: false,
    queryFn: () => loadDexTokens(deployment.descriptor.deploymentId, "usdg"),
  });
  const usd = (token: typeof tokenA) => {
    const entry = market.data?.items.find(
      (item) => item.token.address.toLowerCase() === token.address.toLowerCase()
    );
    return entry && market.data?.quote.decimals != null
      ? quoteValue(entry, 10n ** BigInt(token.decimals), token.decimals, market.data.quote.decimals)
      : null;
  };
  const [base, quote] = inverted ? [tokenB, tokenA] : [tokenA, tokenB];
  const suggested = (() => {
    const a = usd(base),
      b = usd(quote);
    return a && b
      ? new Intl.NumberFormat("en-US", { useGrouping: false, maximumSignificantDigits: 8 }).format(
          a / b
        )
      : null;
  })();
  const priceText = price ?? suggested ?? "";
  // The contract takes B per A; the viewer may enter either direction.
  const sqrtPrice = (() => {
    const entered = startingSqrtPrice(priceText, base.decimals, quote.decimals);
    // Entered as "1 B = x A", this is sqrt(A per B); the reciprocal in Q64.96 is sqrt(B per A).
    const result = entered && inverted ? (1n << 192n) / entered : entered;
    return result && result < 1n << 160n ? result : null;
  })();
  const totalFee = chain.data
    ? chain.data.creationFee + (activatePol ? chain.data.polFee : 0n)
    : null;
  const closed = chain.data?.creationFee === 0n;

  const create = () =>
    action.prepare(async () => {
      if (!action.publicClient || !action.wallet) throw new Error(t("connect"));
      if (!sqrtPrice) throw new Error(t("problem.price"));
      const deadline = await publicLiquidityDeadline(action.publicClient);
      const params = {
        tokenA: tokenA.address,
        tokenB: tokenB.address,
        lpFee: tier.lpFee,
        tickSpacing: tier.tickSpacing,
        sqrtPriceBPerAX96: sqrtPrice,
        initialFeeRate: {
          inputFeePips: staticsFee.inputPips,
          outputFeePips: staticsFee.outputPips,
        },
        creator: action.wallet,
        activateManagedPol: activatePol,
        nonce: 0n,
        deadline,
      } as const;
      // quotePool validates the pair, fees and price; the complete transaction is simulated before signing.
      const [quoted, registration] = await Promise.all([
        action.publicClient.readContract({
          address: diamond,
          abi: staticsAbi,
          functionName: "quotePool",
          args: [params],
        }),
        action.publicClient.readContract({
          address: hook,
          abi: staticsSwapFeeHookAbi,
          functionName: "poolRegistration",
          args: [poolId],
        }),
      ]);
      if (registration.registered) throw new Error(t("alreadyExists"));
      if (quoted.poolId.toLowerCase() !== poolId.toLowerCase()) throw new Error(t("quoteMismatch"));
      if (quoted.creationFee === 0n) throw new Error(t("closed"));
      const fee = quoted.totalNativeFee;
      return {
        label: t("createLabel", { pair: `${tokenA.symbol}/${tokenB.symbol}` }),
        details: [
          t("review.pool", { id: `${poolId.slice(0, 10)}…${poolId.slice(-6)}` }),
          t("review.fees", {
            lp: pipsToPercent(tier.lpFee),
            input: pipsToPercent(staticsFee.inputPips),
            output: pipsToPercent(staticsFee.outputPips),
          }),
          t("review.price", { base: base.symbol, price: priceText, quote: quote.symbol }),
          t("review.creationFee", { amount: formatEther(quoted.creationFee) }),
          ...(activatePol
            ? [t("review.polFee", { amount: formatEther(quoted.polActivationFee) })]
            : []),
          t("review.unreviewed"),
        ],
        execute: async () => {
          await action.send({
            kind: "phase-one-create-pool",
            label: t("createLabel", { pair: `${tokenA.symbol}/${tokenB.symbol}` }),
            amount: `${formatEther(fee)} ETH`,
            to: diamond,
            data: encodeFunctionData({
              abi: staticsAbi,
              functionName: "createPool",
              args: [
                { ...params, deadline: await publicLiquidityDeadline(action.publicClient!) },
                "0x",
              ],
            }),
            value: fee,
            verifyConfirmation: async (receipt) => {
              const created = parseEventLogs({
                abi: staticsAbi,
                logs: receipt.logs,
                eventName: "ProtocolPoolCreated",
              }).find(
                (entry) =>
                  entry.address.toLowerCase() === diamond.toLowerCase() &&
                  entry.args.poolId.toLowerCase() === poolId.toLowerCase()
              );
              if (!created) throw new Error(t("notConfirmed"));
              const [token0, token1] =
                key.currency0.toLowerCase() === tokenA.address.toLowerCase()
                  ? [tokenA, tokenB]
                  : [tokenB, tokenA];
              onCreated({
                poolId,
                poolKey: key,
                token0,
                token1,
                enabled: true,
                provenance: {
                  deploymentId: deployment.descriptor.deploymentId,
                  protocolCommit: "created-in-app",
                  registrationBlock: receipt.blockNumber,
                },
              });
            },
          });
        },
      };
    });

  return (
    <section className={`ui-card ${styles.step}`} aria-labelledby="create-pool-title">
      <div className={styles.heading}>
        <h3 id="create-pool-title">{t("creatingTitle")}</h3>
        <p className="liquidity-muted">
          {t("creatingHelp", {
            pair: `${tokenA.symbol} / ${tokenB.symbol}`,
            fee: pipsToPercent(tier.lpFee),
          })}
        </p>
      </div>
      <dl className={styles.summary}>
        <div>
          <dt>{t("feeTier")}</dt>
          <dd>{ux("feeTier", { fee: pipsToPercent(tier.lpFee) })}</dd>
        </div>
        <div>
          <dt>{t("staticsFee")}</dt>
          <dd>
            {t("staticsFeeValue", {
              input: pipsToPercent(staticsFee.inputPips),
              output: pipsToPercent(staticsFee.outputPips),
            })}
          </dd>
        </div>
        <div>
          <dt>{t("tickSpacing")}</dt>
          <dd>{tier.tickSpacing}</dd>
        </div>
      </dl>

      {chain.data?.exists ? (
        <p role="alert">{t("alreadyExists")}</p>
      ) : closed ? (
        <p role="note" className={styles.closed}>
          {t("closed")}
        </p>
      ) : (
        <>
          <div className={styles.priceField}>
            <label htmlFor="starting-price">{t("startingPrice")}</label>
            <div>
              <span>1 {base.symbol} =</span>
              <input
                id="starting-price"
                inputMode="decimal"
                placeholder="0"
                value={priceText}
                disabled={action.busy}
                onChange={(event) => {
                  action.cancel();
                  setPrice(event.target.value);
                }}
              />
              <span>{quote.symbol}</span>
              <button
                type="button"
                className="ui-button"
                aria-label={t("flip")}
                disabled={action.busy}
                onClick={() => {
                  action.cancel();
                  setPrice(null);
                  setInverted(!inverted);
                }}
              >
                ⇄
              </button>
            </div>
            <span className="liquidity-muted">
              {suggested && price === null ? t("suggestedPrice") : t("priceHelp")}
            </span>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={activatePol}
              disabled={action.busy}
              onChange={(event) => {
                action.cancel();
                setActivatePol(event.target.checked);
              }}
            />
            <span>
              {t("activatePol")}
              <small>
                {chain.data
                  ? t("activatePolHelp", { amount: formatEther(chain.data.polFee) })
                  : t("loading")}
              </small>
            </span>
          </label>
          {unreviewed.length > 0 && (
            <div className="portal-unreviewed" role="note">
              <strong>{ux("unreviewedTitle")}</strong>
              <p>
                {ux("unreviewedHelp", {
                  tokens: unreviewed
                    .map((token) => `${token.symbol} (${token.address})`)
                    .join(", "),
                })}
              </p>
            </div>
          )}
          <p className="liquidity-muted">{t("afterCreate")}</p>
          <div className={styles.actions}>
            <button className="ui-button" type="button" disabled={action.busy} onClick={onBack}>
              {t("back")}
            </button>
            <button
              className="ui-button ui-button--primary"
              type="button"
              disabled={!action.ready || action.busy || !sqrtPrice || !chain.data}
              onClick={() => void create()}
            >
              {totalFee === null
                ? t("createPool")
                : t("createPoolFee", { amount: formatEther(totalFee) })}
            </button>
          </div>
        </>
      )}
      {chain.isError && <p role="alert">{chain.error.message}</p>}
      <ActionReview action={action} />
    </section>
  );
}
