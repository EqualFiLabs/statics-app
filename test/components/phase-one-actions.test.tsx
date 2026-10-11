import { render, fireEvent, screen, waitFor } from "@/test/render";
import { expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { WalletContext, defaultWalletState, type WalletKind } from "@/providers/wallet-context";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
const execute = vi.hoisted(() => vi.fn());
vi.mock("@/lib/protocol/transactions", () => ({ executeProtocolTransaction: execute }));
vi.mock("wagmi", () => ({ usePublicClient: () => ({ chain: { id: 31337 } }) }));
const wallet = getAddress(`0x${"1".repeat(40)}`);
const deployment = {
  descriptor: { deploymentId: "fixture", chainId: 31337 },
  contracts: { diamond: wallet },
} as PhaseOneDeployment;
function Probe() {
  const action = usePhaseOneAction(deployment);
  return (
    <>
      <button
        onClick={() =>
          void action.prepare(async () => ({
            label: "Stake",
            details: [],
            execute: async () => {
              await action.send({
                kind: "phase-one-stake",
                label: "Stake",
                amount: "1 STATICS",
                to: wallet,
                data: "0x",
              });
            },
          }))
        }
      >
        Review stake
      </button>
      <ActionReview action={action} />
    </>
  );
}
it("discards reviewed actions when the signer kind changes during simulation", async () => {
  let release!: () => void;
  const pause = new Promise<void>((resolve) => {
    release = resolve;
  });
  const send = vi.fn();
  execute.mockImplementation(async (request) => {
    await pause;
    return request.sendTransaction({});
  });
  const tree = (kind: WalletKind) => (
    <WalletContext.Provider
      value={{
        ...defaultWalletState,
        status: "ready",
        address: wallet,
        chainId: 31337,
        walletKind: kind,
        sendEvmTransaction: send,
      }}
    >
      <Probe />
    </WalletContext.Provider>
  );
  const rendered = render(tree("external"));
  fireEvent.click(screen.getByText("Review stake"));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm transaction" }));
  await waitFor(() => expect(execute).toHaveBeenCalled());
  rendered.rerender(tree("embedded"));
  release();
  await screen.findByRole("alert");
  expect(send).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Confirm transaction" })).not.toBeInTheDocument();
});
