"use client";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatEther, parseEther } from "viem";
import type { Message, Workflow } from "@equalfi/agent-client";
import { useAgent } from "@/providers/agent-context";
import { useWalletState } from "@/providers/wallet-context";
import { useDeployment } from "@/providers/deployment-context";
import { getTransactionExplorerUrl } from "@/lib/wallet-config";
import styles from "./agent.module.css";

const messages: Record<string, string> = {
  grant_inactive: "Enable a staking grant or use manual signing.",
  approval_not_granted: "This action needs permission for an exact approval.",
  aggregate_budget_exceeded: "This action exceeds your remaining budget.",
  plan_expired: "Refresh the preparation before continuing.",
  outcome_unverified: "The receipt is available; the protocol outcome is still being verified.",
  submission_unresolved: "Submission is unresolved. Recovery is checking the existing transaction.",
  wallet_has_external_pending_transaction:
    "Another wallet transaction is pending. Wait for it to settle.",
  insufficient_statics: "There is not enough STATICS for this stake.",
  position_not_owned: "This wallet does not own that position.",
};
function explain(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return messages[text] ?? text.replaceAll("_", " ");
}
const terminal = (w: Workflow) => ["completed", "cancelled", "failed"].includes(w.status);

function ActionCard({ action }: { action: Workflow }) {
  const agent = useAgent(),
    wallet = useWalletState();
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError(null);
    try {
      await fn();
      await agent.refresh();
    } catch (e) {
      setError(explain(e));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };
  const pending = ["running", "reconciling"].includes(action.status);
  const grant = useQuery({
    queryKey: ["agent-policy", agent.identityKey, wallet.address, wallet.targetChainId],
    enabled: Boolean(agent.client),
    queryFn: () => agent.client!.policy(),
  });
  return (
    <article className={styles.card} aria-busy={Boolean(busy) || pending}>
      <h3>
        Stake {formatEther(BigInt(action.plan.input.amount))} STATICS into position{" "}
        {action.plan.input.positionId}
      </h3>
      <p role="status">
        {busy ?? action.status.replaceAll("_", " ")}
        {pending ? "…" : ""}
      </p>
      <p>
        Maximum network fee: {formatEther(BigInt(action.plan.input.maxFeePerTransaction))} ETH per
        transaction.
      </p>
      <ol>
        {action.plan.steps.map((step) => {
          const attempt = action.attempts.find((a) => a.stepId === step.id);
          return (
            <li key={step.id}>
              {step.kind === "approval" ? "Exact STATICS approval" : "Stake"}:{" "}
              {attempt?.status ?? "not started"}
              {attempt?.hash && (
                <a
                  href={getTransactionExplorerUrl(action.plan.chainId, attempt.hash) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  {" "}
                  View transaction
                </a>
              )}
            </li>
          );
        })}
      </ol>
      {action.reason && (
        <p role="status">{messages[action.reason] ?? action.reason.replaceAll("_", " ")}</p>
      )}
      {!terminal(action) && !pending && action.status !== "awaiting_manual" && (
        <div className={styles.actions}>
          <button
            disabled={Boolean(busy) || !wallet.isTargetChain}
            onClick={() =>
              void run("Preparing wallet signature", () => agent.client!.execute(action, "manual"))
            }
          >
            Review and sign manually
          </button>
          {wallet.walletKind === "embedded" && grant.data?.grant?.body.active && (
            <button
              disabled={Boolean(busy) || !wallet.isTargetChain}
              onClick={() =>
                void run("Starting delegated action", () =>
                  agent.client!.execute(action, "delegated")
                )
              }
            >
              Execute within my grant
            </button>
          )}
          <button
            disabled={Boolean(busy)}
            onClick={() =>
              void run("Refreshing preparation", () => agent.client!.reprepare(action.id))
            }
          >
            Refresh preparation
          </button>
        </div>
      )}
      {action.status === "awaiting_manual" && (
        <button
          disabled={Boolean(busy) || !wallet.isTargetChain}
          onClick={() => void run("Waiting for wallet signature", () => agent.signNext(action))}
        >
          Sign{" "}
          {action.attempts.find((a) => a.status === "reserved")?.stepId.startsWith("approval")
            ? "exact approval"
            : "stake"}
        </button>
      )}
      {!terminal(action) && !action.cancelRequested && (
        <button
          disabled={Boolean(busy)}
          onClick={() => void run("Stopping future steps", () => agent.client!.cancel(action.id))}
        >
          Stop future steps
        </button>
      )}
      {action.cancelRequested && (
        <p>Future steps are stopped. Submitted transactions continue reconciling.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}

export function AgentPanel(props: { positionId?: string; amount?: string }) {
  const agent = useAgent(),
    wallet = useWalletState(),
    { active } = useDeployment();
  return (
    <AgentPanelSession
      key={`${agent.sessionKey}:${wallet.address}:${wallet.targetChainId}:${wallet.authenticated}:${active.descriptor.deploymentId}`}
      {...props}
    />
  );
}
function AgentPanelSession({ positionId = "", amount }: { positionId?: string; amount?: string }) {
  const agent = useAgent(),
    wallet = useWalletState(),
    { active } = useDeployment();
  const [position, setPosition] = useState(positionId),
    [value, setValue] = useState(() =>
      amount && /^\d+$/.test(amount) ? formatEther(BigInt(amount)) : ""
    ),
    [fee, setFee] = useState("");
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const [daily, setDaily] = useState(""),
    [dailyFee, setDailyFee] = useState(""),
    [perAction, setPerAction] = useState(""),
    [positions, setPositions] = useState(""),
    [expiry, setExpiry] = useState(""),
    [approvals, setApprovals] = useState(false);
  const [conversation, setConversation] = useState<string | null>(null),
    [chatText, setChatText] = useState(""),
    [chatMessages, setChatMessages] = useState<Message[]>([]);
  const requestLock = useRef(false),
    live = useRef(true);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const checkCurrent = () => {
    if (!live.current) throw new Error("Wallet or deployment changed.");
    agent.checkContext();
  };
  const policy = useQuery({
    queryKey: ["agent-policy", agent.identityKey, wallet.address, wallet.targetChainId],
    enabled: Boolean(agent.client),
    queryFn: () => agent.client!.policy(),
    retry: false,
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      const key = `statics:agent-conversation:${agent.identityKey}`;
      setConversation(window.localStorage.getItem(key));
      setChatMessages([]);
    }, 0);
    return () => clearTimeout(timer);
  }, [agent.identityKey]);
  useEffect(() => {
    let disposed = false;
    if (conversation && agent.client)
      void agent.client
        .messages(conversation)
        .then((items) => {
          if (!disposed) setChatMessages(items);
        })
        .catch((e: unknown) => {
          if (disposed) return;
          if (e instanceof Error && e.message === "conversation_not_found") {
            window.localStorage.removeItem(`statics:agent-conversation:${agent.identityKey}`);
            setConversation(null);
          } else setError(explain(e));
        });
    return () => {
      disposed = true;
    };
  }, [conversation, agent.client, agent.identityKey]);
  const run = async (label: string, fn: () => Promise<void>) => {
    if (requestLock.current) return;
    requestLock.current = true;
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      checkCurrent();
      await fn();
      checkCurrent();
      await agent.refresh();
      await policy.refetch();
    } catch (e) {
      setError(explain(e));
    } finally {
      requestLock.current = false;
      setBusy(null);
    }
  };
  if (!wallet.authenticated || !wallet.address)
    return (
      <button className="ui-button ui-button--primary" onClick={wallet.login}>
        Sign in to use the agent
      </button>
    );
  if (!wallet.isTargetChain)
    return (
      <button
        className="ui-button ui-button--primary"
        disabled={wallet.busyAction !== null}
        onClick={() => void wallet.switchNetwork()}
      >
        Switch to {wallet.networkName}
      </button>
    );
  if (!agent.client) return <p role="status">Connecting to the agent…</p>;
  const client = agent.client;
  return (
    <div className={styles.panel}>
      <section className={styles.card}>
        <h2>Prepare a stake</h2>
        <label>
          Position ID
          <input
            inputMode="numeric"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </label>
        <label>
          Amount (STATICS)
          <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label>
          Maximum network fee per transaction (ETH)
          <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
        <button
          disabled={Boolean(busy)}
          onClick={() =>
            void run("Preparing proposal", async () => {
              const input = {
                kind: "statics.stake-existing" as const,
                version: 1 as const,
                deploymentId: active.descriptor.deploymentId,
                wallet: wallet.address!.toLowerCase(),
                positionId: position,
                amount: String(parseEther(value)),
                maxFeePerTransaction: String(parseEther(fee)),
              };
              const storageKey = `statics:agent-intent:${agent.identityKey}`;
              const previous = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as {
                key: string;
                input: string;
                id?: string;
              } | null;
              const serialized = JSON.stringify(input);
              const oldAction =
                previous?.input === serialized && previous.id
                  ? await client.status(previous.id)
                  : null;
              checkCurrent();
              const intentKey =
                previous?.input === serialized && (!oldAction || !terminal(oldAction))
                  ? previous.key
                  : crypto.randomUUID();
              window.localStorage.setItem(
                storageKey,
                JSON.stringify({ key: intentKey, input: serialized })
              );
              const proposal = await client.prepare(intentKey, input);
              window.localStorage.setItem(
                storageKey,
                JSON.stringify({ key: intentKey, input: serialized, id: proposal.id })
              );
              setNotice("Proposal prepared. Review its steps in activity.");
            })
          }
        >
          {busy === "Preparing proposal" ? "Preparing…" : "Prepare proposal"}
        </button>
      </section>
      <section className={styles.card}>
        <h2>Execution limits</h2>
        <p>
          Global limits apply across connected apps. Signing access and app grants are managed
          separately.
        </p>
        <p>
          Global execution:{" "}
          {policy.data?.global?.body.paused
            ? "paused"
            : policy.data?.global
              ? "enabled"
              : "limits required"}
          . Statics grant: {policy.data?.grant?.body.active ? "enabled" : "disabled"}.
        </p>
        <label>
          Daily principal limit (STATICS)
          <input inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />
        </label>
        <label>
          Daily network fee limit (ETH)
          <input
            inputMode="decimal"
            value={dailyFee}
            onChange={(e) => setDailyFee(e.target.value)}
          />
        </label>
        <button
          disabled={Boolean(busy)}
          onClick={() =>
            void run("Saving global limits", async () => {
              await client.setGlobal({
                wallet: wallet.address!.toLowerCase(),
                chainId: wallet.targetChainId,
                paused: false,
                dailyPrincipal: String(parseEther(daily)),
                dailyFees: String(parseEther(dailyFee)),
              });
              setNotice("Global limits saved.");
            })
          }
        >
          Save global limits and enable execution
        </button>
        {policy.data?.global && (
          <button
            disabled={Boolean(busy)}
            onClick={() =>
              void run("Pausing execution", async () => {
                await client.setGlobal({ ...policy.data!.global!.body, paused: true });
                setNotice("Global execution paused.");
              })
            }
          >
            Pause all agent execution
          </button>
        )}
        {wallet.walletKind === "embedded" && (
          <>
            <h3>Statics staking grant</h3>
            <label>
              Allowed position IDs (comma separated)
              <input value={positions} onChange={(e) => setPositions(e.target.value)} />
            </label>
            <label>
              Principal limit per action (STATICS)
              <input
                inputMode="decimal"
                value={perAction}
                onChange={(e) => setPerAction(e.target.value)}
              />
            </label>
            <label>
              Grant duration (hours)
              <input
                inputMode="numeric"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={approvals}
                onChange={(e) => setApprovals(e.target.checked)}
              />
              Allow exact approvals needed for these stakes
            </label>
            <button
              disabled={Boolean(busy)}
              onClick={() =>
                void run("Enabling staking grant", async () => {
                  const hours = Number(expiry);
                  if (!Number.isFinite(hours) || hours <= 0 || hours > 8760)
                    throw new Error("Enter a grant duration between 0 and 8760 hours.");
                  await agent.setupSigner();
                  checkCurrent();
                  await client.setGrant({
                    wallet: wallet.address!.toLowerCase(),
                    chainId: wallet.targetChainId,
                    deploymentId: active.descriptor.deploymentId,
                    positions: positions.split(",").map((p) => p.trim()),
                    exactApprovals: approvals,
                    maxPrincipalPerAction: String(parseEther(perAction)),
                    dailyPrincipal: String(parseEther(daily)),
                    dailyFees: String(parseEther(dailyFee)),
                    expiresAt: Date.now() + hours * 3_600_000,
                  });
                  setNotice("Statics staking grant enabled.");
                })
              }
            >
              Enable staking within these limits
            </button>
            <button
              disabled={Boolean(busy)}
              onClick={() =>
                void run("Revoking Statics grant", async () => {
                  await client.revoke();
                  setNotice("Statics grant revoked.");
                })
              }
            >
              Revoke Statics grant
            </button>
            <button
              disabled={Boolean(busy)}
              onClick={() =>
                void run("Removing all wallet signers", async () => {
                  const current = policy.data?.global?.body;
                  if (current) await client.setGlobal({ ...current, paused: true });
                  checkCurrent();
                  await agent.removeSigner();
                  setNotice("Wallet signer access removed.");
                })
              }
            >
              Pause and remove all wallet signers
            </button>
          </>
        )}
      </section>
      <section className={styles.card}>
        <h2>Ask the agent</h2>
        <p>
          For automatic execution within your grant, use: Stake 100 STATICS in position 42 with
          maximum network fee 0.001 ETH per transaction. Other wording produces a proposal for
          review.
        </p>
        {chatMessages.map((message) => (
          <div key={message.id}>
            <p>{message.body.text}</p>
            <p>
              {message.body.assistant ??
                "Request in progress. Check activity for any prepared action."}
            </p>
          </div>
        ))}
        <label>
          Message
          <textarea
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            maxLength={8000}
          />
        </label>
        <button
          disabled={Boolean(busy) || !chatText.trim()}
          onClick={() =>
            void run("Sending message", async () => {
              let id = conversation;
              if (!id) {
                id = (await client.conversation()).id;
                checkCurrent();
                window.localStorage.setItem(`statics:agent-conversation:${agent.identityKey}`, id);
                setConversation(id);
              }
              const key = `statics:agent-message:${agent.identityKey}:${id}`,
                old = JSON.parse(window.localStorage.getItem(key) ?? "null") as {
                  key: string;
                  text: string;
                } | null;
              const intent = old?.text === chatText ? old.key : crypto.randomUUID();
              window.localStorage.setItem(key, JSON.stringify({ key: intent, text: chatText }));
              await client.chat(id, intent, chatText);
              checkCurrent();
              window.localStorage.removeItem(key);
              setChatMessages(await client.messages(id));
              setChatText("");
            })
          }
        >
          {busy === "Sending message" ? "Working…" : "Send"}
        </button>
      </section>
      {notice && <p role="status">{notice}</p>}
      {(error || agent.error) && <p role="alert">{error ?? explain(agent.error)}</p>}
      <section>
        <h2>Agent activity</h2>
        <button
          disabled={Boolean(busy)}
          onClick={() => void run("Loading history", () => agent.loadHistory())}
        >
          Load older completed actions
        </button>
        {agent.workflows
          .filter(
            (a) =>
              a.identity.wallet === wallet.address!.toLowerCase() &&
              a.plan.chainId === wallet.targetChainId
          )
          .map((action) => (
            <ActionCard key={action.id} action={action} />
          ))}
      </section>
    </div>
  );
}
