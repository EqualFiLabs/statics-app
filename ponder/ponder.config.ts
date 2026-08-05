import { createConfig } from "ponder";
import { getAddress } from "viem";

import { staticsAbi, v4PositionManagerReadAbi } from "@statics-protocol/sdk";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function startBlock(name: string): number {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a block number.`);
  return value;
}

export default createConfig({
  chains: {
    robinhood: {
      id: 46_630,
      rpc: required("PONDER_RPC_URL_46630"),
    },
  },
  contracts: {
    Statics: {
      chain: "robinhood",
      abi: staticsAbi,
      address: getAddress(required("PONDER_STATICS_DIAMOND_ADDRESS")),
      startBlock: startBlock("PONDER_STATICS_START_BLOCK"),
    },
    PositionManager: {
      chain: "robinhood",
      abi: v4PositionManagerReadAbi,
      address: getAddress(required("PONDER_POSITION_MANAGER_ADDRESS")),
      startBlock: startBlock("PONDER_POSITION_MANAGER_START_BLOCK"),
    },
  },
});
