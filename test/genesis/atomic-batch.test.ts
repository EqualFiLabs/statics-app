import { describe, expect, it, vi } from "vitest";
import { getAddress, keccak256, type Address, type Hex, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  AtomicBatchSizeError,
  assertStaticsBatch,
  delegationFromCode,
  delegationMatchesReview,
  planAtomicChunks,
  prepareErc7821Batch,
  submitErc7821Batch,
  submitPrivy7702Batch,
  type AtomicBatch,
} from "@/lib/genesis/atomic-batch";

const wallet = getAddress("0x1111111111111111111111111111111111111111");
const delegate = getAddress("0x2222222222222222222222222222222222222222");
const target = getAddress("0x3333333333333333333333333333333333333333");
const delegatedCode = `0xef0100${delegate.slice(2).toLowerCase()}` as Hex;
const delegateCode = "0x6001600055" as Hex;
const batch: AtomicBatch = {
  calls: [
    { to: target, data: "0x12345678", value: 1n },
    { to: target, data: "0xabcdef01", value: 2n },
  ],
  labels: ["first Operator", "second Operator"],
};

function client(overrides: Record<string, unknown> = {}): PublicClient {
  return {
    getCode: vi.fn(async ({ address }: { address: Address }) =>
      address === wallet ? delegatedCode : delegateCode
    ),
    readContract: vi.fn(async () => true),
    call: vi.fn(async () => ({ data: "0x" })),
    estimateGas: vi.fn(async () => 100_000n),
    getBlock: vi.fn(async () => ({ gasLimit: 30_000_000n })),
    waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
    ...overrides,
  } as unknown as PublicClient;
}

describe("EIP-7702 Operator batch", () => {
  it("splits only on gas limits and keeps every selected Operator exactly once", async () => {
    const chunks = await planAtomicChunks({
      items: [1, 2, 3, 4, 5],
      prepare: async (items) => {
        if (items.length > 2) throw new AtomicBatchSizeError();
        return items.join(",");
      },
    });
    expect(chunks.map((chunk) => chunk.items)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks.map((chunk) => chunk.prepared)).toEqual(["1,2", "3,4", "5"]);
    await expect(
      planAtomicChunks({
        items: [1, 2],
        prepare: async () => {
          throw new Error("protocol reverted");
        },
      })
    ).rejects.toThrow("protocol reverted");
  });

  it("parses only a complete delegation designator", () => {
    expect(delegationFromCode(delegatedCode)).toBe(delegate);
    expect(delegationFromCode("0x" as Hex)).toBeNull();
    expect(delegationFromCode(`0xef0100${delegate.slice(2)}00` as Hex)).toBeNull();
  });

  it("rejects unknown targets before simulation", () => {
    expect(() => assertStaticsBatch(batch, [wallet])).toThrow("unknown contract");
  });

  it("simulates ordered self-calls with the sum of native values", async () => {
    const publicClient = client();
    const prepared = await prepareErc7821Batch({
      publicClient,
      wallet,
      batch,
      allowedTargets: [target],
      verifiedDelegateCodeHashes: [keccak256(delegateCode)],
    });
    expect(prepared.delegate).toBe(delegate);
    expect(prepared.value).toBe(3n);
    expect(publicClient.call).toHaveBeenCalledWith({
      account: wallet,
      to: wallet,
      data: prepared.data,
      value: 3n,
    });
  });

  it("splits when the buffered estimate exceeds the safe block budget", async () => {
    await expect(
      prepareErc7821Batch({
        publicClient: client({ estimateGas: vi.fn(async () => 21_000_000n) }),
        wallet,
        batch,
        allowedTargets: [target],
        verifiedDelegateCodeHashes: [keccak256(delegateCode)],
      })
    ).rejects.toBeInstanceOf(AtomicBatchSizeError);
  });

  it("recognizes an RPC out-of-gas simulation as a chunk-size failure", async () => {
    await expect(
      prepareErc7821Batch({
        publicClient: client({
          call: vi.fn(async () => {
            throw new Error("out of gas");
          }),
        }),
        wallet,
        batch,
        allowedTargets: [target],
        verifiedDelegateCodeHashes: [keccak256(delegateCode)],
      })
    ).rejects.toBeInstanceOf(AtomicBatchSizeError);
  });

  it("requires the same reviewed delegation and implementation", () => {
    const reviewed = {
      accountCode: delegatedCode,
      delegate,
      delegateCodeHash: keccak256(delegateCode),
      data: "0x1234" as Hex,
      value: 0n,
      gasLimit: 100_000n,
    };
    expect(delegationMatchesReview(reviewed, reviewed)).toBe(true);
    expect(delegationMatchesReview(reviewed, { ...reviewed, accountCode: "0x" })).toBe(false);
    expect(
      delegationMatchesReview(reviewed, {
        ...reviewed,
        delegateCodeHash: keccak256("0x6000"),
      })
    ).toBe(false);
  });

  it("rejects an authorization signed by a different EOA before sending", async () => {
    const other = privateKeyToAccount(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    const sendAuthorizedTransaction = vi.fn();
    await expect(
      submitPrivy7702Batch({
        publicClient: client({
          getTransactionCount: vi.fn(async () => 0),
          getCode: vi.fn(async ({ address }: { address: Address }) =>
            address === wallet ? "0x" : delegateCode
          ),
        }),
        wallet,
        chainId: 4663,
        prepared: {
          accountCode: "0x",
          delegate,
          delegateCodeHash: keccak256(delegateCode),
          data: "0x1234",
          value: 0n,
          gasLimit: 100_000n,
          needsAuthorization: true,
        },
        signAuthorization: async (input) =>
          other.signAuthorization({
            contractAddress: input.contractAddress,
            chainId: input.chainId,
            nonce: input.nonce,
          }),
        sendAuthorizedTransaction,
      })
    ).rejects.toThrow("does not match");
    expect(sendAuthorizedTransaction).not.toHaveBeenCalled();
  });

  it("reports the first failing child call", async () => {
    const publicClient = client({
      call: vi.fn(async ({ data }: { data: Hex }) => {
        // The complete batch fails; its one-call prefix succeeds.
        if (data.includes("abcdef01")) throw new Error("reverted");
        return { data: "0x" };
      }),
    });
    await expect(
      prepareErc7821Batch({
        publicClient,
        wallet,
        batch,
        allowedTargets: [target],
        verifiedDelegateCodeHashes: [keccak256(delegateCode)],
      })
    ).rejects.toThrow("second Operator");
  });

  it("reports the current failing child after an onchain revert", async () => {
    const prepared = await prepareErc7821Batch({
      publicClient: client(),
      wallet,
      batch,
      allowedTargets: [target],
      verifiedDelegateCodeHashes: [keccak256(delegateCode)],
    });
    const failedClient = client({
      waitForTransactionReceipt: vi.fn(async () => ({ status: "reverted" })),
      call: vi.fn(async ({ data }: { data: Hex }) => {
        if (data.includes("abcdef01")) throw new Error("reverted");
        return { data: "0x" };
      }),
    });
    await expect(
      submitErc7821Batch({
        publicClient: failedClient,
        wallet,
        chainId: 4663,
        prepared,
        batch,
        sendTransaction: vi.fn(async () => "0x1234" as Hex),
      })
    ).rejects.toThrow("second Operator");
  });

  it("aborts if delegation changes after simulation", async () => {
    const prepared = await prepareErc7821Batch({
      publicClient: client(),
      wallet,
      batch,
      allowedTargets: [target],
      verifiedDelegateCodeHashes: [keccak256(delegateCode)],
    });
    const sendTransaction = vi.fn();
    await expect(
      submitErc7821Batch({
        publicClient: client({ getCode: vi.fn(async () => "0x") }),
        wallet,
        chainId: 4663,
        prepared,
        sendTransaction,
      })
    ).rejects.toThrow("delegation changed");
    expect(sendTransaction).not.toHaveBeenCalled();
  });
});
