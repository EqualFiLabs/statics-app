"use client";

import { ReferenceStatus } from "@/components/overview/ReferenceStatus";
import { useReferenceClock, referencesExpired } from "@/hooks/useReferenceClock";
import { defaultMarketQuote } from "@/lib/market/reference-prices";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { erc20Abi, getAddress, isAddress, zeroAddress, type Address, type Hex } from "viem";
import { usePublicClient } from "wagmi";
import { staticsSwapFeeHookAbi } from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment, PublicPoolToken } from "@/lib/deployments/types";
import { loadDexPools } from "@/lib/indexer/dex-market";
import { dexRoot } from "@/hooks/useDexOverview";
import { ReviewDrawer } from "@/components/rewards/ReviewDrawer";
import { isReviewedToken } from "@/lib/phase-one/pool-discovery";
import { getFundingNetwork } from "@/lib/funding-networks";
import {
  FEE_TIERS,
  candidatePoolId,
  percentToPips,
  pipsToPercent,
  tickSpacingForFee,
  validateStaticsFee,
  validateTier,
  type FeeTier,
} from "@/lib/phase-one/pool-creation";
import styles from "./pool-creation.module.css";

export type CreatePoolDraft = Readonly<{
  tokenA: PublicPoolToken;
  tokenB: PublicPoolToken;
  tier: FeeTier;
  staticsFee: Readonly<{ inputPips: number; outputPips: number }>;
}>;

const tierKey = (tier: FeeTier) => `${tier.lpFee}:${tier.tickSpacing}`;
const same = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();

/**
 * Step 1 of a new position: choose a pair and fee tier. Each tier shows the Statics pool that
 * already exists for it, or "Not created", in which case Continue starts creating that pool.
 */
export function NewPositionPair({
  deployment,
  canDeposit,
  initialPoolId,
  onExisting,
  onCreate,
}: {
  deployment: PhaseOneDeployment;
  canDeposit: (poolId: Hex) => boolean;
  initialPoolId: string;
  onExisting: (poolId: Hex) => void;
  onCreate: (draft: CreatePoolDraft) => void;
}) {
  const now = useReferenceClock();
  const currency = defaultMarketQuote(deployment.descriptor.deploymentId);
  const t = useTranslations("createPool");
  const ux = useTranslations("liquidityUx");
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const hook = deployment.contracts.publicHook;

  // The chain's native currency is always offered; address zero is its v4 currency.
  const native = getFundingNetwork(deployment.descriptor.chainId)?.chain.nativeCurrency;
  const tokens = useMemo(() => {
    const seen = new Map<string, PublicPoolToken>();
    if (native)
      seen.set(zeroAddress, {
        address: zeroAddress,
        symbol: native.symbol,
        name: native.name,
        decimals: native.decimals,
        metadataSource: "reviewed-manifest",
      });
    for (const pool of deployment.supportedPools)
      for (const token of [pool.token0, pool.token1]) {
        if (same(token.address, zeroAddress)) continue;
        const known = seen.get(token.address.toLowerCase());
        if (!known || (!isReviewedToken(known) && isReviewedToken(token)))
          seen.set(token.address.toLowerCase(), token);
      }
    return [...seen.values()].sort(
      (a, b) =>
        Number(isReviewedToken(b)) - Number(isReviewedToken(a)) || a.symbol.localeCompare(b.symbol)
    );
  }, [deployment.supportedPools, native]);
  const initial = deployment.supportedPools.find(
    (pool) => pool.poolId.toLowerCase() === initialPoolId.toLowerCase() && canDeposit(pool.poolId)
  );
  const [tokenA, setTokenA] = useState<PublicPoolToken | null>(initial?.token0 ?? null);
  const [tokenB, setTokenB] = useState<PublicPoolToken | null>(initial?.token1 ?? null);
  const [selected, setSelected] = useState(
    initial ? tierKey({ lpFee: initial.poolKey.fee, tickSpacing: initial.poolKey.tickSpacing }) : ""
  );
  const [picking, setPicking] = useState<"A" | "B" | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [customFee, setCustomFee] = useState("");
  const [customSpacing, setCustomSpacing] = useState("");
  const [staticsIn, setStaticsIn] = useState<string | null>(null);
  const [staticsOut, setStaticsOut] = useState<string | null>(null);

  const defaultRate = useQuery({
    queryKey: ["phase-one-pool-fees", deployment.descriptor.deploymentId, "default"],
    enabled: Boolean(publicClient),
    staleTime: 60_000,
    queryFn: async () => {
      const [input, output] = await publicClient!.readContract({
        address: hook,
        abi: staticsSwapFeeHookAbi,
        functionName: "defaultFeeRate",
      });
      return { inputPips: Number(input), outputPips: Number(output) };
    },
  });
  const tvl = useQuery({
    queryKey: [dexRoot, deployment.descriptor.deploymentId, "pools", currency, "creation"],
    staleTime: 15_000,
    refetchInterval: 15_000,
    retry: false,
    queryFn: async () => {
      const page = await loadDexPools(deployment.descriptor.deploymentId, currency, { limit: 100 });
      return {
        quote: page.quote,
        references: page.references,
        byPool: new Map(page.items.map((pool) => [pool.poolId.toLowerCase(), pool.valueLocked])),
      };
    },
  });

  const pair = tokenA && tokenB && !same(tokenA.address, tokenB.address) ? [tokenA, tokenB] : null;
  const existing = (tier: FeeTier) => {
    if (!pair || validateTier(tier)) return null;
    const id = candidatePoolId(pair[0].address, pair[1].address, tier, hook).toLowerCase();
    return deployment.supportedPools.find((pool) => pool.poolId.toLowerCase() === id) ?? null;
  };
  // Existing pools for this pair at tiers outside the defaults are listed too.
  const pairTiers = pair
    ? deployment.supportedPools
        .filter(
          (pool) =>
            same(pool.poolKey.hooks, hook) &&
            [pool.token0.address, pool.token1.address].every((address) =>
              pair.some((token) => same(token.address, address))
            )
        )
        .map((pool) => ({ lpFee: pool.poolKey.fee, tickSpacing: pool.poolKey.tickSpacing }))
    : [];
  const customFeePips = percentToPips(customFee);
  const customTier: FeeTier | null =
    advanced && customFeePips !== null
      ? {
          lpFee: customFeePips,
          tickSpacing: customSpacing.trim()
            ? Number(customSpacing)
            : tickSpacingForFee(customFeePips),
        }
      : null;
  const tiers = [
    ...new Map(
      [...FEE_TIERS, ...pairTiers, ...(customTier ? [customTier] : [])].map((tier) => [
        tierKey(tier),
        tier,
      ])
    ).values(),
  ];
  const tier = tiers.find((candidate) => tierKey(candidate) === selected) ?? null;
  const pool = tier ? existing(tier) : null;
  const inputPips =
    staticsIn === null ? (defaultRate.data?.inputPips ?? null) : percentToPips(staticsIn);
  const outputPips =
    staticsOut === null ? (defaultRate.data?.outputPips ?? null) : percentToPips(staticsOut);

  const problem = (() => {
    if (!tokenA || !tokenB) return t("problem.pair");
    if (same(tokenA.address, tokenB.address)) return t("problem.sameToken");
    if (!tier) return t("problem.tier");
    if (pool) return canDeposit(pool.poolId) ? null : ux("depositsPaused");
    const tierProblem = validateTier(tier);
    if (tierProblem) return t(`problem.${tierProblem}`);
    if (!defaultRate.data || inputPips === null || outputPips === null)
      return t("problem.staticsFee");
    const feeProblem = validateStaticsFee(inputPips, outputPips);
    return feeProblem ? t(`problem.${feeProblem}`) : null;
  })();

  const money = (value: bigint | null | undefined) => {
    if (
      value == null ||
      !tvl.data ||
      tvl.data.quote.decimals === null ||
      (currency === "usd" && referencesExpired(tvl.data.references, now))
    )
      return null;
    const amount = Number(value) / 10 ** tvl.data.quote.decimals;
    return tvl.data.quote.kind === "usd" || tvl.data.quote.kind === "usdg"
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: "USD",
          notation: "compact",
          maximumFractionDigits: 2,
        }).format(amount)
      : `${new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 }).format(amount)} WETH`;
  };

  return (
    <section className={`ui-card ${styles.step}`} aria-labelledby="new-position-pair">
      <div className={styles.heading}>
        <h3 id="new-position-pair">{t("selectPair")}</h3>
        <p className="liquidity-muted">{t("selectPairHelp")}</p>
      </div>
      <div className={styles.pair}>
        {(["A", "B"] as const).map((side) => {
          const token = side === "A" ? tokenA : tokenB;
          return (
            <button
              key={side}
              type="button"
              className={styles.tokenButton}
              data-empty={token ? undefined : true}
              aria-label={token ? t("changeToken", { symbol: token.symbol }) : t("chooseToken")}
              onClick={() => setPicking(side)}
            >
              <span>{token?.symbol ?? t("chooseToken")}</span>
              {token && !isReviewedToken(token) && (
                <span className="liquidity-unreviewed-pill">{ux("unreviewedPool")}</span>
              )}
              <span aria-hidden="true">▾</span>
            </button>
          );
        })}
      </div>
      <p className={styles.hookNote}>
        {defaultRate.data
          ? t("hookNote", {
              input: pipsToPercent(defaultRate.data.inputPips),
              output: pipsToPercent(defaultRate.data.outputPips),
            })
          : t("hookNoteLoading")}
      </p>

      {defaultRate.isError && <p role="alert">{defaultRate.error.message}</p>}
      <div className={styles.heading}>
        <h3>{t("feeTier")}</h3>
        <p className="liquidity-muted">{t("feeTierHelp")}</p>
      </div>
      <div className={styles.tiers} role="radiogroup" aria-label={t("feeTier")}>
        {tiers.map((candidate) => {
          const found = existing(candidate);
          const value = found ? money(tvl.data?.byPool.get(found.poolId.toLowerCase())) : null;
          return (
            <button
              key={tierKey(candidate)}
              type="button"
              role="radio"
              aria-checked={selected === tierKey(candidate)}
              className={styles.tier}
              disabled={!pair}
              onClick={() => setSelected(tierKey(candidate))}
            >
              <strong>{ux("feeTier", { fee: pipsToPercent(candidate.lpFee) })}</strong>
              <small>{t(`tierHelp.${tierHelp(candidate.lpFee)}`)}</small>
              <span data-state={found ? "exists" : "new"}>
                {!pair
                  ? "—"
                  : found
                    ? value
                      ? t("existingWithTvl", { tvl: value })
                      : t("existing")
                    : t("notCreated")}
              </span>
            </button>
          );
        })}
      </div>

      {currency === "usd" && <ReferenceStatus references={tvl.data?.references} />}
      <details
        className={styles.advanced}
        open={advanced}
        onToggle={(event) => setAdvanced((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>{t("advanced")}</summary>
        <div className={styles.advancedGrid}>
          <label>
            {t("customFee")}
            <input
              inputMode="decimal"
              placeholder="0.25"
              value={customFee}
              onChange={(event) => {
                setCustomFee(event.target.value);
                const pips = percentToPips(event.target.value);
                if (pips !== null)
                  setSelected(
                    tierKey({
                      lpFee: pips,
                      tickSpacing: customSpacing.trim()
                        ? Number(customSpacing)
                        : tickSpacingForFee(pips),
                    })
                  );
              }}
            />
          </label>
          <label>
            {t("tickSpacing")}
            <input
              inputMode="numeric"
              placeholder={customFeePips !== null ? String(tickSpacingForFee(customFeePips)) : "60"}
              value={customSpacing}
              onChange={(event) => {
                setCustomSpacing(event.target.value);
                if (customFeePips !== null && /^\d+$/.test(event.target.value))
                  setSelected(
                    tierKey({ lpFee: customFeePips, tickSpacing: Number(event.target.value) })
                  );
              }}
            />
          </label>
          <label>
            {t("staticsInput")}
            <input
              inputMode="decimal"
              value={
                staticsIn ?? (defaultRate.data ? pipsToPercent(defaultRate.data.inputPips) : "")
              }
              onChange={(event) => setStaticsIn(event.target.value)}
            />
          </label>
          <label>
            {t("staticsOutput")}
            <input
              inputMode="decimal"
              value={
                staticsOut ?? (defaultRate.data ? pipsToPercent(defaultRate.data.outputPips) : "")
              }
              onChange={(event) => setStaticsOut(event.target.value)}
            />
          </label>
        </div>
        <p className="liquidity-muted">{t("advancedHelp")}</p>
      </details>

      {pair && tier && !pool && !problem && <p className={styles.newPool}>{t("willCreate")}</p>}
      {problem && pair && tier && (
        <p className="dapp-inline-error" role="alert">
          {problem}
        </p>
      )}
      <button
        className="ui-button ui-button--primary"
        type="button"
        disabled={Boolean(problem)}
        onClick={() => {
          if (problem || !tokenA || !tokenB || !tier) return;
          if (pool) onExisting(pool.poolId);
          else
            onCreate({
              tokenA,
              tokenB,
              tier,
              staticsFee: { inputPips: inputPips!, outputPips: outputPips! },
            });
        }}
      >
        {ux("continue")}
      </button>

      {picking && (
        <TokenPicker
          tokens={tokens}
          exclude={picking === "A" ? tokenB : tokenA}
          chainId={deployment.descriptor.chainId}
          readToken={async (address) => {
            const code = await publicClient?.getCode({ address });
            if (!publicClient || !code || code === "0x") throw new Error(t("notAToken"));
            const [symbol, name, decimals] = await Promise.all([
              publicClient.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
              publicClient.readContract({ address, abi: erc20Abi, functionName: "name" }),
              publicClient.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
            ]);
            return {
              address,
              symbol: symbol.trim().slice(0, 16) || address.slice(0, 6),
              name: name.trim().slice(0, 64) || t("unknownName"),
              decimals: Number(decimals),
              metadataSource: "onchain-import" as const,
            };
          }}
          onClose={() => setPicking(null)}
          onPick={(token) => {
            (picking === "A" ? setTokenA : setTokenB)(token);
            setPicking(null);
          }}
        />
      )}
    </section>
  );
}

function tierHelp(lpFee: number) {
  if (lpFee <= 500) return "stable";
  if (lpFee <= 3_000) return "most";
  return "exotic";
}

function TokenPicker({
  tokens,
  exclude,
  chainId,
  readToken,
  onPick,
  onClose,
}: {
  tokens: readonly PublicPoolToken[];
  exclude: PublicPoolToken | null;
  chainId: number;
  readToken: (address: Address) => Promise<PublicPoolToken>;
  onPick: (token: PublicPoolToken) => void;
  onClose: () => void;
}) {
  const t = useTranslations("createPool");
  const ux = useTranslations("liquidityUx");
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const pasted =
    isAddress(trimmed) &&
    !same(getAddress(trimmed), zeroAddress) &&
    (!exclude || !same(getAddress(trimmed), exclude.address))
      ? getAddress(trimmed)
      : null;
  const listed = tokens.filter(
    (token) =>
      (!exclude || !same(token.address, exclude.address)) &&
      (!trimmed ||
        token.symbol.toLowerCase().includes(trimmed.toLowerCase()) ||
        token.name.toLowerCase().includes(trimmed.toLowerCase()) ||
        (pasted !== null && same(token.address, pasted)))
  );
  const lookup = useQuery({
    queryKey: ["phase-one-token-metadata", chainId, pasted],
    enabled: pasted !== null && !listed.some((token) => same(token.address, pasted)),
    retry: false,
    queryFn: () => readToken(pasted!),
  });
  return (
    <ReviewDrawer title={t("chooseToken")} variant="modal" onClose={onClose}>
      <div className={styles.picker}>
        <label className={styles.search}>
          <span className={styles.srOnly}>{t("searchTokens")}</span>
          <input
            autoFocus
            placeholder={t("searchTokens")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <ul className={styles.tokenList}>
          {listed.map((token) => (
            <li key={token.address}>
              <button type="button" onClick={() => onPick(token)}>
                <strong>{token.symbol}</strong>
                <span>{token.name}</span>
                {!isReviewedToken(token) && (
                  <span className="liquidity-unreviewed-pill">{ux("unreviewedPool")}</span>
                )}
              </button>
            </li>
          ))}
          {lookup.data && (
            <li>
              <button type="button" onClick={() => onPick(lookup.data)}>
                <strong>{lookup.data.symbol}</strong>
                <span>{lookup.data.name}</span>
                <span className="liquidity-unreviewed-pill">{ux("unreviewedPool")}</span>
              </button>
              <p className={styles.unreviewedNote}>{t("pastedWarning")}</p>
            </li>
          )}
        </ul>
        {lookup.isLoading && <p className="liquidity-muted">{t("lookingUp")}</p>}
        {lookup.isError && <p role="alert">{lookup.error.message}</p>}
        {!listed.length && !pasted && <p className="liquidity-muted">{t("noTokens")}</p>}
      </div>
    </ReviewDrawer>
  );
}
