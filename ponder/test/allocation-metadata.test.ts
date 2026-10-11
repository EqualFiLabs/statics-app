import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BaseError,
  ContractFunctionRevertedError,
  decodeFunctionResult,
  erc20Abi,
  getAddress,
  stringToHex,
  zeroAddress,
} from "viem";
vi.mock("ponder:schema", () => ({
  allocationToken: "token",
  allocatorStream: "stream",
  allocationDirectoryPool: "directory",
  allocationDirectoryState: "state",
  gaugePoolState: "weight",
  gaugeReserveState: "reserve",
  publicPool: "pool",
  rewardRestriction: "restriction",
}));
import { readTokenMetadata } from "../src/allocation-snapshots";
const stored = new Map<string, unknown>(),
  readContract = vi.fn();
const context = {
  chain: { id: 4663 },
  client: { readContract },
  db: {
    find: async (_: unknown, { key }: { key: string }) => stored.get(key),
    insert: () => ({
      values: (row: { key: string }) => ({
        onConflictDoUpdate: async () => stored.set(row.key, row),
      }),
    }),
  },
} as unknown as Parameters<typeof readTokenMetadata>[0];
const event = { block: { number: 100n, timestamp: 1000n } },
  asset = getAddress("0x0000000000000000000000000000000000000001");
beforeEach(() => {
  stored.clear();
  readContract.mockReset();
  delete process.env.PONDER_NATIVE_CURRENCY_SYMBOL;
  delete process.env.PONDER_NATIVE_CURRENCY_NAME;
  delete process.env.PONDER_NATIVE_CURRENCY_DECIMALS;
});
describe("token metadata snapshots", () => {
  it("caches by chain and address and reads each independent field once", async () => {
    readContract.mockImplementation(({ functionName }) =>
      Promise.resolve({ symbol: "ABC", name: "Asset ABC", decimals: 8 }[functionName as "symbol"])
    );
    expect(await readTokenMetadata(context, event, asset)).toMatchObject({
      symbol: "ABC",
      name: "Asset ABC",
      decimals: 8,
      observedAtBlock: 100n,
    });
    await readTokenMetadata(context, event, asset);
    expect(readContract).toHaveBeenCalledTimes(3);
    await readTokenMetadata({ ...context, chain: { ...context.chain, id: 1 } }, event, asset);
    expect(readContract).toHaveBeenCalledTimes(6);
    expect(readContract.mock.calls.every(([r]) => r.blockNumber === 100n)).toBe(true);
  });
  it("decodes bytes32 symbols and tolerates individual getter reverts", async () => {
    const encoded = stringToHex("ABC", { size: 32 });
    let symbolReads = 0;
    readContract.mockImplementation(async ({ functionName }) => {
      if (functionName === "symbol") {
        if (symbolReads++ === 0)
          return decodeFunctionResult({ abi: erc20Abi, functionName: "symbol", data: encoded });
        return encoded;
      }
      if (functionName === "name")
        throw new ContractFunctionRevertedError({ abi: erc20Abi, functionName: "name" });
      return 6;
    });
    expect(await readTokenMetadata(context, event, asset)).toMatchObject({
      symbol: "ABC",
      name: null,
      decimals: 6,
    });
  });
  it("does not permanently cache provider failures as missing metadata", async () => {
    readContract.mockRejectedValue(new BaseError("transport failed"));
    await expect(readTokenMetadata(context, event, asset)).rejects.toThrow("transport failed");
    expect(stored.size).toBe(0);
  });
  it("uses configured native metadata without calling an ERC-20", async () => {
    process.env.PONDER_NATIVE_CURRENCY_SYMBOL = "ETH";
    process.env.PONDER_NATIVE_CURRENCY_NAME = "Ether";
    process.env.PONDER_NATIVE_CURRENCY_DECIMALS = "18";
    expect(await readTokenMetadata(context, event, zeroAddress)).toMatchObject({
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
    });
    expect(readContract).not.toHaveBeenCalled();
  });
});
