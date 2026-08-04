import { describe, expect, it, vi } from "vitest";

import {
  executeProtocolActionPlan,
  protocolActionProgressLabel,
  type ProtocolActionProgress,
} from "@/lib/protocol/action-plan";

describe("protocol action plans", () => {
  it("runs unsatisfied steps in order and waits for each one", async () => {
    const order: string[] = [];
    const first = vi.fn(async () => void order.push("first"));
    const second = vi.fn(async () => void order.push("second"));

    await executeProtocolActionPlan([
      { id: "first", label: "Approve token", run: first },
      { id: "second", label: "Deposit token", run: second },
    ]);

    expect(order).toEqual(["first", "second"]);
  });

  it("skips permissions already satisfied onchain", async () => {
    const approval = vi.fn();
    const action = vi.fn();
    const progress: ProtocolActionProgress[] = [];

    await executeProtocolActionPlan(
      [
        {
          id: "approval",
          label: "Approve token",
          isSatisfied: async () => true,
          run: approval,
        },
        { id: "action", label: "Deposit token", run: action },
      ],
      (value) => progress.push(value)
    );

    expect(approval).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalledOnce();
    expect(progress[0]).toMatchObject({ stepId: "approval", status: "skipped" });
  });

  it("halts after a rejected or failed step", async () => {
    const failure = new Error("User rejected the request");
    const finalAction = vi.fn();
    const progress: ProtocolActionProgress[] = [];

    await expect(
      executeProtocolActionPlan(
        [
          { id: "approval", label: "Approve token", run: async () => Promise.reject(failure) },
          { id: "action", label: "Deposit token", run: finalAction },
        ],
        (value) => progress.push(value)
      )
    ).rejects.toBe(failure);

    expect(finalAction).not.toHaveBeenCalled();
    expect(progress.at(-1)).toMatchObject({ stepId: "approval", status: "failed" });
    expect(protocolActionProgressLabel(progress.at(-1) ?? null)).toBe(
      "Stopped at 1 of 2: Approve token"
    );
  });

  it("reports a failed step when its satisfaction check throws", async () => {
    const failure = new Error("Allowance RPC unavailable");
    const approval = vi.fn();
    const finalAction = vi.fn();
    const progress: ProtocolActionProgress[] = [];

    await expect(
      executeProtocolActionPlan(
        [
          {
            id: "approval",
            label: "Check token approval",
            isSatisfied: async () => Promise.reject(failure),
            run: approval,
          },
          { id: "action", label: "Deposit token", run: finalAction },
        ],
        (value) => progress.push(value)
      )
    ).rejects.toBe(failure);

    expect(approval).not.toHaveBeenCalled();
    expect(finalAction).not.toHaveBeenCalled();
    expect(progress.at(-1)).toMatchObject({ stepId: "approval", status: "failed" });
  });
});
