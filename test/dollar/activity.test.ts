import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  readDollarActivity,
  updateDollarActivity,
  writeDollarActivity,
  type DollarActivity,
} from "@/lib/dollar/activity";

const wallet = "0x0000000000000000000000000000000000000001";

function activity(overrides: Partial<DollarActivity> = {}): DollarActivity {
  return {
    id: crypto.randomUUID(),
    wallet,
    chainId: 31_337,
    kind: "deposit-eth",
    label: "Deposit ETH",
    amount: "0.1",
    status: "simulating",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("Dollar activity storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("preserves each transaction lifecycle state and replacement metadata", () => {
    const entry = activity({ id: "lifecycle" });
    writeDollarActivity(entry);
    updateDollarActivity(wallet, 31_337, entry.id, { status: "signing" });
    updateDollarActivity(wallet, 31_337, entry.id, {
      status: "submitted",
      hash: `0x${"11".repeat(32)}`,
    });
    updateDollarActivity(wallet, 31_337, entry.id, {
      status: "confirmed",
      replacementReason: "repriced",
      replacementHash: `0x${"22".repeat(32)}`,
      confirmedHash: `0x${"22".repeat(32)}`,
    });

    expect(readDollarActivity(wallet, 31_337)[0]).toMatchObject({
      id: "lifecycle",
      status: "confirmed",
      replacementReason: "repriced",
      confirmedHash: `0x${"22".repeat(32)}`,
    });
  });

  it("scopes and caps browser-local records by wallet and chain", () => {
    for (let index = 0; index < 55; index += 1) {
      writeDollarActivity(activity({ id: String(index), createdAt: index }));
    }

    expect(readDollarActivity(wallet, 31_337)).toHaveLength(50);
    expect(readDollarActivity(wallet, 46_630)).toEqual([]);
  });

  it("fails closed for malformed browser storage", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockReturnValue('{"not":"an array"}');
    expect(readDollarActivity(wallet, 31_337)).toEqual([]);
    getItem.mockRestore();
  });
});
