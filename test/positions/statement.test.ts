import { describe, expect, it } from "vitest";
import { getAddress, zeroAddress } from "viem";
import {
  groupByDay,
  isAccountingEntry,
  isPriorOwnerEntry,
  ownershipStart,
  walletAmounts,
  type StatementItem,
} from "@/lib/positions/statement";

const me = getAddress(`0x${"a".repeat(40)}`),
  them = getAddress(`0x${"b".repeat(40)}`);
const entry = (overrides: Record<string, unknown>) =>
  ({
    key: "k",
    eventName: "Staked",
    timestamp: 1_700_000_000n,
    ownerBefore: me,
    ownerAfter: me,
    movements: [],
    ...overrides,
  }) as unknown as StatementItem;
const move = (overrides: Record<string, unknown>) => ({
  ordinal: 0,
  asset: { address: them, symbol: "WETH", name: "WETH", decimals: 18 },
  actor: me,
  amount: 5n,
  space: "wallet",
  direction: "debit",
  purpose: "liquidity-funding",
  ...overrides,
});

describe("statement presentation", () => {
  it("preserves actual wallet actors and the opening fee's treasury receipt", () => {
    const item = entry({
      movements: [
        move({}),
        move({ direction: "credit", purpose: "liquidity-refund", amount: 1n }),
        move({ space: "internal", actor: null, direction: "credit" }),
        move({
          asset: { address: zeroAddress, symbol: null, name: null, decimals: null },
          direction: "credit",
          purpose: "creation-fee",
        }),
      ],
    });
    expect(walletAmounts(item).map((a) => `${a.direction}:${a.amount}:${a.native}`)).toEqual([
      "out:5:false",
      "in:1:false",
      "in:5:true",
    ]);
    expect(walletAmounts(item, true)).toHaveLength(4);
    expect(walletAmounts(item)[0].actor).toBe(me);
    expect(walletAmounts(item, true)[2].space).toBe("internal");
  });
  it("hides reward bookkeeping but not user actions", () => {
    expect(isAccountingEntry(entry({ eventName: "PositionRewardSettled" }))).toBe(true);
    expect(isAccountingEntry(entry({ eventName: "RewardAssetOptedIn" }))).toBe(false);
    const forfeiture = entry({
      eventName: "LpRewardForfeited",
      movements: [move({ space: "entitlement", purpose: "reward-forfeiture", actor: null })],
    });
    expect(isAccountingEntry(forfeiture)).toBe(false);
    expect(walletAmounts(forfeiture)[0]).toMatchObject({
      space: "entitlement",
      direction: "out",
      amount: 5n,
    });
  });
  it("labels prior owners even on pages without a handover event", () => {
    expect(isPriorOwnerEntry(entry({ ownerBefore: them, ownerAfter: them }), me)).toBe(true);
    expect(isPriorOwnerEntry(entry({ ownerBefore: them, ownerAfter: me }), me)).toBe(false);
    expect(isPriorOwnerEntry(entry({ ownerBefore: null, ownerAfter: them }), me)).toBe(true);
  });
  it("groups consecutive entries by local day", () => {
    const day = 86_400n;
    const groups = groupByDay(
      [
        entry({ key: "a", timestamp: 1_700_000_000n + day }),
        entry({ key: "b", timestamp: 1_700_000_000n }),
        entry({ key: "c", timestamp: 1_700_000_000n - 60n }),
      ],
      "en"
    );
    expect(groups.map((group) => group.items.map((item) => item.key))).toEqual([["a"], ["b", "c"]]);
  });
  it("finds where this wallet received the account, ignoring the mint", () => {
    const items = [
      entry({ key: "in", eventName: "Transfer", ownerBefore: them, ownerAfter: me }),
      entry({ key: "mint", eventName: "Transfer", ownerBefore: null, ownerAfter: them }),
    ];
    expect(ownershipStart(items, me.toLowerCase())).toBe("in");
    expect(ownershipStart(items.slice(1), me)).toBeNull();
    expect(ownershipStart(items, null)).toBeNull();
  });
});
