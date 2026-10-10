import { act } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import {
  announceProtocolTransactionConfirmed,
  protocolQueryScopes,
} from "@/lib/protocol/reconciliation";
import { ProtocolQueryReconciler } from "@/providers/ProtocolQueryReconciler";

const wallet = "0x81709E16Bf99936891Cc720689f269103fabeD91";

/** An on-screen query built from a nested, cached read, like Earn rewards. */
function NestedReward({
  source,
  deploymentId,
  captureClient,
}: {
  source: { value: number; beforeRead?: () => Promise<void> };
  deploymentId: string;
  captureClient?: (client: QueryClient) => void;
}) {
  const client = useQueryClient();
  captureClient?.(client);
  const reward = useQuery({
    queryKey: ["phase-one-rewards", deploymentId, wallet, "outer"],
    queryFn: () =>
      client.fetchQuery({
        queryKey: ["phase-one-rewards", deploymentId, wallet, "1", "global"],
        staleTime: 30_000,
        queryFn: async () => {
          const value = source.value;
          await source.beforeRead?.();
          return value;
        },
      }),
  });
  return <p>{reward.data === undefined ? "loading" : `reward ${reward.data}`}</p>;
}

function confirm(deploymentId: string) {
  act(() =>
    announceProtocolTransactionConfirmed({
      wallet,
      chainId: 4663,
      deploymentId,
      blockNumber: 2n,
      kind: "phase-one-claim-batch-rewards",
      scopes: protocolQueryScopes("phase-one-claim-batch-rewards"),
    })
  );
}

describe("ProtocolQueryReconciler", () => {
  it("refreshes on-screen queries through their nested cached reads after a confirmation", async () => {
    const source = { value: 5 };
    render(
      <>
        <ProtocolQueryReconciler />
        <NestedReward source={source} deploymentId="phase-one" />
      </>
    );
    expect(await screen.findByText("reward 5")).toBeInTheDocument();
    // The claim confirmed on-chain; the nested entry is still within its stale time.
    source.value = 0;
    confirm("phase-one");
    expect(await screen.findByText("reward 0")).toBeInTheDocument();
  });

  it("discards an inactive nested read started before confirmation", async () => {
    const source: { value: number; beforeRead?: () => Promise<void> } = { value: 5 };
    let client!: QueryClient;
    render(
      <>
        <ProtocolQueryReconciler />
        <NestedReward
          source={source}
          deploymentId="phase-one"
          captureClient={(value) => {
            client = value;
          }}
        />
      </>
    );
    expect(await screen.findByText("reward 5")).toBeInTheDocument();
    let release!: () => void;
    let started!: () => void;
    const reading = new Promise<void>((resolve) => {
      started = resolve;
    });
    source.beforeRead = () => {
      started();
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    };
    const nested = ["phase-one-rewards", "phase-one", wallet, "1", "global"];
    await client.invalidateQueries({ queryKey: nested, exact: true, refetchType: "none" });
    let oldRefresh!: Promise<void>;
    act(() => {
      oldRefresh = client.refetchQueries({
        queryKey: ["phase-one-rewards", "phase-one", wallet, "outer"],
        exact: true,
      });
    });
    await reading;
    source.value = 0;
    delete source.beforeRead;
    confirm("phase-one");
    try {
      expect(await screen.findByText("reward 0")).toBeInTheDocument();
    } finally {
      release();
    }
    await oldRefresh;
    await waitFor(() => expect(client.getQueryData(nested)).toBe(0));
    expect(screen.getByText("reward 0")).toBeInTheDocument();
  });

  it("leaves another deployment's state alone", async () => {
    const source = { value: 5 };
    render(
      <>
        <ProtocolQueryReconciler />
        <NestedReward source={source} deploymentId="phase-one" />
      </>
    );
    expect(await screen.findByText("reward 5")).toBeInTheDocument();
    source.value = 0;
    confirm("another-deployment");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText("reward 5")).toBeInTheDocument();
  });
});
