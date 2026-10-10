import { act, render, waitFor } from "@/test/render";
import { expect, it, vi } from "vitest";
import { getAddress, type PublicClient } from "viem";
import { useLiquidityGauges } from "@/hooks/useLiquidityGauges";
import type { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import type { PhaseOneDeployment } from "@/lib/deployments/types";

it("bounds metadata reads for twenty pools and drains the queue after a failed read", async () => {
  let active = 0,
    maximum = 0;
  const pending: (() => void)[] = [];
  const read = vi.fn(
    ({ functionName }: { functionName: string }) =>
      new Promise((resolve, reject) => {
        active++;
        maximum = Math.max(maximum, active);
        pending.push(() => {
          active--;
          if (functionName === "gaugePoolWeight") reject(Error("Unavailable weight"));
          else
            resolve({
              activated: false,
              periodBudget: 0n,
              periodFinish: 0,
              totalAllocatedWeight: 0n,
              stopped: false,
              referenceTick: 0,
              activeGaugeLiquidity: 1n,
              liquidity: 1n,
              tickLower: -60,
              tickUpper: 60,
            });
        });
      })
  );
  const client = {
    readContract: read,
    getBlock: async () => ({ timestamp: 3000n }),
  } as unknown as PublicClient;
  const wallet = getAddress(`0x${"9".repeat(40)}`);
  const deployment = {
    descriptor: { deploymentId: "bounded-liquidity", chainId: 31337 },
    contracts: { diamond: getAddress(`0x${"1".repeat(40)}`) },
  } as PhaseOneDeployment;
  const action = { ready: true, wallet, publicClient: client } as ReturnType<
    typeof usePhaseOneAction
  >;
  const legs = Array.from({ length: 20 }, (_, i) => ({
    positionId: 1n,
    poolId: `0x${(i + 1).toString(16).padStart(64, "0")}` as const,
  }));
  function Probe() {
    const state = useLiquidityGauges(deployment, action, legs);
    return <span>{state.loading ? "Loading" : state.unavailable ? "Partial" : "Ready"}</span>;
  }
  const view = render(<Probe />);
  await waitFor(() => expect(read).toHaveBeenCalled());
  expect(read.mock.calls.length).toBeLessThanOrEqual(4);
  for (let batch = 0; batch < 30 && read.mock.calls.length < 61; batch++) {
    await act(async () => {
      pending.splice(0).forEach((finish) => finish());
    });
  }
  await act(async () => {
    pending.splice(0).forEach((finish) => finish());
  });
  await waitFor(() => expect(read).toHaveBeenCalledTimes(61));
  expect(maximum).toBeLessThanOrEqual(4);
  expect(active).toBe(0);
  await waitFor(() => expect(view.getByText("Partial")).toBeInTheDocument());
});
