"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { formatEther, isHash, zeroAddress, type Address, type Hex } from "viem";
import type { PhaseOneDeployment, PublicPoolToken } from "@/lib/deployments/types";
import { useDeployment } from "@/providers/deployment-context";
import { usePhaseOnePools } from "@/hooks/usePhaseOnePools";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { IndexedPoolSwapFee } from "@/components/common/IndexedPoolSwapFee";
import { loadIndexedPublicPools } from "@/lib/indexer/phase-one";
import {
  MAX_REWARD_SLOTS,
  STATICS_REWARD_SLOT,
  creatorAbi,
  creatorCalls,
  indexedCreatorPools,
  knownTokens,
  readAllowedRewardTokens,
  readCreatorPool,
  readRevenueWeth,
  resolveTokens,
  type CreatorPool,
  type CreatorPoolState,
} from "@/lib/phase-one/creator";
import { isNativeCurrency } from "@/lib/phase-one/liquidity";
import type { PhaseOnePool } from "@/lib/phase-one/pool-discovery";
import {
  bpsToPercentInput,
  formatRewardAmount,
  parseRecipientAddress,
  percentInputToBps,
} from "@/lib/protocol/ux";
import { useAppLocale } from "@/i18n/client";
import { FundIncentivesDialog, rewardDate, usePoolRewards } from "./FundIncentives";
import styles from "./creator-pools.module.css";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const short = (address: Address) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export function CreatorPoolsPage() {
  const { active } = useDeployment();
  if (!active.phaseOne) return null;
  return (
    <CreatorPools key={active.phaseOne.descriptor.deploymentId} deployment={active.phaseOne} />
  );
}

type Loaded = Readonly<{ pool: PhaseOnePool; state: CreatorPoolState }>;

function CreatorPools({ deployment }: { deployment: PhaseOneDeployment }) {
  const t = useTranslations("creatorPools");
  const id = deployment.descriptor.deploymentId;
  const discovery = usePhaseOnePools(deployment);
  const [selectedId, setSelectedId] = useState<Hex | null>(null);
  const action = usePhaseOneAction(deployment, selectedId ?? "");
  const known = useMemo(() => knownTokens(discovery.pools), [discovery.pools]);
  const [pasted, setPasted] = useState<Hex[]>([]);
  const [pasteInput, setPasteInput] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const indexed = useQuery({
    queryKey: ["phase-one-pools", id, "public"],
    staleTime: 60_000,
    retry: false,
    queryFn: () => loadIndexedPublicPools(id),
  });
  const candidateIds = useMemo(() => {
    const ids = action.wallet
      ? indexedCreatorPools(indexed.data?.items ?? [], action.wallet).map((pool) => pool.poolId)
      : [];
    return [...new Set([...ids, ...pasted].map((poolId) => poolId.toLowerCase() as Hex))];
  }, [indexed.data, action.wallet, pasted]);

  // Ownership comes from the chain: the indexer records the original creator only.
  const pools = useQuery({
    queryKey: ["phase-one-creator", id, "pools", action.wallet, candidateIds.join(",")],
    enabled: Boolean(action.publicClient && action.wallet && !discovery.discovering),
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const client = action.publicClient!;
      const weth = await readRevenueWeth(client, deployment);
      const listed = candidateIds.flatMap((poolId) => {
        const pool = discovery.pools.find((entry) => same(entry.poolId, poolId));
        return pool ? [pool] : [];
      });
      const outcomes = await Promise.allSettled(
        listed.map(async (pool) => ({
          pool,
          state: await readCreatorPool(client, deployment, pool, weth),
        }))
      );
      const loaded = outcomes.flatMap((outcome) =>
        outcome.status === "fulfilled" ? [outcome.value] : []
      );
      const failures = outcomes.flatMap((outcome, index) =>
        outcome.status === "rejected"
          ? [
              `${listed[index]!.token0.symbol}/${listed[index]!.token1.symbol}: ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`,
            ]
          : []
      );
      const tokens = await resolveTokens(
        client,
        loaded.flatMap(({ state }) => state.settled.map((entry) => entry.asset)),
        known
      );
      return { weth, loaded, tokens, failures };
    },
  });
  const loaded = pools.data?.loaded ?? [];
  const selected = loaded.find((entry) => same(entry.pool.poolId, selectedId ?? "")) ?? loaded[0];
  const openPasted = () => {
    const value = pasteInput.trim();
    if (!isHash(value)) return setPasteError(t("invalidPoolId"));
    if (!discovery.pools.some((pool) => same(pool.poolId, value)))
      return setPasteError(t("unknownPool"));
    setPasteError(null);
    setPasted((current) => [...current, value as Hex]);
    setSelectedId(value as Hex);
    setPasteInput("");
  };

  if (!action.ready)
    return (
      <section className={`ui-card ${styles.empty}`}>
        <ActionReview action={action} />
      </section>
    );
  const loading = indexed.isLoading || discovery.discovering || pools.isLoading;
  return (
    <div className={styles.page}>
      <nav className={styles.list} aria-label={t("yourPools")}>
        {loading && <p role="status">{t("loading")}</p>}
        {(indexed.error || pools.error) && (
          <p className="dapp-inline-error" role="alert">
            {(indexed.error ?? pools.error)!.message}
          </p>
        )}
        {pools.data?.failures.map((failure) => (
          <p key={failure} className="dapp-inline-error" role="alert">
            {failure}
          </p>
        ))}
        {!loading &&
          loaded.length === 0 &&
          !indexed.error &&
          !pools.error &&
          !pools.data?.failures.length && (
            <section className={`ui-card ${styles.empty}`}>
              <h2>{t("empty")}</h2>
              <p className={styles.muted}>{t("emptyHelp")}</p>
              <Link className="ui-button ui-button--primary" href="/app/liquidity">
                {t("createPool")}
              </Link>
            </section>
          )}
        {loaded.map((entry) => (
          <PoolTile
            key={entry.pool.poolId}
            entry={entry}
            wallet={action.wallet!}
            current={entry === selected}
            onSelect={() => {
              action.cancel();
              setSelectedId(entry.pool.poolId);
            }}
          />
        ))}
        <form
          className={styles.paste}
          onSubmit={(event) => {
            event.preventDefault();
            openPasted();
          }}
        >
          <label htmlFor="creator-pool-id">{t("pasteLabel")}</label>
          <div>
            <input
              id="creator-pool-id"
              placeholder="0x…"
              autoComplete="off"
              value={pasteInput}
              onChange={(event) => setPasteInput(event.target.value)}
            />
            <button className="ui-button" type="submit">
              {t("open")}
            </button>
          </div>
          {pasteError && (
            <p className="dapp-inline-error" role="alert">
              {pasteError}
            </p>
          )}
        </form>
      </nav>
      {selected && pools.data && (
        <PoolControls
          key={selected.pool.poolId}
          deployment={deployment}
          entry={selected}
          tokens={pools.data.tokens}
          known={known}
          allTokens={discovery.pools}
          action={action}
        />
      )}
      <ActionReview action={action} />
    </div>
  );
}

function counts(state: CreatorPoolState) {
  return {
    settle: state.pending.filter((entry) => entry.amount > 0n).length,
    claim: state.settled.filter((entry) => entry.amount > 0n).length,
  };
}

function PoolTile({
  entry,
  wallet,
  current,
  onSelect,
}: {
  entry: Loaded;
  wallet: Address;
  current: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("creatorPools");
  const { pool, state } = entry;
  const { settle, claim } = counts(state);
  const incoming =
    state.pendingCreator && same(state.pendingCreator, wallet) && !same(state.creator, wallet);
  return (
    <button
      className={styles.tile}
      type="button"
      aria-current={current ? "page" : undefined}
      onClick={onSelect}
    >
      <span className={styles.tileHead}>
        <strong>
          {pool.token0.symbol} / {pool.token1.symbol}
        </strong>
        <span className={styles.pill}>{pool.poolKey.fee / 10_000}%</span>
      </span>
      {incoming ? (
        <span className={styles.warn}>{t("handoverToYou")}</span>
      ) : state.pendingCreator ? (
        <span className={styles.warn}>
          {t("handoverProposed", { address: short(state.pendingCreator) })}
        </span>
      ) : settle || claim ? (
        <span className={styles.good}>
          {[
            settle ? t("readyToSettle", { count: settle }) : "",
            claim ? t("readyToClaim", { count: claim }) : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      ) : (
        <span className={styles.muted}>{t("noneYet")}</span>
      )}
    </button>
  );
}

type Action = ReturnType<typeof usePhaseOneAction>;

function PoolControls({
  deployment,
  entry,
  tokens,
  known,
  allTokens,
  action,
}: {
  deployment: PhaseOneDeployment;
  entry: Loaded;
  tokens: ReadonlyMap<string, PublicPoolToken>;
  known: ReadonlyMap<string, PublicPoolToken>;
  allTokens: readonly PhaseOnePool[];
  action: Action;
}) {
  const t = useTranslations("creatorPools");
  const r = useTranslations("creatorPools.review");
  const { pool, state } = entry;
  const wallet = action.wallet!;
  const isCreator = same(state.creator, wallet);
  const pair = `${pool.token0.symbol} / ${pool.token1.symbol}`;
  const token = (address: Address) =>
    isNativeCurrency(address)
      ? pool.token0
      : (tokens.get(address.toLowerCase()) ?? known.get(address.toLowerCase()));
  const amount = (value: bigint, address: Address) => {
    const meta = token(address);
    return meta ? `${formatRewardAmount(value, meta.decimals)} ${meta.symbol}` : value.toString();
  };
  const run = (label: string, details: string[], send: Parameters<Action["send"]>[0]) =>
    void action.prepare(async () => ({
      label,
      details,
      execute: async () => {
        await action.send(send);
      },
    }));

  const header = (
    <section className={`ui-card ${styles.poolHead}`}>
      <div>
        <div className={styles.titleRow}>
          <h2>{pair}</h2>
          <span className={styles.pill}>{t("lpFee", { fee: pool.poolKey.fee / 10_000 })}</span>
          <IndexedPoolSwapFee
            deploymentId={deployment.descriptor.deploymentId}
            poolId={pool.poolId}
            lpFee={pool.poolKey.fee}
          />
          {isCreator && <span className={styles.goodPill}>{t("youCreated")}</span>}
        </div>
        <code className={styles.mono}>{`${pool.poolId.slice(0, 6)}…${pool.poolId.slice(-4)}`}</code>
      </div>
      <Link className="ui-button" href={`/app/liquidity?poolId=${pool.poolId}`}>
        {t("viewPool")}
      </Link>
    </section>
  );

  if (!isCreator) {
    const incoming = state.pendingCreator && same(state.pendingCreator, wallet);
    return (
      <main className={styles.main}>
        {header}
        {incoming ? (
          <section className={`ui-card ${styles.card} ${styles.handover}`}>
            <span className={styles.warnPill}>{t("handoverToYou")}</span>
            <dl className={styles.facts}>
              <div>
                <dt>{t("currentCreator")}</dt>
                <dd className={styles.mono}>{short(state.creator)}</dd>
              </div>
              <div>
                <dt>{t("proposedCreator")}</dt>
                <dd className={styles.mono}>
                  {short(wallet)} {t("you")}
                </dd>
              </div>
            </dl>
            <p className={styles.muted}>{t("acceptHelp")}</p>
            <button
              className="ui-button ui-button--primary"
              type="button"
              disabled={action.busy}
              onClick={() =>
                run(r("accept"), [r("pool", { pool: pair }), r("acceptDetail")], {
                  kind: "phase-one-creator-accept",
                  label: r("accept"),
                  amount: pair,
                  ...creatorCalls.accept(deployment, pool.poolId),
                })
              }
            >
              {t("accept")}
            </button>
          </section>
        ) : (
          <p className={styles.muted}>{t("notYours")}</p>
        )}
      </main>
    );
  }

  const recipientIsYou = same(state.recipient, wallet);
  return (
    <main className={styles.main}>
      {header}

      <section className={`ui-card ${styles.card}`} aria-labelledby="creator-revenue">
        <div className={styles.cardHead}>
          <h3 id="creator-revenue">{t("revenue")}</h3>
          <span className={styles.muted}>
            {t("paidTo", { address: short(state.recipient) })} {recipientIsYou && t("you")}
          </span>
        </div>
        <div className={styles.revenue}>
          <div className={styles.revenueSide}>
            <div>
              <h4>{t("pending")}</h4>
              <p className={styles.muted}>{t("pendingHelp")}</p>
            </div>
            {state.pending.every((entry) => entry.amount === 0n) && (
              <p className={styles.muted}>{t("nothing")}</p>
            )}
            {state.pending
              .filter((entry) => entry.amount > 0n)
              .map((entry) => {
                const symbol = token(entry.currency)?.symbol ?? "";
                return (
                  <div className={styles.row} key={entry.currency}>
                    <div>
                      <strong>{amount(entry.amount, entry.currency)}</strong>
                      {isNativeCurrency(entry.currency) && (
                        <span className={styles.muted}>{t("settlesAsWeth")}</span>
                      )}
                    </div>
                    <button
                      className="ui-button"
                      type="button"
                      disabled={action.busy}
                      onClick={() =>
                        run(
                          r("settle", { symbol }),
                          [
                            r("pool", { pool: pair }),
                            r("pendingShare", { amount: amount(entry.amount, entry.currency) }),
                            ...(isNativeCurrency(entry.currency) ? [r("settleWeth")] : []),
                            r("settleTreasury"),
                          ],
                          {
                            kind: "phase-one-settle-revenue",
                            label: r("settle", { symbol }),
                            amount: amount(entry.amount, entry.currency),
                            ...creatorCalls.settle(deployment, pool.poolId, entry.currency),
                          }
                        )
                      }
                    >
                      {t("settle")}
                    </button>
                  </div>
                );
              })}
            <p className={styles.note}>{t("tipNote")}</p>
          </div>
          <div className={styles.revenueSide}>
            <div>
              <h4>{t("ready")}</h4>
              <p className={styles.muted}>{t("readyHelp")}</p>
            </div>
            {state.settled.every((entry) => entry.amount === 0n) && (
              <p className={styles.muted}>{t("nothing")}</p>
            )}
            {state.settled
              .filter((entry) => entry.amount > 0n)
              .map((entry) => {
                const symbol = token(entry.asset)?.symbol ?? "";
                return (
                  <div className={styles.row} key={entry.asset}>
                    <strong>{amount(entry.amount, entry.asset)}</strong>
                    <button
                      className="ui-button ui-button--primary"
                      type="button"
                      disabled={action.busy}
                      onClick={() =>
                        run(
                          r("claim", { symbol }),
                          [
                            r("pool", { pool: pair }),
                            r("claimAmount", { amount: amount(entry.amount, entry.asset) }),
                            r("claimTo", { address: state.recipient }),
                          ],
                          {
                            kind: "phase-one-creator-claim",
                            label: r("claim", { symbol }),
                            amount: amount(entry.amount, entry.asset),
                            // Credit only grows until claimed, so the reviewed amount is the floor.
                            ...creatorCalls.claim(
                              deployment,
                              pool.poolId,
                              entry.asset,
                              state.recipient,
                              entry.amount
                            ),
                          }
                        )
                      }
                    >
                      {t("claim")}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      </section>

      <Incentives
        deployment={deployment}
        pool={pool}
        known={known}
        allTokens={allTokens}
        action={action}
      />

      <div className={styles.pair}>
        <section className={`ui-card ${styles.card}`} aria-labelledby="creator-pol">
          <div className={styles.cardHead}>
            <h3 id="creator-pol">{t("pol")}</h3>
            <span className={state.polActivated ? styles.goodPill : styles.pill}>
              {state.polActivated ? t("polOn") : t("polOff")}
            </span>
          </div>
          <p className={styles.muted}>{state.polActivated ? t("polActiveHelp") : t("polHelp")}</p>
          {!state.polActivated && (
            <button
              className="ui-button"
              type="button"
              disabled={action.busy}
              onClick={() =>
                void action.prepare(async () => {
                  // Read the fee at review time; the call must send it exactly.
                  const fee = await action.publicClient!.readContract({
                    address: deployment.contracts.diamond,
                    abi: creatorAbi,
                    functionName: "protocolPolActivationFee",
                  });
                  return {
                    label: r("pol"),
                    details: [
                      r("pool", { pool: pair }),
                      r("polFee", { fee: formatEther(fee) }),
                      r("polOnce"),
                    ],
                    execute: async () => {
                      await action.send({
                        kind: "phase-one-activate-pol",
                        label: r("pol"),
                        amount: `${formatEther(fee)} ETH`,
                        ...creatorCalls.activatePol(deployment, pool.poolId, fee),
                      });
                    },
                  };
                })
              }
            >
              {t("polActivate", { fee: formatEther(state.polFee) })}
            </button>
          )}
        </section>
        <Recipient
          state={state}
          wallet={wallet}
          pair={pair}
          deployment={deployment}
          pool={pool}
          run={run}
          busy={action.busy}
        />
      </div>

      <Transfer
        state={state}
        pair={pair}
        deployment={deployment}
        pool={pool}
        run={run}
        busy={action.busy}
      />
    </main>
  );
}

type Run = (label: string, details: string[], send: Parameters<Action["send"]>[0]) => void;

function Recipient({
  state,
  wallet,
  pair,
  deployment,
  pool,
  run,
  busy,
}: {
  state: CreatorPoolState;
  wallet: Address;
  pair: string;
  deployment: PhaseOneDeployment;
  pool: CreatorPool;
  run: Run;
  busy: boolean;
}) {
  const t = useTranslations("creatorPools");
  const r = useTranslations("creatorPools.review");
  const [input, setInput] = useState(same(state.recipient, wallet) ? "" : state.recipient);
  const parsed = input.trim() ? parseRecipientAddress(input.trim()) : zeroAddress;
  const unchanged =
    parsed !== null &&
    (parsed === zeroAddress ? same(state.recipient, state.creator) : same(parsed, state.recipient));
  return (
    <section className={`ui-card ${styles.card}`} aria-labelledby="creator-recipient">
      <h3 id="creator-recipient">{t("recipient")}</h3>
      <p className={styles.muted}>{t("recipientHelp")}</p>
      <label className={styles.srOnly} htmlFor="creator-recipient-input">
        {t("recipientLabel")}
      </label>
      <input
        id="creator-recipient-input"
        className={styles.addressInput}
        placeholder={`${short(wallet)} ${t("you")}`}
        autoComplete="off"
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      {parsed === null && <p className="dapp-inline-error">{t("invalidAddress")}</p>}
      <button
        className="ui-button"
        type="button"
        disabled={busy || parsed === null || unchanged}
        onClick={() =>
          run(
            r("recipient"),
            [
              r("pool", { pool: pair }),
              parsed === zeroAddress ? r("recipientReset") : r("recipientTo", { address: parsed! }),
            ],
            {
              kind: "phase-one-creator-recipient",
              label: r("recipient"),
              amount: pair,
              ...creatorCalls.setRecipient(deployment, pool.poolId, parsed!),
            }
          )
        }
      >
        {t("saveRecipient")}
      </button>
    </section>
  );
}

function Transfer({
  state,
  pair,
  deployment,
  pool,
  run,
  busy,
}: {
  state: CreatorPoolState;
  pair: string;
  deployment: PhaseOneDeployment;
  pool: CreatorPool;
  run: Run;
  busy: boolean;
}) {
  const t = useTranslations("creatorPools");
  const r = useTranslations("creatorPools.review");
  const [input, setInput] = useState("");
  const parsed = input.trim() ? parseRecipientAddress(input.trim()) : null;
  const invalid = input.trim() !== "" && (parsed === null || same(parsed, state.creator));
  return (
    <section className={`ui-card ${styles.card}`} aria-labelledby="creator-transfer">
      <div>
        <h3 id="creator-transfer">{t("transfer")}</h3>
        <p className={styles.muted}>{t("transferHelp")}</p>
      </div>
      {state.pendingCreator ? (
        <div className={styles.row}>
          <span className={styles.warn}>
            {t("pendingHandover", { address: short(state.pendingCreator) })}
          </span>
          <button
            className="ui-button"
            type="button"
            disabled={busy}
            onClick={() =>
              // Proposing address zero cancels the pending handover.
              run(r("cancel"), [r("pool", { pool: pair })], {
                kind: "phase-one-creator-transfer",
                label: r("cancel"),
                amount: pair,
                ...creatorCalls.propose(deployment, pool.poolId, zeroAddress),
              })
            }
          >
            {t("cancelHandover")}
          </button>
        </div>
      ) : (
        <div className={styles.inline}>
          <label className={styles.srOnly} htmlFor="creator-transfer-input">
            {t("newCreator")}
          </label>
          <input
            id="creator-transfer-input"
            className={styles.addressInput}
            placeholder={t("newCreator")}
            autoComplete="off"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            className="ui-button"
            type="button"
            disabled={busy || !parsed || invalid}
            onClick={() =>
              run(
                r("transfer"),
                [
                  r("pool", { pool: pair }),
                  r("transferTo", { address: parsed! }),
                  r("transferAccept"),
                ],
                {
                  kind: "phase-one-creator-transfer",
                  label: r("transfer"),
                  amount: pair,
                  ...creatorCalls.propose(deployment, pool.poolId, parsed!),
                }
              )
            }
          >
            {t("propose")}
          </button>
        </div>
      )}
      {invalid && <p className="dapp-inline-error">{t("invalidAddress")}</p>}
    </section>
  );
}

function Incentives({
  deployment,
  pool,
  known,
  allTokens,
  action,
}: {
  deployment: PhaseOneDeployment;
  pool: PhaseOnePool;
  known: ReadonlyMap<string, PublicPoolToken>;
  allTokens: readonly PhaseOnePool[];
  action: Action;
}) {
  const t = useTranslations("creatorPools");
  const r = useTranslations("creatorPools.review");
  const locale = useAppLocale();
  const pair = `${pool.token0.symbol} / ${pool.token1.symbol}`;
  const rewards = usePoolRewards(deployment, pool.poolId, known);
  const [shares, setShares] = useState<Record<number, string>>({});
  const [adding, setAdding] = useState<Address | null>(null);
  const [funding, setFunding] = useState<number | null>(null);
  const assigned = rewards.data?.rewards ?? [];
  const fundingEnabled = rewards.data?.fundingEnabled && pool.liquidityEnabled !== false;
  const full = assigned.length >= MAX_REWARD_SLOTS;
  const allowed = useQuery({
    queryKey: [
      "phase-one-creator",
      deployment.descriptor.deploymentId,
      "allowed-rewards",
      [...known.keys()].sort().join(","),
    ],
    enabled: Boolean(action.publicClient) && !full,
    staleTime: 60_000,
    queryFn: () =>
      readAllowedRewardTokens(action.publicClient!, deployment, [
        ...knownTokens(allTokens).values(),
      ]),
  });
  const addable = (allowed.data ?? []).filter(
    (token) => !assigned.some((slot) => same(slot.asset, token.address))
  );
  const days = rewards.data ? Number(rewards.data.rewardDuration / 86_400n) : 7;
  const symbol = (address: Address) =>
    rewards.data?.tokens.get(address.toLowerCase())?.symbol ?? address.slice(0, 8);
  return (
    <section className={`ui-card ${styles.card}`} aria-labelledby="creator-incentives">
      <div>
        <h3 id="creator-incentives">{t("incentives")}</h3>
        <p className={styles.muted}>{t("incentivesHelp", { days })}</p>
      </div>
      {rewards.error && (
        <p className="dapp-inline-error" role="alert">
          {rewards.error.message}
        </p>
      )}
      {assigned.length > 0 && (
        <div className={styles.tableBox}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("token")}</th>
                <th scope="col">{t("streaming")}</th>
                <th scope="col">{t("ends")}</th>
                <th scope="col">{t("allocatorShare")}</th>
                <th scope="col">
                  <span className={styles.srOnly}>{t("actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((slot) => {
                const meta = rewards.data!.tokens.get(slot.asset.toLowerCase());
                const protocolSlot = slot.slot === STATICS_REWARD_SLOT;
                const draft = shares[slot.slot] ?? bpsToPercentInput(slot.allocatorShareBps);
                const bps = percentInputToBps(draft);
                return (
                  <tr key={slot.slot}>
                    <td>
                      <strong>{symbol(slot.asset)}</strong>
                      {protocolSlot && <span className={styles.muted}> · {t("protocol")}</span>}
                    </td>
                    <td>
                      {slot.remaining > 0n && meta
                        ? formatRewardAmount(slot.remaining, meta.decimals)
                        : t("notFunded")}
                    </td>
                    <td>{slot.remaining > 0n ? rewardDate(slot.periodFinish, locale) : "—"}</td>
                    <td>
                      {protocolSlot ? (
                        <span className={styles.muted}>{t("setByProtocol")}</span>
                      ) : (
                        <div className={styles.shareCell}>
                          <label className={styles.srOnly} htmlFor={`share-${slot.slot}`}>
                            {t("shareLabel", { symbol: symbol(slot.asset) })}
                          </label>
                          <input
                            id={`share-${slot.slot}`}
                            inputMode="decimal"
                            value={draft}
                            onChange={(event) =>
                              setShares({ ...shares, [slot.slot]: event.target.value })
                            }
                          />
                          <span>%</span>
                          {bps !== null && bps !== slot.allocatorShareBps && (
                            <button
                              className="ui-button"
                              type="button"
                              disabled={action.busy || !fundingEnabled}
                              onClick={() =>
                                void action.prepare(async () => ({
                                  label: r("share", { symbol: symbol(slot.asset) }),
                                  details: [
                                    r("pool", { pool: pair }),
                                    r("shareDetail", { percent: bpsToPercentInput(bps) }),
                                  ],
                                  execute: async () => {
                                    await action.send({
                                      kind: "phase-one-creator-reward-share",
                                      label: r("share", { symbol: symbol(slot.asset) }),
                                      amount: `${bpsToPercentInput(bps)}%`,
                                      ...creatorCalls.setAllocatorShare(
                                        deployment,
                                        pool.poolId,
                                        slot.slot,
                                        bps
                                      ),
                                    });
                                  },
                                }))
                              }
                            >
                              {t("save")}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={styles.end}>
                      {!protocolSlot && (
                        <button
                          className={styles.link}
                          type="button"
                          disabled={action.busy || !fundingEnabled}
                          onClick={() => setFunding(slot.slot)}
                        >
                          {t("fund")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.note}>{t("allocatorHelp")}</p>
      <p className={styles.note}>{t("scheduleNote")}</p>
      {allowed.error && (
        <p className="dapp-inline-error" role="alert">
          {allowed.error.message}
        </p>
      )}
      {full ? (
        <p className={styles.muted}>{t("slotsFull", { max: MAX_REWARD_SLOTS })}</p>
      ) : (
        <div className={styles.addToken}>
          <span className={styles.label}>{t("addToken")}</span>
          {allowed.isSuccess && addable.length === 0 && (
            <p className={styles.muted}>{t("noAllowedTokens")}</p>
          )}
          {addable.length > 0 && (
            <div className={styles.chips} role="group" aria-label={t("chooseToken")}>
              {addable.map((token) => (
                <button
                  key={token.address}
                  type="button"
                  aria-pressed={adding !== null && same(adding, token.address)}
                  onClick={() => setAdding(token.address)}
                >
                  {token.symbol}
                </button>
              ))}
            </div>
          )}
          {addable.length > 0 && (
            <button
              className="ui-button"
              type="button"
              disabled={
                action.busy ||
                !fundingEnabled ||
                !adding ||
                !addable.some((token) => same(token.address, adding))
              }
              onClick={() => {
                const picked = addable.find((token) => same(token.address, adding!));
                if (!picked) return;
                void action.prepare(async () => ({
                  label: r("addToken", { symbol: picked.symbol }),
                  details: [
                    r("pool", { pool: pair }),
                    r("addTokenDetail", { symbol: picked.symbol }),
                  ],
                  execute: async () => {
                    await action.send({
                      kind: "phase-one-creator-reward-token",
                      label: r("addToken", { symbol: picked.symbol }),
                      amount: picked.symbol,
                      ...creatorCalls.appendReward(deployment, pool.poolId, picked.address),
                    });
                    setAdding(null);
                  },
                }));
              }}
            >
              {t("addTokenButton")}
            </button>
          )}
        </div>
      )}
      {funding !== null && (
        <FundIncentivesDialog
          deployment={deployment}
          pool={pool}
          known={known}
          initialSlot={funding}
          onClose={() => setFunding(null)}
        />
      )}
    </section>
  );
}
