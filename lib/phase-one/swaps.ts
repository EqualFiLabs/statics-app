import {
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import {
  buildPermit2ApproveCall,
  buildQuoteV4ExactInputSingleCall,
  buildV4ExactInputSingleSwap,
  permit2AllowanceAbi,
  v4QuoterAbi,
  type Permit2PermitSingle,
} from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { PublicPoolPreflight, PublicPoolSelection } from "@/lib/phase-one/pools";
import {
  MAX_ERC20_ALLOWANCE,
  MAX_PERMIT2_ALLOWANCE,
  MAX_PERMIT2_EXPIRATION,
  hasUsablePermit2Allowance,
} from "@/lib/protocol/approvals";

const BPS = 10_000n;
const LP_FEE_PIPS = 1_000_000n;
export const DEFAULT_PHASE_ONE_SWAP_DEADLINE_SECONDS = 20 * 60;
export const MIN_PHASE_ONE_SWAP_DEADLINE_SECONDS = 60;
export const MAX_PHASE_ONE_SWAP_DEADLINE_SECONDS = 60 * 60;
export const MAX_PHASE_ONE_SWAP_SLIPPAGE_BPS = 5_000;

export type PublicSwapQuote = Readonly<{
  poolId: Hex;
  amountIn: bigint;
  amountOut: bigint;
  gasEstimate: bigint;
  zeroForOne: boolean;
  inputToken: Address;
  outputToken: Address;
  quotedAtBlock: bigint;
  fees: Readonly<{
    nativeLpFeePips: number;
    estimatedNativeLpFeeInput: bigint;
    staticsInputFeeBps: number;
    staticsInputFee: bigint;
    staticsOutputFeeBps: number;
    staticsOutputFee: bigint;
    estimatedGrossOutput: bigint;
  }>;
}>;

export type PublicSwapApprovalPlan = Readonly<{
  token: Address;
  permit2: Address;
  router: Address;
  nativeInput: boolean;
  needsTokenApproval: boolean;
  needsPermit2Approval: boolean;
  ready: boolean;
  tokenApprovalCall: Readonly<{ target: Address; calldata: Hex }> | null;
  permit2ApprovalCall: Readonly<{ target: Address; calldata: Hex }> | null;
}>;

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Fee denominator must be positive.");
  return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
}

export function feeFromGross(grossAmount: bigint, feeBps: number): bigint {
  if (grossAmount < 0n) throw new Error("Fee amount must not be negative.");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps >= 10_000) {
    throw new Error("Fee basis points must be between 0 and 9999.");
  }
  return ceilDiv(grossAmount * BigInt(feeBps), BPS);
}

export function grossFromNet(netAmount: bigint, feeBps: number): bigint {
  if (netAmount < 0n) throw new Error("Net amount must not be negative.");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps >= 10_000) {
    throw new Error("Fee basis points must be between 0 and 9999.");
  }
  if (feeBps === 0 || netAmount === 0n) return netAmount;
  let gross = ceilDiv(netAmount * BPS, BPS - BigInt(feeBps));
  while (gross > 0n && gross - feeFromGross(gross, feeBps) > netAmount) gross -= 1n;
  while (gross - feeFromGross(gross, feeBps) < netAmount) gross += 1n;
  return gross;
}

export function minimumSwapOutput(amountOut: bigint, slippageBps: number): bigint {
  if (amountOut <= 0n) throw new Error("Quoted output must be greater than zero.");
  if (
    !Number.isInteger(slippageBps) ||
    slippageBps < 0 ||
    slippageBps > MAX_PHASE_ONE_SWAP_SLIPPAGE_BPS
  ) {
    throw new Error("Swap slippage must be between 0 and 5000 bps.");
  }
  return (amountOut * BigInt(10_000 - slippageBps)) / BPS;
}

export function swapDeadline(
  now: number,
  ttlSeconds = DEFAULT_PHASE_ONE_SWAP_DEADLINE_SECONDS
): bigint {
  if (!Number.isInteger(now) || now < 0) throw new Error("Current time must be a timestamp.");
  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < MIN_PHASE_ONE_SWAP_DEADLINE_SECONDS ||
    ttlSeconds > MAX_PHASE_ONE_SWAP_DEADLINE_SECONDS
  ) {
    throw new Error("Swap deadline must be between 1 and 60 minutes.");
  }
  return BigInt(now + ttlSeconds);
}

export function publicSwapDirection(pool: PublicPoolSelection, inputToken: Address): boolean {
  const input = getAddress(inputToken);
  if (getAddress(pool.poolKey.currency0) === input) return true;
  if (getAddress(pool.poolKey.currency1) === input) return false;
  throw new Error("The input token is not part of the selected public pool.");
}

export async function quotePublicExactInputSwap(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  preflight: PublicPoolPreflight;
  inputToken: Address;
  amountIn: bigint;
  account?: Address;
}): Promise<PublicSwapQuote> {
  if (!input.preflight.swappable) throw new Error("The selected public pool is not swappable.");
  if (input.amountIn <= 0n) throw new Error("Swap input must be greater than zero.");
  const zeroForOne = publicSwapDirection(input.preflight.pool, input.inputToken);
  const result = await input.publicClient.call({
    account: input.account,
    to: input.deployment.contracts.quoter,
    data: buildQuoteV4ExactInputSingleCall(
      input.preflight.pool.poolKey,
      zeroForOne,
      input.amountIn
    ),
  });
  if (!result.data) throw new Error("The configured v4 Quoter returned no result.");
  const [amountOut, gasEstimate] = decodeFunctionResult({
    abi: v4QuoterAbi,
    functionName: "quoteExactInputSingle",
    data: result.data,
  });
  if (amountOut <= 0n) throw new Error("The direct public-pool quote returns no output.");
  const block = await input.publicClient.getBlock();
  const staticsInputFee = feeFromGross(input.amountIn, input.preflight.feeRate.inputFeeBps);
  const grossOutput = grossFromNet(amountOut, input.preflight.feeRate.outputFeeBps);
  const amountEnteringPool = input.amountIn - staticsInputFee;
  return {
    poolId: input.preflight.pool.poolId,
    amountIn: input.amountIn,
    amountOut,
    gasEstimate,
    zeroForOne,
    inputToken: getAddress(input.inputToken),
    outputToken: zeroForOne
      ? input.preflight.pool.poolKey.currency1
      : input.preflight.pool.poolKey.currency0,
    quotedAtBlock: block.number,
    fees: {
      nativeLpFeePips: input.preflight.nativeLpFee,
      estimatedNativeLpFeeInput: ceilDiv(
        amountEnteringPool * BigInt(input.preflight.nativeLpFee),
        LP_FEE_PIPS
      ),
      staticsInputFeeBps: input.preflight.feeRate.inputFeeBps,
      staticsInputFee,
      staticsOutputFeeBps: input.preflight.feeRate.outputFeeBps,
      staticsOutputFee: grossOutput - amountOut,
      estimatedGrossOutput: grossOutput,
    },
  };
}

export function planPublicSwapApprovals(input: {
  token: Address;
  permit2: Address;
  router: Address;
  amount: bigint;
  tokenAllowance: bigint;
  permit2Allowance: bigint;
  permit2Expiration: number;
  currentTimestamp: number;
  nativeInput?: boolean;
}): PublicSwapApprovalPlan {
  if (input.amount <= 0n) throw new Error("Approval amount must be greater than zero.");
  if (input.nativeInput) {
    return {
      token: getAddress(input.token),
      permit2: getAddress(input.permit2),
      router: getAddress(input.router),
      nativeInput: true,
      needsTokenApproval: false,
      needsPermit2Approval: false,
      ready: true,
      tokenApprovalCall: null,
      permit2ApprovalCall: null,
    };
  }
  const needsTokenApproval = input.tokenAllowance < input.amount;
  const needsPermit2Approval = !hasUsablePermit2Allowance(
    input.permit2Allowance,
    input.permit2Expiration,
    input.amount,
    input.currentTimestamp
  );
  return {
    token: getAddress(input.token),
    permit2: getAddress(input.permit2),
    router: getAddress(input.router),
    nativeInput: false,
    needsTokenApproval,
    needsPermit2Approval,
    ready: !needsTokenApproval && !needsPermit2Approval,
    tokenApprovalCall: needsTokenApproval
      ? {
          target: getAddress(input.token),
          calldata: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [getAddress(input.permit2), MAX_ERC20_ALLOWANCE],
          }),
        }
      : null,
    permit2ApprovalCall: needsPermit2Approval
      ? {
          target: getAddress(input.permit2),
          calldata: buildPermit2ApproveCall(
            getAddress(input.token),
            getAddress(input.router),
            MAX_PERMIT2_ALLOWANCE,
            MAX_PERMIT2_EXPIRATION
          ),
        }
      : null,
  };
}

export async function readPublicSwapApprovalPlan(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  owner: Address;
  token: Address;
  amount: bigint;
  currentTimestamp: number;
  nativeInput?: boolean;
}): Promise<PublicSwapApprovalPlan> {
  if (input.nativeInput) {
    return planPublicSwapApprovals({
      token: input.token,
      permit2: input.deployment.contracts.permit2,
      router: input.deployment.contracts.universalRouter,
      amount: input.amount,
      tokenAllowance: 0n,
      permit2Allowance: 0n,
      permit2Expiration: 0,
      currentTimestamp: input.currentTimestamp,
      nativeInput: true,
    });
  }
  const [tokenAllowance, permit2] = await Promise.all([
    input.publicClient.readContract({
      address: input.token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [input.owner, input.deployment.contracts.permit2],
    }),
    input.publicClient.readContract({
      address: input.deployment.contracts.permit2,
      abi: permit2AllowanceAbi,
      functionName: "allowance",
      args: [input.owner, input.token, input.deployment.contracts.universalRouter],
    }),
  ]);
  return planPublicSwapApprovals({
    token: input.token,
    permit2: input.deployment.contracts.permit2,
    router: input.deployment.contracts.universalRouter,
    amount: input.amount,
    tokenAllowance,
    permit2Allowance: permit2[0],
    permit2Expiration: permit2[1],
    currentTimestamp: input.currentTimestamp,
  });
}

export function buildPublicExactInputSwap(input: {
  deployment: PhaseOneDeployment;
  pool: PublicPoolSelection;
  quote: PublicSwapQuote;
  slippageBps: number;
  deadline: bigint;
  wrappedNative?: Address;
  nativeInput?: boolean;
  nativeOutput?: boolean;
  permit?: Readonly<{ permitSingle: Permit2PermitSingle; signature: Hex }>;
}): Readonly<{ target: Address; calldata: Hex; value: bigint; minimumAmountOut: bigint }> {
  if (input.quote.poolId.toLowerCase() !== input.pool.poolId.toLowerCase()) {
    throw new Error("The quote does not belong to the selected public pool.");
  }
  if (input.nativeInput && input.nativeOutput) {
    throw new Error("A public swap cannot use native currency on both sides.");
  }
  if ((input.nativeInput || input.nativeOutput) && !input.wrappedNative) {
    throw new Error("Wrapped native currency is required for native settlement.");
  }
  const minimumAmountOut = minimumSwapOutput(input.quote.amountOut, input.slippageBps);
  const settlement = input.nativeInput
    ? ({ input: "native", output: "erc20", wrappedNative: input.wrappedNative! } as const)
    : input.nativeOutput
      ? ({ input: "erc20", output: "native", wrappedNative: input.wrappedNative! } as const)
      : ({ input: "erc20", output: "erc20" } as const);
  const execution = buildV4ExactInputSingleSwap({
    router: input.deployment.contracts.universalRouter,
    poolKey: input.pool.poolKey,
    zeroForOne: input.quote.zeroForOne,
    amountIn: input.quote.amountIn,
    amountOutMinimum: minimumAmountOut,
    deadline: input.deadline,
    permit: input.permit,
    settlement,
  });
  if (getAddress(execution.target) !== getAddress(input.deployment.contracts.universalRouter)) {
    throw new Error("The SDK produced an unexpected swap target.");
  }
  return { ...execution, minimumAmountOut };
}

export async function simulatePublicExactInputSwap(input: {
  publicClient: PublicClient;
  wallet: Address;
  transaction: Readonly<{ target: Address; calldata: Hex; value: bigint }>;
}): Promise<void> {
  await input.publicClient.call({
    account: input.wallet,
    to: input.transaction.target,
    data: input.transaction.calldata,
    value: input.transaction.value,
  });
}
