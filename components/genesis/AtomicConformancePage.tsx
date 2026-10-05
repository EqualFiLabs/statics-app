"use client";

import { useEffect, useMemo, useState } from "react";
import { useSign7702Authorization } from "@privy-io/react-auth";
import {
  encodeFunctionData,
  formatEther,
  getAddress,
  keccak256,
  parseAbi,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { recoverAuthorizationAddress } from "viem/utils";
import { usePublicClient } from "wagmi";

import artifacts from "@/test/conformance/browser-contracts.json";
import { ROBINHOOD_CALIBUR, ROBINHOOD_CALIBUR_CODE_HASH } from "@/lib/genesis/calibur";
import {
  delegationFromCode,
  encodeErc7821Batch,
  prepareErc7821Batch,
  submitErc7821Batch,
  type AtomicBatch,
  type PreparedAtomicBatch,
} from "@/lib/genesis/atomic-batch";
import { bufferedGasLimit } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";
import { BrowserCaliburActivationPanel } from "@/components/genesis/BrowserCaliburActivationPanel";

const CHAIN_ID = 4663;
const deploymentNames = ["AtomicBatchProbe", "AtomicBatchToken"] as const;
type DeploymentName = (typeof deploymentNames)[number];
type Deployments = Partial<Record<DeploymentName, Address>>;
type RelayInfo = {
  enabled: boolean;
  address?: Address;
  wallet?: Address;
  delegate?: Address;
  balance?: string;
};
const probeAbi = parseAbi([
  "function record() payable",
  "function checkAllowance(address token,address owner,uint256 expected) view",
  "function fail() pure",
  "function lastCaller() view returns (address)",
  "function received() view returns (uint256)",
  "function calls() view returns (uint256)",
]);
const tokenAbi = parseAbi([
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
]);

type Review =
  | { kind: "deploy"; name: DeploymentName; gas: bigint; maxCost: bigint }
  | { kind: "activate"; gas: bigint; maxCost: bigint }
  | { kind: "revoke"; gas: bigint; maxCost: bigint }
  | {
      kind: "first-batch";
      prepared: PreparedAtomicBatch;
      batch: AtomicBatch;
      maxCost: bigint;
    }
  | { kind: "rollback"; gas: bigint; callsBefore: bigint; maxCost: bigint };

function deploymentStorageKey(wallet: Address): string {
  return `statics-atomic-conformance:${CHAIN_ID}:${wallet.toLowerCase()}`;
}

function fixtureBatch(wallet: Address, probe: Address, token: Address): AtomicBatch {
  return {
    calls: [
      {
        to: token,
        data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [probe, 7n] }),
        value: 0n,
      },
      {
        to: probe,
        data: encodeFunctionData({
          abi: probeAbi,
          functionName: "checkAllowance",
          args: [token, wallet, 7n],
        }),
        value: 0n,
      },
      {
        to: probe,
        data: encodeFunctionData({ abi: probeAbi, functionName: "record" }),
        value: 1n,
      },
      {
        to: token,
        data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [probe, 0n] }),
        value: 0n,
      },
    ],
    labels: ["temporary approval", "approval visibility", "owner and value", "approval reset"],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AtomicConformancePage() {
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { signAuthorization } = useSign7702Authorization();
  const wallet = walletState.address ? getAddress(walletState.address) : null;
  const storedDeployments = useMemo((): Deployments => {
    if (!wallet || typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(deploymentStorageKey(wallet));
      return saved ? (JSON.parse(saved) as Deployments) : {};
    } catch {
      return {};
    }
  }, [wallet]);
  const [sessionDeployments, setSessionDeployments] = useState<{
    wallet: Address;
    values: Deployments;
  } | null>(null);
  const deployments =
    sessionDeployments?.wallet === wallet ? sessionDeployments.values : storedDeployments;
  const [review, setReview] = useState<Review | null>(null);
  const [reviewOwner, setReviewOwner] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Hex[]>([]);
  const [relay, setRelay] = useState<RelayInfo | null>(null);

  useEffect(() => {
    fetch("/api/atomic-conformance/relay", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: RelayInfo) => setRelay(result))
      .catch(() => setRelay({ enabled: false }));
  }, []);

  const activeReview = reviewOwner === wallet ? review : null;

  const ready =
    wallet !== null &&
    publicClient !== undefined &&
    walletState.walletKind === "embedded" &&
    walletState.isTargetChain &&
    walletState.targetChainId === CHAIN_ID;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      if (!ready || !publicClient || !wallet) {
        throw new Error("Connect the Privy embedded wallet on Robinhood Chain 4663 first.");
      }
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const checkedDeployments = () => {
    const probe = deployments.AtomicBatchProbe;
    const token = deployments.AtomicBatchToken;
    if (!probe || !token) throw new Error("Deploy both probe contracts first.");
    return { delegate: ROBINHOOD_CALIBUR, probe, token };
  };

  const provider = async () => {
    const connected = await walletState.getEthereumProvider();
    if (!connected) throw new Error("Privy Ethereum provider is unavailable.");
    return connected;
  };

  const checkFunds = async (maxCost: bigint) => {
    if (!publicClient || !wallet) return;
    const balance = await publicClient.getBalance({ address: wallet });
    if (balance < maxCost) {
      throw new Error(
        `Balance ${formatEther(balance)} ETH is below estimated maximum ${formatEther(maxCost)} ETH.`
      );
    }
  };

  const reviewDeployment = (name: DeploymentName) =>
    run(async () => {
      const bytecode = artifacts[name].bytecode as Hex;
      const estimate = await publicClient!.estimateGas({ account: wallet!, data: bytecode });
      const gas = bufferedGasLimit(estimate);
      const maxCost = gas * (await publicClient!.getGasPrice());
      await checkFunds(maxCost);
      setReview({ kind: "deploy", name, gas, maxCost });
      setReviewOwner(wallet);
      setMessage(`Review the ${name} deployment. The wallet will request one transaction.`);
    });

  const deploy = (name: DeploymentName, gas: bigint) =>
    run(async () => {
      const hash = (await (
        await provider()
      ).request({
        method: "eth_sendTransaction",
        params: [{ from: wallet, data: artifacts[name].bytecode, gas: toHex(gas) }],
      })) as Hex;
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success" || !receipt.contractAddress) {
        throw new Error(`${name} deployment did not succeed. Transaction: ${hash}`);
      }
      const next = { ...deployments, [name]: getAddress(receipt.contractAddress) };
      setSessionDeployments({ wallet: wallet!, values: next });
      localStorage.setItem(deploymentStorageKey(wallet!), JSON.stringify(next));
      setConfirmed((prior) => [...prior, hash]);
      setReview(null);
      setMessage(`${name} deployed at ${receipt.contractAddress}`);
    });

  const reviewActivation = () =>
    run(async () => {
      const { delegate } = checkedDeployments();
      if (!relay?.enabled || !relay.address || !relay.balance || relay.wallet !== wallet) {
        throw new Error("The local test relayer is not configured for this wallet.");
      }
      if (relay.delegate !== delegate) throw new Error("Relayer delegate differs from Calibur.");
      const code = await publicClient!.getCode({ address: wallet! });
      if (code && code !== "0x") throw new Error("This wallet is already delegated.");
      const gas = 100_000n;
      const maxCost = gas * (await publicClient!.estimateFeesPerGas()).maxFeePerGas;
      if (BigInt(relay.balance) < maxCost) {
        throw new Error(`Fund the test relayer ${relay.address} with ETH on Robinhood Chain.`);
      }
      setReview({ kind: "activate", gas, maxCost });
      setReviewOwner(wallet);
      setMessage(
        "Review persistent delegation. Your Privy wallet signs an authorization; the local relayer pays gas to activate it. No batch executes in this transaction."
      );
    });

  const submitActivation = () =>
    run(async () => {
      const { delegate } = checkedDeployments();
      if (!relay?.address || relay.wallet !== wallet || relay.delegate !== delegate) {
        throw new Error("Relayer configuration changed. Review again.");
      }
      const nonce = await publicClient!.getTransactionCount({
        address: wallet!,
        blockTag: "pending",
      });
      const authorization = await signAuthorization(
        { contractAddress: delegate, chainId: CHAIN_ID, nonce, executor: relay.address },
        { address: wallet! }
      );
      if (getAddress(await recoverAuthorizationAddress({ authorization })) !== wallet) {
        throw new Error("The authorization was signed by a different wallet.");
      }
      const response = await fetch("/api/atomic-conformance/relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "activate",
          wallet,
          authorization: {
            address: authorization.address,
            chainId: authorization.chainId,
            nonce: authorization.nonce,
            r: authorization.r,
            s: authorization.s,
            yParity: authorization.yParity,
          },
        }),
      });
      const result = (await response.json()) as { hash?: Hex; error?: string };
      if (!response.ok || !result.hash) throw new Error(result.error ?? "Relay activation failed.");
      setConfirmed((prior) => [...prior, result.hash!]);
      setReview(null);
      setMessage(`Delegation activated for ${wallet}. Transaction: ${result.hash}`);
    });

  const reviewRevocation = () =>
    run(async () => {
      const { delegate } = checkedDeployments();
      if (!relay?.enabled || !relay.address || !relay.balance || relay.wallet !== wallet) {
        throw new Error("The local test relayer is not configured for this wallet.");
      }
      const code = await publicClient!.getCode({ address: wallet! });
      if (delegationFromCode(code) !== delegate) {
        throw new Error("This wallet is not delegated to Calibur.");
      }
      const gas = 100_000n;
      const maxCost = gas * (await publicClient!.estimateFeesPerGas()).maxFeePerGas;
      if (BigInt(relay.balance) < maxCost) {
        throw new Error(`Fund the test relayer ${relay.address} with ETH on Robinhood Chain.`);
      }
      setReview({ kind: "revoke", gas, maxCost });
      setReviewOwner(wallet);
      setMessage(
        "Review removal of the test delegation. The relayer pays gas; your wallet signs a revocation authorization."
      );
    });

  const submitRevocation = () =>
    run(async () => {
      const { delegate } = checkedDeployments();
      if (!relay?.address || relay.wallet !== wallet || relay.delegate !== delegate) {
        throw new Error("Relayer configuration changed. Review again.");
      }
      const nonce = await publicClient!.getTransactionCount({
        address: wallet!,
        blockTag: "pending",
      });
      const authorization = await signAuthorization(
        { contractAddress: zeroAddress, chainId: CHAIN_ID, nonce, executor: relay.address },
        { address: wallet! }
      );
      if (getAddress(await recoverAuthorizationAddress({ authorization })) !== wallet) {
        throw new Error("The revocation was signed by a different wallet.");
      }
      const response = await fetch("/api/atomic-conformance/relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "revoke",
          wallet,
          authorization: {
            address: authorization.address,
            chainId: authorization.chainId,
            nonce: authorization.nonce,
            r: authorization.r,
            s: authorization.s,
            yParity: authorization.yParity,
          },
        }),
      });
      const result = (await response.json()) as { hash?: Hex; error?: string };
      if (!response.ok || !result.hash) throw new Error(result.error ?? "Relay revocation failed.");
      setConfirmed((prior) => [...prior, result.hash!]);
      setReview(null);
      setMessage(`Test delegation removed from ${wallet}. Transaction: ${result.hash}`);
    });

  const reviewFirstBatch = () =>
    run(async () => {
      const { delegate, probe, token } = checkedDeployments();
      for (const address of [delegate, probe, token]) {
        const code = await publicClient!.getCode({ address });
        if (!code || code === "0x") {
          throw new Error(`Fixture code missing at ${address}.`);
        }
      }
      const delegateCode = await publicClient!.getCode({ address: delegate });
      if (!delegateCode || keccak256(delegateCode) !== ROBINHOOD_CALIBUR_CODE_HASH) {
        throw new Error("Calibur code differs from the verified Robinhood deployment.");
      }
      const batch = fixtureBatch(wallet!, probe, token);
      const code = await publicClient!.getCode({ address: wallet! });
      if (delegationFromCode(code) !== delegate) {
        throw new Error("Activate this wallet's delegation before reviewing the atomic batch.");
      }
      const prepared = await prepareErc7821Batch({
        publicClient: publicClient!,
        wallet: wallet!,
        batch,
        allowedTargets: [probe, token],
        verifiedDelegateCodeHashes: [ROBINHOOD_CALIBUR_CODE_HASH],
      });
      const maxCost = prepared.gasLimit * (await publicClient!.getGasPrice()) + prepared.value;
      await checkFunds(maxCost);
      setReview({ kind: "first-batch", prepared, batch, maxCost });
      setReviewOwner(wallet);
      setMessage(
        "Review the atomic batch from this delegated Privy wallet. It sends 1 wei to the probe."
      );
    });

  const submitFirstBatch = (prepared: PreparedAtomicBatch, batch: AtomicBatch) =>
    run(async () => {
      const { delegate, probe, token } = checkedDeployments();
      const [receivedBefore, callsBefore] = await Promise.all([
        publicClient!.readContract({ address: probe, abi: probeAbi, functionName: "received" }),
        publicClient!.readContract({ address: probe, abi: probeAbi, functionName: "calls" }),
      ]);
      const hash = await submitErc7821Batch({
        publicClient: publicClient!,
        wallet: wallet!,
        chainId: CHAIN_ID,
        prepared,
        batch,
        sendTransaction: walletState.sendEvmTransaction,
      });
      const [code, caller, received, calls, allowance] = await Promise.all([
        publicClient!.getCode({ address: wallet! }),
        publicClient!.readContract({ address: probe, abi: probeAbi, functionName: "lastCaller" }),
        publicClient!.readContract({ address: probe, abi: probeAbi, functionName: "received" }),
        publicClient!.readContract({ address: probe, abi: probeAbi, functionName: "calls" }),
        publicClient!.readContract({
          address: token,
          abi: tokenAbi,
          functionName: "allowance",
          args: [wallet!, probe],
        }),
      ]);
      if (
        delegationFromCode(code) !== delegate ||
        caller !== wallet ||
        received !== receivedBefore + 1n ||
        calls !== callsBefore + 1n ||
        allowance !== 0n
      ) {
        throw new Error(
          `Transaction ${hash} confirmed, but one or more conformance checks failed. Inspect the chain state.`
        );
      }
      setConfirmed((prior) => [...prior, hash]);
      setReview(null);
      setMessage(
        `PASS: Privy delegated-wallet atomic batch, owner caller, 1 wei value, visible temporary approval, and approval reset. Transaction: ${hash}`
      );
    });

  const reviewRollback = () =>
    run(async () => {
      const { delegate, probe, token } = checkedDeployments();
      const code = await publicClient!.getCode({ address: wallet! });
      if (delegationFromCode(code) !== delegate)
        throw new Error("Wallet is not delegated to Calibur.");
      const callsBefore = await publicClient!.readContract({
        address: probe,
        abi: probeAbi,
        functionName: "calls",
      });
      const gas = 350_000n;
      const maxCost = gas * (await publicClient!.getGasPrice());
      await checkFunds(maxCost);
      const allowance = await publicClient!.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "allowance",
        args: [wallet!, probe],
      });
      if (allowance !== 0n) throw new Error("Approval must be zero before the rollback test.");
      setReview({ kind: "rollback", gas, callsBefore, maxCost });
      setReviewOwner(wallet);
      setMessage(
        "Review the rollback probe. This transaction is designed to revert and consume gas; its earlier approval and record calls must also roll back."
      );
    });

  const submitRollback = (gas: bigint, callsBefore: bigint) =>
    run(async () => {
      const { probe, token } = checkedDeployments();
      const data = encodeErc7821Batch([
        {
          to: token,
          data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [probe, 9n] }),
          value: 0n,
        },
        {
          to: probe,
          data: encodeFunctionData({ abi: probeAbi, functionName: "record" }),
          value: 0n,
        },
        { to: probe, data: encodeFunctionData({ abi: probeAbi, functionName: "fail" }), value: 0n },
      ]);
      const startingBlock = await publicClient!.getBlockNumber();
      const startingNonce = await publicClient!.getTransactionCount({ address: wallet! });
      let hash: Hex;
      try {
        hash = (await (
          await provider()
        ).request({
          method: "eth_sendTransaction",
          params: [{ from: wallet, to: wallet, data, gas: toHex(gas), value: "0x0" }],
        })) as Hex;
      } catch (error) {
        // Privy rejects the provider promise when the intentionally reverting transaction is mined.
        // Recover only this wallet's exact transaction, then verify its receipt and state below.
        const latestBlock = await publicClient!.getBlockNumber();
        const latestNonce = await publicClient!.getTransactionCount({ address: wallet! });
        if (latestNonce !== startingNonce + 1 || latestBlock - startingBlock > 256n) throw error;
        let recovered: Hex | undefined;
        for (let blockNumber = latestBlock; blockNumber >= startingBlock; blockNumber--) {
          const block = await publicClient!.getBlock({ blockNumber, includeTransactions: true });
          const transaction = block.transactions.find(
            (candidate) =>
              typeof candidate !== "string" &&
              candidate.from.toLowerCase() === wallet!.toLowerCase() &&
              candidate.nonce === startingNonce &&
              candidate.to?.toLowerCase() === wallet!.toLowerCase() &&
              candidate.input.toLowerCase() === data.toLowerCase()
          );
          if (transaction && typeof transaction !== "string") {
            recovered = transaction.hash;
            break;
          }
        }
        if (!recovered) throw error;
        hash = recovered;
      }
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      const [allowance, callsAfter] = await Promise.all([
        publicClient!.readContract({
          address: token,
          abi: tokenAbi,
          functionName: "allowance",
          args: [wallet!, probe],
        }),
        publicClient!.readContract({ address: probe, abi: probeAbi, functionName: "calls" }),
      ]);
      if (receipt.status !== "reverted" || allowance !== 0n || callsAfter !== callsBefore) {
        throw new Error(`Rollback conformance failed. Inspect transaction ${hash}.`);
      }
      setConfirmed((prior) => [...prior, hash]);
      setReview(null);
      setMessage(
        `PASS: later-call revert rolled back earlier approval and record. Transaction: ${hash}`
      );
    });

  return (
    <main className="wallet-surface" style={{ padding: 24, maxWidth: 920 }}>
      <h1>Atomic batch conformance</h1>
      <p>
        Calibur conformance probe for Robinhood Chain 4663. Transactions use real ETH. Relay
        activation and the first batch are separate transactions; delegation persists on this test
        wallet.
      </p>
      <p>
        Wallet: {wallet ?? "Not connected"} · Type: {walletState.walletKind ?? "none"} · Network:{" "}
        {walletState.chainId ?? "unknown"}
      </p>
      {!ready && (
        <p>Connect the Privy embedded wallet and switch to Robinhood Chain before continuing.</p>
      )}
      {walletState.walletKind === "embedded" && !walletState.isTargetChain && (
        <button type="button" disabled={busy} onClick={() => void walletState.switchNetwork()}>
          Switch to Robinhood Chain
        </button>
      )}
      {deploymentNames.map((name) => (
        <section key={name} style={{ marginBlock: 18 }}>
          <strong>{name}</strong> · {deployments[name] ?? "not deployed"}
          {!deployments[name] && (
            <button
              type="button"
              disabled={!ready || busy}
              onClick={() => void reviewDeployment(name)}
            >
              Estimate deployment
            </button>
          )}
        </section>
      ))}
      <p>Calibur v1.1.0 delegate: {ROBINHOOD_CALIBUR}</p>
      {relay?.enabled && (
        <section style={{ marginBlock: 18 }}>
          <p>
            Local activation relayer: {relay.address} · Balance:{" "}
            {formatEther(BigInt(relay.balance ?? "0"))} ETH
          </p>
          <button
            type="button"
            disabled={!ready || busy || !deploymentNames.every((name) => deployments[name])}
            onClick={() => void reviewActivation()}
          >
            Review relay activation
          </button>{" "}
          <button
            type="button"
            disabled={!ready || busy || !deploymentNames.every((name) => deployments[name])}
            onClick={() => void reviewRevocation()}
          >
            Review test delegation removal
          </button>
        </section>
      )}
      <BrowserCaliburActivationPanel />
      <button
        type="button"
        disabled={!ready || busy || !deploymentNames.every((name) => deployments[name])}
        onClick={() => void reviewFirstBatch()}
      >
        Review delegated atomic batch
      </button>{" "}
      <button
        type="button"
        disabled={!ready || busy || !deploymentNames.every((name) => deployments[name])}
        onClick={() => void reviewRollback()}
      >
        Review rollback probe
      </button>
      {activeReview && (
        <section style={{ border: "1px solid currentColor", padding: 16, marginBlock: 20 }}>
          <h2>Transaction review</h2>
          <p>
            {activeReview.kind === "deploy"
              ? `Deploy ${activeReview.name}`
              : activeReview.kind === "activate"
                ? "Sign delegation; local relayer pays for activation"
                : activeReview.kind === "revoke"
                  ? "Sign removal of the test delegation; local relayer pays"
                  : activeReview.kind === "first-batch"
                    ? "Send one atomic batch from this delegated wallet"
                    : "Send one intentionally reverting atomic batch"}
          </p>
          <p>
            Gas limit:{" "}
            {activeReview.kind === "first-batch"
              ? activeReview.prepared.gasLimit.toString()
              : activeReview.gas.toString()}
          </p>
          <p>
            Approximate maximum at current fee cap: {formatEther(activeReview.maxCost)} ETH. The
            wallet or relayer may show a different estimate when submitted.
          </p>
          {activeReview.kind === "first-batch" && (
            <p>
              Delegate: {activeReview.prepared.delegate} · Code hash:{" "}
              {activeReview.prepared.delegateCodeHash}. Delegation remains on this wallet.
            </p>
          )}
          {(activeReview.kind === "activate" || activeReview.kind === "revoke") && (
            <p>
              {activeReview.kind === "activate"
                ? `Delegate: ${ROBINHOOD_CALIBUR}. Delegation persists on this wallet.`
                : "The test delegation will be removed from this wallet."}{" "}
              The relayer pays this fee.
            </p>
          )}
          {activeReview.kind === "rollback" && (
            <p>This transaction is expected to revert and still charge gas.</p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void (activeReview.kind === "deploy"
                ? deploy(activeReview.name, activeReview.gas)
                : activeReview.kind === "activate"
                  ? submitActivation()
                  : activeReview.kind === "revoke"
                    ? submitRevocation()
                    : activeReview.kind === "first-batch"
                      ? submitFirstBatch(activeReview.prepared, activeReview.batch)
                      : submitRollback(activeReview.gas, activeReview.callsBefore))
            }
          >
            Open wallet confirmation
          </button>{" "}
          <button type="button" disabled={busy} onClick={() => setReview(null)}>
            Cancel
          </button>
        </section>
      )}
      {busy && <p>Waiting for wallet or chain confirmation…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {confirmed.length > 0 && (
        <p>
          Transactions:{" "}
          {confirmed.map((hash) => (
            <span key={hash}>
              <a
                href={`https://robinhoodchain.blockscout.com/tx/${hash}`}
                target="_blank"
                rel="noreferrer"
              >
                {hash.slice(0, 12)}…
              </a>{" "}
            </span>
          ))}
        </p>
      )}
    </main>
  );
}
