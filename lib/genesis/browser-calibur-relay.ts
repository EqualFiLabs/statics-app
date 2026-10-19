import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  keccak256,
  parseEther,
  parseTransaction,
  recoverTransactionAddress,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
  type SignedAuthorization,
  type TransactionSerializedEIP7702,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { recoverAuthorizationAddress } from "viem/utils";

import { delegationFromCode } from "@/lib/genesis/atomic-batch";
import {
  REVOCABLE_ROBINHOOD_CALIBUR_DELEGATES,
  ROBINHOOD_CALIBUR,
  ROBINHOOD_CALIBUR_CODE_HASH,
} from "@/lib/genesis/calibur";
import { robinhoodMainnet } from "@/lib/wallet-config";

const chainId = 4663;
const activationGas = 100_000n;
const refundGasReserve = 40_000n;
const minimumFunding = parseEther("0.00001");
const maximumFunding = parseEther("0.00005");

async function relayerFees(publicClient: PublicClient) {
  // viem's generic priority-fee estimate floors at 1 gwei on some RPCs,
  // far above Robinhood's actual gas price. Bound the bid to this chain's
  // current gas price and check the resulting maximum before funding.
  const [gasPrice, block] = await Promise.all([
    publicClient.getGasPrice(),
    publicClient.getBlock(),
  ]);
  const priority = gasPrice / 4n > 0n ? gasPrice / 4n : 1n;
  const base = block.baseFeePerGas ?? gasPrice;
  const maxFeePerGas = gasPrice * 2n > base * 2n + priority ? gasPrice * 2n : base * 2n + priority;
  return { maxFeePerGas, maxPriorityFeePerGas: priority };
}

type RelaySession = {
  privateKey: Hex;
};

export type BrowserRelayQuote = Readonly<{
  relayer: Address;
  fundingAmount: bigint;
  existingBalance: bigint;
  maximumActivationFee: bigint;
}>;

export type BrowserRelayResult = Readonly<{
  activationHash: Hex;
  refundHash?: Hex;
  relayer: Address;
  remainingBalance: bigint;
}>;

export type BrowserRelayRefund = Readonly<{
  relayer: Address;
  refundHash?: Hex;
  remainingBalance: bigint;
}>;

export type BrowserRelayRevocationQuote = BrowserRelayQuote &
  Readonly<{
    accountCode: Hex;
    delegate: Address;
    delegateCodeHash: Hex;
    walletNonce: number;
  }>;

export type BrowserRelayRevocationResult = Readonly<{
  revocationHash: Hex;
  refundHash?: Hex;
  relayer: Address;
  remainingBalance: bigint;
  relayExecutionReverted: boolean;
}>;

type DelegationSigner = (
  input: { contractAddress: Address; chainId: number; nonce: number; executor: Address },
  options: { address: Address }
) => Promise<SignedAuthorization>;

type RelayFunding = (to: Address, value: bigint) => Promise<Hex>;

function storageKey(wallet: Address): string {
  return `statics:calibur-browser-relay:${chainId}:${wallet.toLowerCase()}`;
}

function readSession(wallet: Address): RelaySession | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(wallet));
    if (!raw) return null;
    const value = JSON.parse(raw) as RelaySession;
    if (!/^0x[0-9a-fA-F]{64}$/.test(value.privateKey)) return null;
    return value;
  } catch {
    return null;
  }
}

function saveSession(wallet: Address, session: RelaySession): void {
  window.sessionStorage.setItem(storageKey(wallet), JSON.stringify(session));
}

function getSession(wallet: Address): RelaySession {
  const current = readSession(wallet);
  if (current) return current;
  const session = { privateKey: generatePrivateKey() };
  saveSession(wallet, session);
  return session;
}

export function existingBrowserRelayAddress(wallet: Address): Address | null {
  const session = readSession(wallet);
  return session ? privateKeyToAccount(session.privateKey).address : null;
}

function walletRpc(relayRpcUrl?: string) {
  return createPublicClient({
    chain: robinhoodMainnet,
    transport: http(
      relayRpcUrl ?? new URL(`/api/wallet-rpc/${chainId}`, window.location.origin).toString()
    ),
  });
}

async function assertCalibur(publicClient: PublicClient, wallet: Address, expectedCode: Hex) {
  const [accountCode, delegateCode] = await Promise.all([
    publicClient.getCode({ address: wallet }),
    publicClient.getCode({ address: ROBINHOOD_CALIBUR }),
  ]);
  if ((accountCode ?? "0x").toLowerCase() !== expectedCode.toLowerCase()) {
    throw new Error("Wallet delegation changed. Review Calibur activation again.");
  }
  if (!delegateCode || keccak256(delegateCode) !== ROBINHOOD_CALIBUR_CODE_HASH) {
    throw new Error("Calibur's Robinhood code differs from the verified version.");
  }
}

async function revocableCaliburState(publicClient: PublicClient, wallet: Address) {
  const accountCode = (await publicClient.getCode({ address: wallet })) ?? "0x";
  const delegate = delegationFromCode(accountCode);
  if (!delegate || !REVOCABLE_ROBINHOOD_CALIBUR_DELEGATES.some((known) => known === delegate)) {
    throw new Error("This wallet is not delegated to a recognized Calibur implementation.");
  }
  const delegateCode = (await publicClient.getCode({ address: delegate })) ?? "0x";
  return { accountCode, delegate, delegateCodeHash: keccak256(delegateCode) };
}

async function settledWalletNonce(publicClient: PublicClient, wallet: Address): Promise<number> {
  const [latest, pending] = await Promise.all([
    publicClient.getTransactionCount({ address: wallet, blockTag: "latest" }),
    publicClient.getTransactionCount({ address: wallet, blockTag: "pending" }),
  ]);
  if (latest !== pending) {
    throw new Error("This wallet has a pending transaction. Wait for it before reviewing removal.");
  }
  return latest;
}

export async function assertBrowserRelayTransaction(
  raw: Hex,
  target: Address,
  walletNonce: number,
  relayer: Address
): Promise<void> {
  const parsed = parseTransaction(raw);
  if (
    parsed.type !== "eip7702" ||
    parsed.chainId !== chainId ||
    !parsed.to ||
    getAddress(parsed.to) !== relayer ||
    (parsed.value ?? 0n) !== 0n ||
    parsed.authorizationList?.length !== 1 ||
    getAddress(parsed.authorizationList[0].address) !== target ||
    parsed.authorizationList[0].chainId !== chainId ||
    parsed.authorizationList[0].nonce !== walletNonce ||
    getAddress(
      await recoverTransactionAddress({
        serializedTransaction: raw as TransactionSerializedEIP7702,
      })
    ) !== relayer
  ) {
    throw new Error("The browser relayer did not sign the expected type-4 transaction.");
  }
}

async function relayQuote(publicClient: PublicClient, wallet: Address): Promise<BrowserRelayQuote> {
  const session = getSession(wallet);
  const relayer = privateKeyToAccount(session.privateKey).address;
  const [fees, existingBalance] = await Promise.all([
    relayerFees(publicClient),
    publicClient.getBalance({ address: relayer }),
  ]);
  const maximumActivationFee = activationGas * fees.maxFeePerGas;
  const required = (activationGas + refundGasReserve) * fees.maxFeePerGas;
  const fundingAmount = required > minimumFunding ? required : minimumFunding;
  if (fundingAmount > maximumFunding) {
    throw new Error("Network fees are too high for the bounded Calibur relay flow.");
  }
  return { relayer, fundingAmount, existingBalance, maximumActivationFee };
}

export async function quoteBrowserCaliburRelay(
  publicClient: PublicClient,
  wallet: Address
): Promise<BrowserRelayQuote> {
  await assertCalibur(publicClient, wallet, "0x");
  return relayQuote(publicClient, wallet);
}

export async function quoteBrowserCaliburRevocation(
  publicClient: PublicClient,
  wallet: Address
): Promise<BrowserRelayRevocationQuote> {
  const [actualChainId, state, walletNonce] = await Promise.all([
    publicClient.getChainId(),
    revocableCaliburState(publicClient, wallet),
    settledWalletNonce(publicClient, wallet),
  ]);
  if (actualChainId !== chainId) throw new Error("Connect Robinhood Chain 4663 for removal.");
  const quote = await relayQuote(publicClient, wallet);
  return { ...quote, ...state, walletNonce };
}

export async function activateCaliburWithBrowserRelay(args: {
  publicClient: PublicClient;
  wallet: Address;
  sendFunding: RelayFunding;
  signAuthorization: DelegationSigner;
  onProgress?: (message: string) => void;
  relayRpcUrl?: string;
}): Promise<BrowserRelayResult> {
  const { publicClient, wallet } = args;
  const quote = await quoteBrowserCaliburRelay(publicClient, wallet);
  const session = getSession(wallet);
  const account = privateKeyToAccount(session.privateKey);
  if (account.address !== quote.relayer) throw new Error("Temporary relayer changed.");
  const broadcaster = walletRpc(args.relayRpcUrl);
  const walletClient = createWalletClient({
    account,
    chain: robinhoodMainnet,
    transport: http(
      args.relayRpcUrl ?? new URL(`/api/wallet-rpc/${chainId}`, window.location.origin).toString()
    ),
  });

  if (quote.existingBalance < quote.fundingAmount) {
    const value = quote.fundingAmount - quote.existingBalance;
    args.onProgress?.("Confirm the gas transfer to your temporary relayer in Privy.");
    const fundingHash = await args.sendFunding(account.address, value);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: fundingHash,
      confirmations: 1,
    });
    if (receipt.status !== "success") throw new Error(`Relayer funding reverted: ${fundingHash}`);
    const funding = await publicClient.getTransaction({ hash: fundingHash });
    if (
      getAddress(funding.from) !== wallet ||
      !funding.to ||
      getAddress(funding.to) !== account.address ||
      funding.value !== value
    ) {
      throw new Error(`Funding transaction differed from the review: ${fundingHash}`);
    }
  }

  await assertCalibur(publicClient, wallet, "0x");
  const [walletNonce, relayerNonce, fees, relayerBalance] = await Promise.all([
    publicClient.getTransactionCount({ address: wallet, blockTag: "pending" }),
    publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }),
    relayerFees(publicClient),
    publicClient.getBalance({ address: account.address }),
  ]);
  if (relayerBalance < activationGas * fees.maxFeePerGas) {
    throw new Error("Temporary relayer balance is below the current maximum activation fee.");
  }
  args.onProgress?.("Sign the Calibur delegation in Privy. It persists after activation.");
  const authorization = await args.signAuthorization(
    { contractAddress: ROBINHOOD_CALIBUR, chainId, nonce: walletNonce, executor: account.address },
    { address: wallet }
  );
  if (
    getAddress(await recoverAuthorizationAddress({ authorization })) !== wallet ||
    getAddress(authorization.address) !== ROBINHOOD_CALIBUR ||
    authorization.chainId !== chainId ||
    authorization.nonce !== walletNonce
  ) {
    throw new Error("Privy signed a different wallet, chain, nonce, or delegate.");
  }
  await assertCalibur(publicClient, wallet, "0x");
  if (
    (await publicClient.getTransactionCount({ address: wallet, blockTag: "pending" })) !==
    walletNonce
  ) {
    throw new Error("Wallet nonce changed after signing. Review activation again.");
  }

  const raw = await walletClient.signTransaction({
    type: "eip7702",
    chain: robinhoodMainnet,
    account,
    to: account.address,
    value: 0n,
    gas: activationGas,
    nonce: relayerNonce,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    authorizationList: [authorization],
  });
  await assertBrowserRelayTransaction(raw, ROBINHOOD_CALIBUR, walletNonce, account.address);
  args.onProgress?.("Broadcasting the Calibur activation and waiting for confirmation.");
  const activationHash = keccak256(raw);
  const broadcastHash = await broadcaster.sendRawTransaction({ serializedTransaction: raw });
  if (broadcastHash !== activationHash) {
    throw new Error("The RPC returned a different Calibur activation transaction hash.");
  }
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: activationHash,
    confirmations: 1,
  });
  const expectedCode = `0xef0100${ROBINHOOD_CALIBUR.slice(2)}` as Hex;
  await assertCalibur(publicClient, wallet, expectedCode);
  if (receipt.status !== "success") {
    throw new Error(`Calibur activation reverted. Transaction: ${activationHash}`);
  }

  let refund: BrowserRelayRefund | null = null;
  try {
    args.onProgress?.("Returning unused relay ETH to your wallet.");
    refund = await refundBrowserRelay(publicClient, wallet, args.relayRpcUrl);
  } catch {
    // Activation has succeeded. Preserve the session so a failed refund can be recovered.
  }
  return {
    activationHash,
    refundHash: refund?.refundHash,
    relayer: account.address,
    remainingBalance: await publicClient.getBalance({ address: account.address }),
  };
}

async function assertRevocationReview(
  publicClient: PublicClient,
  wallet: Address,
  review: BrowserRelayRevocationQuote,
  expectedNonce: number
): Promise<void> {
  const [actualChainId, state, nonce] = await Promise.all([
    publicClient.getChainId(),
    revocableCaliburState(publicClient, wallet),
    settledWalletNonce(publicClient, wallet),
  ]);
  if (
    actualChainId !== chainId ||
    state.accountCode.toLowerCase() !== review.accountCode.toLowerCase() ||
    state.delegate !== review.delegate ||
    state.delegateCodeHash !== review.delegateCodeHash ||
    nonce !== expectedNonce
  ) {
    throw new Error(
      "Wallet delegation, Calibur implementation, or nonce changed. Review removal again."
    );
  }
}

export async function revokeCaliburWithBrowserRelay(args: {
  publicClient: PublicClient;
  wallet: Address;
  review: BrowserRelayRevocationQuote;
  sendFunding: RelayFunding;
  signAuthorization: DelegationSigner;
  onProgress?: (message: string) => void;
  relayRpcUrl?: string;
}): Promise<BrowserRelayRevocationResult> {
  const { publicClient, wallet, review } = args;
  const current = await quoteBrowserCaliburRevocation(publicClient, wallet);
  if (
    current.relayer !== review.relayer ||
    current.fundingAmount > review.fundingAmount ||
    current.accountCode.toLowerCase() !== review.accountCode.toLowerCase() ||
    current.delegate !== review.delegate ||
    current.delegateCodeHash !== review.delegateCodeHash ||
    current.walletNonce !== review.walletNonce
  ) {
    throw new Error(
      "Relayer, fees, wallet delegation, implementation, or nonce changed. Review removal again."
    );
  }
  const session = getSession(wallet);
  const account = privateKeyToAccount(session.privateKey);
  if (account.address !== review.relayer) throw new Error("Temporary relayer changed.");
  let expectedNonce = review.walletNonce;

  if (current.existingBalance < current.fundingAmount) {
    const value = current.fundingAmount - current.existingBalance;
    args.onProgress?.("Confirm the gas transfer to your temporary relayer in Privy.");
    const fundingHash = await args.sendFunding(account.address, value);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: fundingHash,
      confirmations: 1,
    });
    if (receipt.status !== "success") throw new Error(`Relayer funding reverted: ${fundingHash}`);
    const funding = await publicClient.getTransaction({ hash: fundingHash });
    if (
      getAddress(funding.from) !== wallet ||
      !funding.to ||
      getAddress(funding.to) !== account.address ||
      funding.value !== value ||
      funding.nonce !== expectedNonce
    ) {
      throw new Error(`Funding transaction differed from the review: ${fundingHash}`);
    }
    expectedNonce += 1;
  }

  await assertRevocationReview(publicClient, wallet, review, expectedNonce);
  const [relayerNonce, fees, relayerBalance] = await Promise.all([
    publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }),
    relayerFees(publicClient),
    publicClient.getBalance({ address: account.address }),
  ]);
  if (relayerBalance < activationGas * fees.maxFeePerGas) {
    throw new Error("Temporary relayer balance is below the current maximum removal fee.");
  }
  args.onProgress?.("Sign removal of Calibur delegation in Privy.");
  const authorization = await args.signAuthorization(
    { contractAddress: zeroAddress, chainId, nonce: expectedNonce, executor: account.address },
    { address: wallet }
  );
  if (
    getAddress(await recoverAuthorizationAddress({ authorization })) !== wallet ||
    getAddress(authorization.address) !== zeroAddress ||
    authorization.chainId !== chainId ||
    authorization.nonce !== expectedNonce
  ) {
    throw new Error("Privy signed a different wallet, chain, nonce, or removal target.");
  }
  await assertRevocationReview(publicClient, wallet, review, expectedNonce);

  const walletClient = createWalletClient({
    account,
    chain: robinhoodMainnet,
    transport: http(
      args.relayRpcUrl ?? new URL(`/api/wallet-rpc/${chainId}`, window.location.origin).toString()
    ),
  });
  const raw = await walletClient.signTransaction({
    type: "eip7702",
    chain: robinhoodMainnet,
    account,
    to: account.address,
    value: 0n,
    gas: activationGas,
    nonce: relayerNonce,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    authorizationList: [authorization],
  });
  await assertBrowserRelayTransaction(raw, zeroAddress, expectedNonce, account.address);
  await assertRevocationReview(publicClient, wallet, review, expectedNonce);
  args.onProgress?.("Broadcasting removal and waiting for confirmation.");
  const revocationHash = keccak256(raw);
  const broadcastHash = await walletRpc(args.relayRpcUrl).sendRawTransaction({
    serializedTransaction: raw,
  });
  if (broadcastHash !== revocationHash) {
    throw new Error("The RPC returned a different removal transaction hash.");
  }
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: revocationHash,
    confirmations: 1,
  });
  if (((await publicClient.getCode({ address: wallet })) ?? "0x") !== "0x") {
    throw new Error(`Calibur removal did not clear the wallet delegation: ${revocationHash}`);
  }
  if (receipt.status !== "success") {
    args.onProgress?.("Delegation cleared, although relay transaction execution reverted.");
  }

  let refund: BrowserRelayRefund | null = null;
  try {
    args.onProgress?.("Returning unused relay ETH to your wallet.");
    refund = await refundBrowserRelay(publicClient, wallet, args.relayRpcUrl);
  } catch {
    // Removal succeeded. Keep the session so the user can recover the refund.
  }
  return {
    revocationHash,
    refundHash: refund?.refundHash,
    relayer: account.address,
    remainingBalance: await publicClient.getBalance({ address: account.address }),
    relayExecutionReverted: receipt.status !== "success",
  };
}

export async function refundBrowserRelay(
  publicClient: PublicClient,
  wallet: Address,
  relayRpcUrl?: string
): Promise<BrowserRelayRefund> {
  const session = readSession(wallet);
  if (!session) throw new Error("No temporary relayer is stored in this browser tab.");
  const account = privateKeyToAccount(session.privateKey);
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) return { relayer: account.address, remainingBalance: 0n };
  const fees = await relayerFees(publicClient);
  const estimate = await publicClient.estimateGas({
    account: account.address,
    to: wallet,
    value: 1n,
  });
  const gas = estimate + 10_000n;
  const maximumFee = gas * fees.maxFeePerGas;
  if (balance <= maximumFee) {
    return { relayer: account.address, remainingBalance: balance };
  }
  const nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });
  const walletClient = createWalletClient({
    account,
    chain: robinhoodMainnet,
    transport: http(
      relayRpcUrl ?? new URL(`/api/wallet-rpc/${chainId}`, window.location.origin).toString()
    ),
  });
  const raw = await walletClient.signTransaction({
    type: "eip1559",
    chain: robinhoodMainnet,
    account,
    to: wallet,
    value: balance - maximumFee,
    gas,
    nonce,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  const refundHash = keccak256(raw);
  await walletRpc(relayRpcUrl).sendRawTransaction({ serializedTransaction: raw });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: refundHash,
    confirmations: 1,
  });
  if (receipt.status !== "success") throw new Error(`Relayer refund reverted: ${refundHash}`);
  return {
    relayer: account.address,
    refundHash,
    remainingBalance: await publicClient.getBalance({ address: account.address }),
  };
}
