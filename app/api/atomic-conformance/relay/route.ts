import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  keccak256,
  parseTransaction,
  zeroAddress,
  type Hex,
  type SignedAuthorization,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { recoverAuthorizationAddress } from "viem/utils";

import { robinhoodMainnet } from "@/lib/wallet-config";
import { robinhoodRpcUrl } from "@/lib/server/robinhood-rpc";
import { ROBINHOOD_CALIBUR, ROBINHOOD_CALIBUR_CODE_HASH } from "@/lib/genesis/calibur";

export const runtime = "nodejs";

const gasLimit = 100_000n;
const delegate = ROBINHOOD_CALIBUR;
const delegateCodeHash = ROBINHOOD_CALIBUR_CODE_HASH;
let relayPending = false;

function configuration() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "development") return null;
  const key = process.env.STATICS_LOCAL_7702_RELAYER_PRIVATE_KEY;
  const wallet = process.env.STATICS_LOCAL_7702_TEST_WALLET;
  if (!key || !wallet || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  try {
    return { account: privateKeyToAccount(key as Hex), wallet: getAddress(wallet) };
  } catch {
    return null;
  }
}

function client() {
  return createPublicClient({ chain: robinhoodMainnet, transport: http(robinhoodRpcUrl(4663)) });
}

export async function GET() {
  const config = configuration();
  if (!config)
    return NextResponse.json({ enabled: false }, { headers: { "cache-control": "no-store" } });
  const balance = await client().getBalance({ address: config.account.address });
  return NextResponse.json(
    {
      enabled: true,
      address: config.account.address,
      wallet: config.wallet,
      delegate,
      balance: balance.toString(),
    },
    { headers: { "cache-control": "no-store" } }
  );
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function validAuthorization(value: unknown): value is SignedAuthorization {
  if (!value || typeof value !== "object") return false;
  const auth = value as Record<string, unknown>;
  return (
    typeof auth.address === "string" &&
    typeof auth.chainId === "number" &&
    typeof auth.nonce === "number" &&
    (auth.yParity === 0 || auth.yParity === 1) &&
    typeof auth.r === "string" &&
    typeof auth.s === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(auth.r) &&
    /^0x[0-9a-fA-F]{64}$/.test(auth.s)
  );
}

export async function POST(request: Request) {
  const config = configuration();
  if (!config)
    return NextResponse.json({ error: "Local relayer is not configured." }, { status: 503 });
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Same-origin request required." }, { status: 403 });
  let input: { wallet?: unknown; authorization?: unknown; action?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof input.wallet !== "string" || !validAuthorization(input.authorization)) {
    return NextResponse.json({ error: "Invalid authorization." }, { status: 400 });
  }
  if (relayPending) {
    return NextResponse.json(
      { error: "A delegation transaction is already pending." },
      { status: 409 }
    );
  }
  relayPending = true;
  const authorization = input.authorization;
  try {
    const action = input.action === "revoke" ? "revoke" : "activate";
    const wallet = getAddress(input.wallet);
    if (
      wallet !== config.wallet ||
      getAddress(authorization.address) !== (action === "revoke" ? zeroAddress : delegate) ||
      authorization.chainId !== 4663 ||
      getAddress(await recoverAuthorizationAddress({ authorization })) !== wallet
    ) {
      throw new Error("Authorization does not match the configured test wallet and delegate.");
    }
    const publicClient = client();
    const [nonce, accountCode, delegateCode, fees, relayNonce, relayBalance] = await Promise.all([
      publicClient.getTransactionCount({ address: wallet, blockTag: "pending" }),
      publicClient.getCode({ address: wallet }),
      publicClient.getCode({ address: delegate }),
      publicClient.estimateFeesPerGas(),
      publicClient.getTransactionCount({ address: config.account.address, blockTag: "pending" }),
      publicClient.getBalance({ address: config.account.address }),
    ]);
    const expectedCode = `0xef0100${delegate.slice(2).toLowerCase()}`;
    if (
      authorization.nonce !== nonce ||
      (action === "activate"
        ? Boolean(accountCode && accountCode !== "0x")
        : accountCode?.toLowerCase() !== expectedCode)
    ) {
      throw new Error("Wallet nonce or delegation changed. Review again.");
    }
    if (!delegateCode || keccak256(delegateCode) !== delegateCodeHash) {
      throw new Error("Delegate bytecode differs from the reviewed fixture.");
    }
    if (relayBalance < gasLimit * fees.maxFeePerGas) {
      throw new Error("Relayer needs more ETH for the delegation gas.");
    }
    const walletClient = createWalletClient({
      account: config.account,
      chain: robinhoodMainnet,
      transport: http(robinhoodRpcUrl(4663)),
    });
    const raw = await walletClient.signTransaction({
      type: "eip7702",
      chain: robinhoodMainnet,
      account: config.account,
      to: config.account.address,
      value: 0n,
      gas: gasLimit,
      nonce: relayNonce,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      authorizationList: [authorization],
    });
    const decoded = parseTransaction(raw);
    if (decoded.type !== "eip7702" || decoded.authorizationList?.length !== 1) {
      throw new Error("Relayer did not sign a complete type-4 transaction.");
    }
    const hash = await publicClient.sendRawTransaction({ serializedTransaction: raw });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    const code = await publicClient.getCode({ address: wallet });
    if (
      receipt.status !== "success" ||
      (action === "activate"
        ? code?.toLowerCase() !== expectedCode
        : Boolean(code && code !== "0x"))
    ) {
      throw new Error(
        `Delegation ${action} did not establish the expected code. Transaction: ${hash}`
      );
    }
    return NextResponse.json({ hash, code });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delegation transaction failed." },
      { status: 400 }
    );
  } finally {
    relayPending = false;
  }
}
