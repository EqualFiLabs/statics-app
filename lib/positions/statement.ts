import { zeroAddress, type Address } from "viem";
import type { PositionStatementPage, StatementCategory } from "@/lib/indexer/phase-one";

export type StatementItem = PositionStatementPage["items"][number];
export type StatementFilter = "all" | StatementCategory;
export const STATEMENT_FILTERS: readonly StatementFilter[] = [
  "all",
  "liquidity",
  "staking",
  "allocations",
  "rewards",
  "lifecycle",
];

/**
 * Reward bookkeeping the contract records without a user action: settlements, forfeits and
 * eligibility timing. A statement hides these by default, like a bank hides internal postings.
 */
const ACCOUNTING_EVENTS = new Set<StatementItem["eventName"]>([
  "PositionRewardSettled",
  "RewardStakeScheduled",
  "PositionRewardEligibilityActivated",
  "PositionRewardWeightChanged",
]);
export function isAccountingEntry(item: StatementItem) {
  return ACCOUNTING_EVENTS.has(item.eventName);
}

export type StatementAmount = Readonly<{
  /** Out of the paying wallet, or into the receiving wallet. */
  direction: "out" | "in";
  space: "wallet" | "internal" | "entitlement";
  actor: Address | null;
  address: Address;
  purpose: string;
  symbol: string | null;
  decimals: number | null;
  native: boolean;
  amount: bigint;
}>;

/**
 * Preserve the event's recorded debit/credit, actor and accounting space. An approved operator
 * may pay or receive instead of the holder. The opening fee establishes a treasury receipt;
 * its payer is not recorded and must not be inferred.
 */
export function walletAmounts(item: StatementItem, includeAccounting = false): StatementAmount[] {
  return item.movements
    .filter(
      (movement) =>
        movement.space === "wallet" || movement.purpose === "reward-forfeiture" || includeAccounting
    )
    .map((movement) => ({
      direction: movement.direction === "debit" ? "out" : "in",
      space: movement.space,
      actor: movement.actor,
      address: movement.asset.address,
      purpose: movement.purpose,
      symbol: movement.asset.symbol,
      decimals: movement.asset.decimals,
      native: movement.asset.address === zeroAddress,
      amount: movement.amount,
    }));
}

/** Entries grouped by calendar day in the viewer's time zone, keeping the given order. */
export function groupByDay(items: readonly StatementItem[], locale: string) {
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const groups: { label: string; items: StatementItem[] }[] = [];
  for (const item of items) {
    const label = day.format(new Date(Number(item.timestamp) * 1000));
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

/**
 * The newest entry in which this wallet received the account by transfer (not by opening it).
 * Older entries belong to a previous owner.
 */
export function ownershipStart(items: readonly StatementItem[], wallet: string | null) {
  if (!wallet) return null;
  return (
    items.find(
      (item) =>
        item.eventName === "Transfer" &&
        item.ownerBefore !== null &&
        item.ownerAfter?.toLowerCase() === wallet.toLowerCase()
    )?.key ?? null
  );
}

/** Owner context is recorded on every entry, including category-filtered pages. */
export function isPriorOwnerEntry(item: StatementItem, wallet: string | null) {
  const owners = [item.ownerBefore, item.ownerAfter].filter((owner) => owner !== null);
  return Boolean(
    wallet && owners.length && !owners.some((owner) => owner.toLowerCase() === wallet.toLowerCase())
  );
}
