import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWalletClient,
  custom,
  getAddress,
  parseEther,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import {
  assertBrowserRelayTransaction,
  quoteBrowserCaliburRelay,
  quoteBrowserCaliburRevocation,
  revokeCaliburWithBrowserRelay,
} from "@/lib/genesis/browser-calibur-relay";
import { ROBINHOOD_CALIBUR } from "@/lib/genesis/calibur";
import { robinhoodMainnet } from "@/lib/wallet-config";

const owner = privateKeyToAccount(generatePrivateKey());
const otherDelegate = getAddress("0x2222222222222222222222222222222222222222");
const caliburDesignator = `0xef0100${ROBINHOOD_CALIBUR.slice(2)}` as Hex;
const otherDesignator = `0xef0100${otherDelegate.slice(2)}` as Hex;

function client(state: {
  code: Hex;
  delegateCode: Hex;
  nonce: number;
  pendingNonce?: number;
}): PublicClient {
  return {
    getChainId: vi.fn(async () => 4663),
    getCode: vi.fn(async ({ address }: { address: Address }) =>
      address === owner.address ? state.code : state.delegateCode
    ),
    getTransactionCount: vi.fn(async ({ blockTag }: { blockTag: string }) =>
      blockTag === "pending" ? (state.pendingNonce ?? state.nonce) : state.nonce
    ),
    getGasPrice: vi.fn(async () => 100_000_000n),
    getBlock: vi.fn(async () => ({ baseFeePerGas: 100_000_000n })),
    getBalance: vi.fn(async () => parseEther("1")),
    getTransaction: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
  } as unknown as PublicClient;
}

beforeEach(() => window.sessionStorage.clear());

describe("Calibur relay delegation guards", () => {
  it("accepts the actual viem encoding of a signed zero-value removal transaction", async () => {
    const relayer = privateKeyToAccount(generatePrivateKey());
    const authorization = await owner.signAuthorization({
      contractAddress: zeroAddress,
      chainId: 4663,
      nonce: 3,
    });
    const walletClient = createWalletClient({
      account: relayer,
      chain: robinhoodMainnet,
      transport: custom({
        request: async ({ method }) => {
          if (method === "eth_chainId") return "0x1237";
          throw new Error(`Unexpected RPC method: ${method}`);
        },
      }),
    });
    const raw = await walletClient.signTransaction({
      type: "eip7702",
      chain: robinhoodMainnet,
      account: relayer,
      to: relayer.address,
      value: 0n,
      gas: 100_000n,
      nonce: 0,
      maxFeePerGas: 100_000_000n,
      maxPriorityFeePerGas: 1_000_000n,
      authorizationList: [authorization],
    });
    await expect(
      assertBrowserRelayTransaction(raw, zeroAddress, 3, relayer.address)
    ).resolves.toBeUndefined();
    await expect(
      assertBrowserRelayTransaction(raw, ROBINHOOD_CALIBUR, 3, relayer.address)
    ).rejects.toThrow("expected type-4 transaction");
  });

  it("never activates over an existing wallet delegation", async () => {
    const publicClient = client({ code: otherDesignator, delegateCode: "0x6000", nonce: 0 });
    await expect(quoteBrowserCaliburRelay(publicClient, owner.address)).rejects.toThrow(
      "Wallet delegation changed"
    );
    await expect(quoteBrowserCaliburRevocation(publicClient, owner.address)).rejects.toThrow(
      "not delegated to a recognized Calibur"
    );
  });

  it("offers removal for known Calibur even when its implementation hash is unsupported", async () => {
    const publicClient = client({ code: caliburDesignator, delegateCode: "0x6001", nonce: 3 });
    const review = await quoteBrowserCaliburRevocation(publicClient, owner.address);
    expect(review.delegate).toBe(ROBINHOOD_CALIBUR);
    expect(review.walletNonce).toBe(3);
    await expect(quoteBrowserCaliburRelay(publicClient, owner.address)).rejects.toThrow(
      "Wallet delegation changed"
    );
  });

  it("waits for existing wallet transactions before reviewing removal", async () => {
    const publicClient = client({
      code: caliburDesignator,
      delegateCode: "0x6001",
      nonce: 3,
      pendingNonce: 4,
    });
    await expect(quoteBrowserCaliburRevocation(publicClient, owner.address)).rejects.toThrow(
      "pending transaction"
    );
  });

  it.each([
    ["wallet nonce", { code: caliburDesignator, delegateCode: "0x6001" as Hex, nonce: 4 }],
    ["delegation target", { code: otherDesignator, delegateCode: "0x6001" as Hex, nonce: 3 }],
    ["Calibur runtime", { code: caliburDesignator, delegateCode: "0x6002" as Hex, nonce: 3 }],
  ])("stops before funding or signing if the %s changes after review", async (_name, changed) => {
    const state = { code: caliburDesignator, delegateCode: "0x6001" as Hex, nonce: 3 };
    const publicClient = client(state);
    const review = await quoteBrowserCaliburRevocation(publicClient, owner.address);
    Object.assign(state, changed);
    const sendFunding = vi.fn();
    const signAuthorization = vi.fn();
    await expect(
      revokeCaliburWithBrowserRelay({
        publicClient,
        wallet: owner.address,
        review,
        sendFunding,
        signAuthorization,
      })
    ).rejects.toThrow();
    expect(sendFunding).not.toHaveBeenCalled();
    expect(signAuthorization).not.toHaveBeenCalled();
  });

  it("stops before broadcast when the wallet changes during signing", async () => {
    const state = { code: caliburDesignator, delegateCode: "0x6001" as Hex, nonce: 3 };
    const publicClient = client(state);
    const review = await quoteBrowserCaliburRevocation(publicClient, owner.address);
    const sendFunding = vi.fn();
    const signAuthorization = vi.fn(
      async (input: { contractAddress: Address; chainId: number; nonce: number }) => {
        const signed = await owner.signAuthorization(input);
        state.nonce += 1;
        return signed;
      }
    );
    await expect(
      revokeCaliburWithBrowserRelay({
        publicClient,
        wallet: owner.address,
        review,
        sendFunding,
        signAuthorization,
      })
    ).rejects.toThrow("nonce changed");
    expect(sendFunding).not.toHaveBeenCalled();
    expect(signAuthorization).toHaveBeenCalledOnce();
  });

  it("rejects an authorization that does not clear the delegation", async () => {
    const state = { code: caliburDesignator, delegateCode: "0x6001" as Hex, nonce: 3 };
    const publicClient = client(state);
    const review = await quoteBrowserCaliburRevocation(publicClient, owner.address);
    const signAuthorization = vi.fn((input: { chainId: number; nonce: number }) =>
      owner.signAuthorization({
        contractAddress: ROBINHOOD_CALIBUR,
        chainId: input.chainId,
        nonce: input.nonce,
      })
    );
    await expect(
      revokeCaliburWithBrowserRelay({
        publicClient,
        wallet: owner.address,
        review,
        sendFunding: vi.fn(),
        signAuthorization,
      })
    ).rejects.toThrow("removal target");
  });

  it("uses the confirmed funding transaction's next wallet nonce for removal", async () => {
    const state = { code: caliburDesignator, delegateCode: "0x6001" as Hex, nonce: 3 };
    const publicClient = client(state);
    let relayerBalance = 0n;
    vi.mocked(publicClient.getBalance).mockImplementation(async () => relayerBalance);
    const review = await quoteBrowserCaliburRevocation(publicClient, owner.address);
    const fundingHash = `0x${"aa".repeat(32)}` as Hex;
    const sendFunding = vi.fn(async () => {
      relayerBalance = review.fundingAmount;
      state.nonce += 1;
      return fundingHash;
    });
    vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValue({
      status: "success",
    } as Awaited<ReturnType<PublicClient["waitForTransactionReceipt"]>>);
    vi.mocked(publicClient.getTransaction).mockResolvedValue({
      from: owner.address,
      to: review.relayer,
      value: review.fundingAmount,
      nonce: 3,
    } as Awaited<ReturnType<PublicClient["getTransaction"]>>);
    const signAuthorization = vi.fn(async () => {
      throw new Error("stop after checking nonce");
    });
    await expect(
      revokeCaliburWithBrowserRelay({
        publicClient,
        wallet: owner.address,
        review,
        sendFunding,
        signAuthorization,
      })
    ).rejects.toThrow("stop after checking nonce");
    expect(sendFunding).toHaveBeenCalledWith(review.relayer, review.fundingAmount);
    expect(signAuthorization).toHaveBeenCalledWith(
      {
        contractAddress: getAddress("0x0000000000000000000000000000000000000000"),
        chainId: 4663,
        nonce: 4,
        executor: review.relayer,
      },
      { address: owner.address }
    );
  });
});
