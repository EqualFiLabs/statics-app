import {
  encodeAbiParameters,
  encodeFunctionData,
  decodeFunctionResult,
  getAddress,
  isAddress,
  keccak256,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
  type SignedAuthorization,
} from "viem";
import { recoverAuthorizationAddress } from "viem/utils";

import { bufferedGasLimit, type ProtocolTransactionSendRequest } from "@/lib/protocol/transactions";

/** Calls are executed in order, from the owner's delegated EOA. */
export type StaticsCall = Readonly<{ to: Address; data: Hex; value: bigint }>;

export type AtomicBatch = Readonly<{
  calls: readonly StaticsCall[];
  labels: readonly string[];
}>;

export class AtomicBatchSizeError extends Error {
  constructor() {
    super("This batch exceeds the safe gas limit. Split it into smaller atomic chunks.");
    this.name = "AtomicBatchSizeError";
  }
}

function isGasLimitError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const candidate = current as { message?: unknown; shortMessage?: unknown; cause?: unknown };
    const message = `${candidate.shortMessage ?? ""} ${candidate.message ?? ""}`;
    if (
      /out of gas|exceeds? (?:the )?block gas|gas required exceeds allowance|gas limit reached/i.test(
        message
      )
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

/** Keep every chunk atomic; only a gas-limit failure may trigger a split. */
export async function planAtomicChunks<T, P>(args: {
  items: readonly T[];
  prepare: (items: readonly T[]) => Promise<P>;
}): Promise<readonly Readonly<{ items: readonly T[]; prepared: P }>[]> {
  const chunks: { items: readonly T[]; prepared: P }[] = [];
  let start = 0;
  while (start < args.items.length) {
    let low = 1;
    let high = args.items.length - start;
    let best: { size: number; prepared: P } | null = null;
    while (low <= high) {
      const size = Math.floor((low + high) / 2);
      try {
        const prepared = await args.prepare(args.items.slice(start, start + size));
        best = { size, prepared };
        low = size + 1;
      } catch (error) {
        if (!(error instanceof AtomicBatchSizeError)) throw error;
        high = size - 1;
      }
    }
    if (!best) throw new AtomicBatchSizeError();
    chunks.push({ items: args.items.slice(start, start + best.size), prepared: best.prepared });
    start += best.size;
  }
  return chunks;
}

const EIP_7702_PREFIX = "0xef0100";
export const ERC_7821_BATCH_MODE =
  "0x0100000000000000000000000000000000000000000000000000000000000000" as const;

const erc7821Abi = parseAbi([
  "function execute(bytes32 mode, bytes executionData) payable",
  "function supportsExecutionMode(bytes32 mode) view returns (bool)",
]);

const callsParameter = [
  {
    type: "tuple[]",
    components: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
  },
] as const;

export function delegationFromCode(code: Hex | undefined): Address | null {
  if (!code || code.length !== 48 || !code.toLowerCase().startsWith(EIP_7702_PREFIX)) {
    return null;
  }
  const target = `0x${code.slice(8)}`;
  return isAddress(target) ? getAddress(target) : null;
}

export function assertStaticsBatch(batch: AtomicBatch, allowedTargets: readonly Address[]): void {
  if (batch.calls.length < 1) throw new Error("An atomic batch needs at least one call.");
  if (batch.calls.length !== batch.labels.length)
    throw new Error("Batch labels do not match calls.");
  const allowed = new Set(allowedTargets.map((address) => getAddress(address)));
  for (const call of batch.calls) {
    if (!allowed.has(getAddress(call.to)))
      throw new Error("A batch call targets an unknown contract.");
    if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(call.data)) throw new Error("Invalid batch calldata.");
    if (call.value < 0n) throw new Error("A batch call has a negative native value.");
  }
}

export function encodeErc7821Batch(calls: readonly StaticsCall[]): Hex {
  const executionData = encodeAbiParameters(callsParameter, [
    calls.map((call) => ({ to: call.to, value: call.value, data: call.data })),
  ]);
  return encodeFunctionData({
    abi: erc7821Abi,
    functionName: "execute",
    args: [ERC_7821_BATCH_MODE, executionData],
  });
}

function totalValue(calls: readonly StaticsCall[]): bigint {
  return calls.reduce((sum, call) => sum + call.value, 0n);
}

async function diagnoseCurrentFailure(
  publicClient: PublicClient,
  wallet: Address,
  batch?: AtomicBatch
): Promise<string> {
  if (!batch) return "The Operator batch reverted onchain.";
  for (let index = 0; index < batch.calls.length; index++) {
    const prefix = batch.calls.slice(0, index + 1);
    try {
      await publicClient.call({
        account: wallet,
        to: wallet,
        data: encodeErc7821Batch(prefix),
        value: totalValue(prefix),
      });
    } catch {
      return `The Operator batch failed. Current-state simulation identifies ${batch.labels[index]}.`;
    }
  }
  return "The Operator batch failed. Current-state simulation could not identify a child call.";
}

export type PreparedAtomicBatch = Readonly<{
  accountCode: Hex;
  delegate: Address;
  delegateCodeHash: Hex;
  data: Hex;
  value: bigint;
  gasLimit: bigint;
  needsAuthorization?: true;
}>;

export function delegationMatchesReview(
  reviewed: PreparedAtomicBatch,
  current: PreparedAtomicBatch
): boolean {
  return (
    reviewed.accountCode === current.accountCode &&
    reviewed.delegate === current.delegate &&
    reviewed.delegateCodeHash === current.delegateCodeHash
  );
}

/**
 * A successful eth_call proves the complete ordered operation is valid at the
 * current state. Delegate code hashes are enabled only after separate wallet
 * conformance testing; ERC-7821 support alone is not a production guarantee.
 */
export async function prepareErc7821Batch(args: {
  publicClient: PublicClient;
  wallet: Address;
  batch: AtomicBatch;
  allowedTargets: readonly Address[];
  verifiedDelegateCodeHashes: readonly Hex[];
}): Promise<PreparedAtomicBatch> {
  const { publicClient, wallet, batch } = args;
  assertStaticsBatch(batch, args.allowedTargets);
  const accountCode = await publicClient.getCode({ address: wallet });
  const delegate = delegationFromCode(accountCode);
  if (!accountCode || !delegate) {
    throw new Error("This wallet is not delegated to an EIP-7702 batch executor.");
  }
  const delegateCode = await publicClient.getCode({ address: delegate });
  if (!delegateCode || delegateCode === "0x") {
    throw new Error("The wallet's delegation target has no code.");
  }
  const delegateCodeHash = keccak256(delegateCode);
  if (!args.verifiedDelegateCodeHashes.some((hash) => hash === delegateCodeHash)) {
    throw new Error("This delegate has not passed Statics atomic-batch conformance tests.");
  }
  const supportsBatch = await publicClient.readContract({
    address: wallet,
    abi: erc7821Abi,
    functionName: "supportsExecutionMode",
    args: [ERC_7821_BATCH_MODE],
  });
  if (!supportsBatch) throw new Error("The current delegate does not support ERC-7821 batching.");

  const data = encodeErc7821Batch(batch.calls);
  const value = totalValue(batch.calls);
  try {
    await publicClient.call({ account: wallet, to: wallet, data, value });
  } catch (error) {
    if (isGasLimitError(error)) throw new AtomicBatchSizeError();
    let failing = batch.calls.length - 1;
    // The first reverting prefix identifies the child call that cannot run
    // after its preceding calls. This is only used on a failed simulation.
    for (let index = 0; index < batch.calls.length; index++) {
      try {
        const prefix = batch.calls.slice(0, index + 1);
        await publicClient.call({
          account: wallet,
          to: wallet,
          data: encodeErc7821Batch(prefix),
          value: totalValue(prefix),
        });
      } catch {
        failing = index;
        break;
      }
    }
    throw new Error(`Batch simulation failed at ${batch.labels[failing]}.`, { cause: error });
  }
  let estimate: bigint;
  try {
    estimate = await publicClient.estimateGas({ account: wallet, to: wallet, data, value });
  } catch (error) {
    if (isGasLimitError(error)) throw new AtomicBatchSizeError();
    throw error;
  }
  const block = await publicClient.getBlock();
  if (bufferedGasLimit(estimate) > (block.gasLimit * 8n) / 10n) throw new AtomicBatchSizeError();
  return {
    accountCode,
    delegate,
    delegateCodeHash,
    data,
    value,
    gasLimit: bufferedGasLimit(estimate),
  };
}

/** Preview an undelegated EOA against the exact verified delegate bytecode. */
export async function prepareFresh7702Batch(args: {
  publicClient: PublicClient;
  wallet: Address;
  batch: AtomicBatch;
  allowedTargets: readonly Address[];
  delegate: Address;
  verifiedDelegateCodeHashes: readonly Hex[];
}): Promise<PreparedAtomicBatch> {
  const { publicClient, wallet, batch } = args;
  const delegate = getAddress(args.delegate);
  assertStaticsBatch(batch, args.allowedTargets);
  const accountCode = (await publicClient.getCode({ address: wallet })) ?? "0x";
  if (accountCode !== "0x") {
    throw new Error("This wallet already has code. Its existing delegation must be reviewed.");
  }
  const delegateCode = await publicClient.getCode({ address: delegate });
  if (!delegateCode || delegateCode === "0x") throw new Error("The delegate has no code.");
  const delegateCodeHash = keccak256(delegateCode);
  if (!args.verifiedDelegateCodeHashes.includes(delegateCodeHash)) {
    throw new Error("This delegate has not passed Statics atomic-batch conformance tests.");
  }
  const override = [{ address: wallet, code: `0xef0100${delegate.slice(2)}` as Hex }];
  const support = await publicClient.call({
    account: wallet,
    to: wallet,
    data: encodeFunctionData({
      abi: erc7821Abi,
      functionName: "supportsExecutionMode",
      args: [ERC_7821_BATCH_MODE],
    }),
    stateOverride: override,
  });
  if (
    !support.data ||
    !decodeFunctionResult({
      abi: erc7821Abi,
      functionName: "supportsExecutionMode",
      data: support.data,
    })
  ) {
    throw new Error("The proposed delegate does not support ERC-7821 batching.");
  }
  const data = encodeErc7821Batch(batch.calls);
  const value = totalValue(batch.calls);
  try {
    await publicClient.call({ account: wallet, to: wallet, data, value, stateOverride: override });
  } catch (error) {
    if (isGasLimitError(error)) throw new AtomicBatchSizeError();
    let failing = batch.calls.length - 1;
    for (let index = 0; index < batch.calls.length; index++) {
      const prefix = batch.calls.slice(0, index + 1);
      try {
        await publicClient.call({
          account: wallet,
          to: wallet,
          data: encodeErc7821Batch(prefix),
          value: totalValue(prefix),
          stateOverride: override,
        });
      } catch {
        failing = index;
        break;
      }
    }
    throw new Error(`Batch simulation failed at ${batch.labels[failing]}.`, { cause: error });
  }
  let estimate: bigint;
  try {
    estimate = await publicClient.estimateGas({
      account: wallet,
      to: wallet,
      data,
      value,
      stateOverride: override,
    });
  } catch (error) {
    if (isGasLimitError(error)) throw new AtomicBatchSizeError();
    throw error;
  }
  // EIP-7702 authorization processing adds intrinsic gas to the transaction.
  const gasLimit = bufferedGasLimit(estimate + 50_000n);
  const block = await publicClient.getBlock();
  if (gasLimit > (block.gasLimit * 8n) / 10n) throw new AtomicBatchSizeError();
  return {
    accountCode: "0x",
    delegate,
    delegateCodeHash,
    data,
    value,
    gasLimit,
    needsAuthorization: true,
  };
}

/** Sign and submit one self-executing type-4 transaction via the embedded EOA. */
export async function submitPrivy7702Batch(args: {
  publicClient: PublicClient;
  wallet: Address;
  chainId: number;
  prepared: PreparedAtomicBatch;
  batch?: AtomicBatch;
  signAuthorization: (
    input: {
      contractAddress: Address;
      chainId: number;
      nonce: number;
      executor: "self";
    },
    options: { address: Address }
  ) => Promise<SignedAuthorization>;
  sendAuthorizedTransaction: (request: {
    to: Address;
    data: Hex;
    value: bigint;
    gas: bigint;
    authorizationList: readonly SignedAuthorization[];
  }) => Promise<Hex>;
}): Promise<Hex> {
  const { publicClient, wallet, prepared } = args;
  if (!prepared.needsAuthorization) throw new Error("This batch does not need a new delegation.");
  const code = (await publicClient.getCode({ address: wallet })) ?? "0x";
  if (code !== "0x") throw new Error("Wallet delegation changed. Review the batch again.");
  const delegateCode = await publicClient.getCode({ address: prepared.delegate });
  if (!delegateCode || keccak256(delegateCode) !== prepared.delegateCodeHash) {
    throw new Error("The delegate implementation changed. Review the batch again.");
  }
  const nonce = await publicClient.getTransactionCount({ address: wallet, blockTag: "pending" });
  if (!Number.isSafeInteger(nonce + 1)) throw new Error("Wallet nonce is out of range.");
  const authorization = await args.signAuthorization(
    {
      contractAddress: prepared.delegate,
      chainId: args.chainId,
      nonce: nonce + 1,
      executor: "self",
    },
    { address: wallet }
  );
  const recovered = await recoverAuthorizationAddress({ authorization });
  if (
    getAddress(recovered) !== getAddress(wallet) ||
    getAddress(authorization.address) !== getAddress(prepared.delegate) ||
    authorization.chainId !== args.chainId ||
    authorization.nonce !== nonce + 1
  ) {
    throw new Error("The signed EIP-7702 authorization does not match this wallet and batch.");
  }
  if (
    (await publicClient.getTransactionCount({ address: wallet, blockTag: "pending" })) !== nonce
  ) {
    throw new Error("Wallet nonce changed after authorization. Review the batch again.");
  }
  if (((await publicClient.getCode({ address: wallet })) ?? "0x") !== "0x") {
    throw new Error("Wallet delegation changed after authorization. Review the batch again.");
  }
  const latestDelegateCode = await publicClient.getCode({ address: prepared.delegate });
  if (!latestDelegateCode || keccak256(latestDelegateCode) !== prepared.delegateCodeHash) {
    throw new Error("The delegate implementation changed after authorization. Review again.");
  }
  const hash = await args.sendAuthorizedTransaction({
    to: wallet,
    data: prepared.data,
    value: prepared.value,
    gas: prepared.gasLimit,
    authorizationList: [authorization],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  const mined = await publicClient.getTransaction({ hash });
  if (mined.type !== "eip7702") {
    throw new Error(
      `Wallet submitted ${mined.type} instead of EIP-7702 type 4. Transaction: ${hash}`
    );
  }
  if (receipt.status !== "success") {
    throw new Error(
      `${await diagnoseCurrentFailure(publicClient, wallet, args.batch)} The EIP-7702 delegation may remain active.`
    );
  }
  const finalCode = await publicClient.getCode({ address: wallet });
  if (delegationFromCode(finalCode) !== getAddress(prepared.delegate)) {
    throw new Error(
      `The EIP-7702 transaction confirmed but wallet delegation differs. Transaction: ${hash}`
    );
  }
  return hash;
}

export async function submitErc7821Batch(args: {
  publicClient: PublicClient;
  wallet: Address;
  chainId: number;
  prepared: PreparedAtomicBatch;
  batch?: AtomicBatch;
  sendTransaction: (request: ProtocolTransactionSendRequest) => Promise<Hex>;
}): Promise<Hex> {
  const code = await args.publicClient.getCode({ address: args.wallet });
  if (code !== args.prepared.accountCode) {
    throw new Error("Wallet delegation changed after batch simulation. Review the batch again.");
  }
  const delegateCode = await args.publicClient.getCode({ address: args.prepared.delegate });
  if (!delegateCode || keccak256(delegateCode) !== args.prepared.delegateCodeHash) {
    throw new Error(
      "The delegate implementation changed after simulation. Review the batch again."
    );
  }
  const hash = await args.sendTransaction({
    wallet: args.wallet,
    chainId: args.chainId,
    to: args.wallet,
    data: args.prepared.data,
    value: args.prepared.value,
    gasLimit: args.prepared.gasLimit,
    presentation: {
      action: "Execute Operator batch",
      description: "Run the reviewed Operator calls atomically from your wallet address.",
      buttonText: "Confirm batch",
      contractName: "Your delegated wallet",
    },
  });
  const receipt = await args.publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== "success") {
    throw new Error(await diagnoseCurrentFailure(args.publicClient, args.wallet, args.batch));
  }
  return hash;
}
