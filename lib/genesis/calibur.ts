import { getAddress } from "viem";

// Uniswap CaliburEntry v1.1.0 on Robinhood Chain 4663. The runtime hash is
// checked on chain before any authorization or batch uses this implementation.
export const ROBINHOOD_CALIBUR = getAddress("0x000000005c84F8Fd50b21CAC312528A64437030e");
export const ROBINHOOD_CALIBUR_CODE_HASH =
  "0xba697585ba58ba66ebd095ab4c7f980ed42ad115b2e3bb9b5b9bdf167bf08b1b" as const;
