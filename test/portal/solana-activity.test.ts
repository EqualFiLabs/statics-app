import { beforeEach, describe, expect, it, vi } from "vitest";

import { recoverSolanaActivity } from "@/lib/portal/activity-recovery";
import {
  readSolanaActivity,
  updateSolanaActivity,
  writeSolanaActivity,
  type SolanaActivity,
} from "@/lib/portal/solana-activity";

const wallet = "7YttLkHDoNj9wyDur5A3ZV7v9G6Xx4GC2V1gGoZmy1xt";

function activity(overrides: Partial<SolanaActivity> = {}): SolanaActivity {
  return {
    id: crypto.randomUUID(),
    wallet,
    kind: "send",
    label: "Send SOL",
    amount: "1 SOL",
    status: "signing",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("Solana activity storage and recovery", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists signing, submitted, and confirmed lifecycle states", () => {
    const entry = activity({ id: "send" });
    writeSolanaActivity(entry);
    updateSolanaActivity(entry.id, { status: "submitted", signature: "signature" });
    updateSolanaActivity(entry.id, { status: "confirmed" });

    expect(readSolanaActivity(wallet)[0]).toMatchObject({
      id: "send",
      status: "confirmed",
      signature: "signature",
    });
  });

  it("recovers a submitted signature from authoritative Solana status", async () => {
    const entry = activity({
      id: "recover",
      status: "submitted",
      signature: "signature",
    });
    writeSolanaActivity(entry);
    const getSignatureStatus = vi.fn().mockResolvedValue({
      context: { slot: 1 },
      value: {
        slot: 1,
        confirmations: 1,
        err: null,
        confirmationStatus: "confirmed",
      },
    });

    await recoverSolanaActivity(entry, { getSignatureStatus });

    expect(readSolanaActivity(wallet)[0]).toMatchObject({
      id: "recover",
      status: "confirmed",
    });
  });
});
