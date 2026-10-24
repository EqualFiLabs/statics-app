import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentPanel } from "@/components/agent/AgentPanel";
import type { Workflow } from "@equalfi/agent-client";
const mocks = vi.hoisted(() => ({
  agent: {
    sessionKey: "user-one",
    loadHistory: vi.fn(),
    checkContext: vi.fn(),
    client: null as unknown,
    workflows: [] as Workflow[],
    error: null,
    refresh: vi.fn(async () => {}),
    signNext: vi.fn(),
    setupSigner: vi.fn(),
    removeSigner: vi.fn(),
  },
  wallet: {
    authenticated: true,
    address: "0x1111111111111111111111111111111111111111",
    targetChainId: 4663,
    isTargetChain: true,
    walletKind: "embedded",
    login: vi.fn(),
    switchNetwork: vi.fn(),
    busyAction: null,
    networkName: "Robinhood",
  },
}));
vi.mock("@/providers/agent-context", () => ({ useAgent: () => mocks.agent }));
vi.mock("@/providers/wallet-context", () => ({ useWalletState: () => mocks.wallet }));
vi.mock("@/providers/deployment-context", () => ({
  useDeployment: () => ({ active: { descriptor: { deploymentId: "robinhood" } } }),
}));
const workflow = (status = "ready"): Workflow => ({
  id: "server-action",
  version: 1,
  identity: { appId: "statics", wallet: mocks.wallet.address },
  mode: "proposal",
  status,
  cancelRequested: false,
  plan: {
    digest: "digest",
    deploymentId: "robinhood",
    chainId: 4663,
    expiresAt: Date.now() + 300000,
    input: {
      kind: "statics.stake-existing",
      version: 1,
      deploymentId: "robinhood",
      wallet: mocks.wallet.address,
      positionId: "42",
      amount: "1000000000000000000",
      maxFeePerTransaction: "1000000000000000",
    },
    steps: [
      {
        id: "stake",
        kind: "stake",
        principal: "1000000000000000000",
        maxFee: "1000000000000000",
        transaction: {
          chainId: 4663,
          to: mocks.wallet.address,
          data: "0x",
          value: "0",
          gas: "1",
          maxFeePerGas: "1",
          maxPriorityFeePerGas: "1",
        },
      },
    ],
  },
  attempts: [],
});
function mount() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AgentPanel positionId="42" amount="1000000000000000000" />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  window.localStorage.clear();
  mocks.agent.sessionKey = "user-one";
  mocks.agent.checkContext.mockReset();
  mocks.agent.workflows = [];
  mocks.wallet.isTargetChain = true;
  mocks.agent.client = {
    policy: vi.fn(async () => ({})),
    prepare: vi.fn(async () => workflow()),
    status: vi.fn(async () => workflow("completed")),
    execute: vi.fn(async () => workflow("running")),
    reprepare: vi.fn(),
    cancel: vi.fn(),
  };
});
describe("canonical agent panel", () => {
  it("persists the server action reference and starts a fresh intent after completion", async () => {
    mount();
    fireEvent.change(screen.getByLabelText(/Maximum network fee per transaction/), {
      target: { value: "0.001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Prepare proposal" }));
    await screen.findByText(/Proposal prepared/);
    const client = mocks.agent.client as { prepare: ReturnType<typeof vi.fn> };
    const first = client.prepare.mock.calls[0][0];
    fireEvent.click(screen.getByRole("button", { name: "Prepare proposal" }));
    await waitFor(() => expect(client.prepare).toHaveBeenCalledTimes(2));
    expect(client.prepare.mock.calls[1][0]).not.toBe(first);
    expect(client.prepare.mock.calls[0][1]).toMatchObject({
      positionId: "42",
      amount: "1000000000000000000",
    });
  });
  it("locks a pending workflow and restores its status after remount", () => {
    mocks.agent.workflows = [workflow("reconciling")];
    const view = mount();
    expect(screen.getByText(/reconciling/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review and sign manually" })
    ).not.toBeInTheDocument();
    view.unmount();
    mount();
    expect(screen.getByText(/reconciling/)).toBeInTheDocument();
  });
  it("prevents rapid duplicate execution while a request is pending", async () => {
    mocks.agent.workflows = [workflow()];
    let release!: () => void;
    const execute = vi.fn(
      () =>
        new Promise<void>((r) => {
          release = r;
        })
    );
    (mocks.agent.client as { execute: unknown }).execute = execute;
    mount();
    const button = screen.getByRole("button", { name: "Review and sign manually" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(execute).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    release();
    await waitFor(() => expect(button).not.toBeDisabled());
  });
  it("requires the selected network before exposing execution", () => {
    mocks.wallet.isTargetChain = false;
    mount();
    expect(screen.getByRole("button", { name: "Switch to Robinhood" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Prepare proposal" })).not.toBeInTheDocument();
  });
  it("does not display a previous account's delayed conversation response", async () => {
    let finish!: () => void;
    const client = mocks.agent.client as Record<string, unknown>;
    client.conversation = vi.fn(async () => ({ id: "old-private-conversation" }));
    client.chat = vi.fn(
      () =>
        new Promise<void>((r) => {
          finish = r;
        })
    );
    client.messages = vi.fn(async () => []);
    const view = mount();
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "private question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(client.chat).toHaveBeenCalledOnce());
    mocks.agent.sessionKey = "user-two";
    mocks.agent.checkContext.mockImplementation(() => {
      throw new Error("context changed");
    });
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AgentPanel positionId="42" />
      </QueryClientProvider>
    );
    client.messages = vi.fn(async () => [
      {
        id: "secret",
        status: "completed",
        body: { text: "old private question", assistant: "old private answer", actionIds: [] },
      },
    ]);
    finish();
    await waitFor(() => expect(mocks.agent.checkContext).toHaveBeenCalled());
    expect(screen.queryByText("old private answer")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });
});
