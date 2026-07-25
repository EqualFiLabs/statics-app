import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  readDollarActivity,
  readProtocolActivityAcrossChains,
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

  it("combines activity for the same wallet across supported chains", () => {
    writeDollarActivity(activity({ id: "local", chainId: 31_337, createdAt: 1 }));
    writeDollarActivity(activity({ id: "base", chainId: 8_453, createdAt: 2 }));

    expect(
      readProtocolActivityAcrossChains(wallet, [31_337, 8_453]).map((entry) => entry.id)
    ).toEqual(["base", "local"]);
  });

  it("fails closed for malformed browser storage", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockReturnValue('{"not":"an array"}');
    expect(readDollarActivity(wallet, 31_337)).toEqual([]);
    getItem.mockRestore();
  });

  it("retains legacy Dollar entries beside new protocol activity", () => {
    window.localStorage.setItem(
      `statics:dollar:activity:31337:${wallet.toLowerCase()}`,
      JSON.stringify([activity({ id: "legacy", createdAt: 1 })])
    );
    writeDollarActivity(
      activity({
        id: "basket",
        kind: "mint-basket",
        label: "Mint local basket",
        createdAt: 2,
      })
    );
    expect(readDollarActivity(wallet, 31_337).map((entry) => entry.id)).toEqual([
      "basket",
      "legacy",
    ]);
  });

  it("stores position and reward lifecycle kinds in the shared protocol ledger", () => {
    writeDollarActivity(
      activity({
        id: "reward-opt-in",
        kind: "opt-in-reward-assets",
        label: "Select reward assets",
      })
    );
    expect(readDollarActivity(wallet, 31_337)[0]).toMatchObject({
      id: "reward-opt-in",
      kind: "opt-in-reward-assets",
    });
  });

  it("retains confirmed-unverified loan activity without treating it as failed", () => {
    writeDollarActivity(
      activity({
        id: "loan-verification",
        kind: "borrow-loan",
        label: "Borrow against Position #17",
        status: "confirmed-unverified",
      })
    );
    expect(readDollarActivity(wallet, 31_337)[0]).toMatchObject({
      kind: "borrow-loan",
      status: "confirmed-unverified",
    });
  });
});
