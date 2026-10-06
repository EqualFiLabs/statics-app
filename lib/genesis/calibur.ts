import { getAddress } from "viem";

// Uniswap CaliburEntry v1.1.0 on Robinhood Chain 4663. Activation and batching
// require this runtime hash; removal checks the reviewed code snapshot instead.
export const ROBINHOOD_CALIBUR = getAddress("0x000000005c84F8Fd50b21CAC312528A64437030e");
export const ROBINHOOD_CALIBUR_CODE_HASH =
  "0xba697585ba58ba66ebd095ab4c7f980ed42ad115b2e3bb9b5b9bdf167bf08b1b" as const;

// Keep previously supported Calibur addresses here if batch support is withdrawn.
// Revocation must remain possible even when an implementation is no longer safe to execute.
export const REVOCABLE_ROBINHOOD_CALIBUR_DELEGATES = [ROBINHOOD_CALIBUR] as const;
