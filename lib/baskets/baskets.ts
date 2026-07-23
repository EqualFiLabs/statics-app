import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  decodeFunctionResult,
  getAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import {
  BasketStatus,
  basketTokenAbi,
  staticsAbi,
  staticsBasketErrorAbi,
  type BasketConfiguration,
  type FeeTier,
} from "@statics-protocol/sdk";

import type { DollarDeployment } from "@/lib/dollar/deployment";

const BPS = 10_000n;
export const DEFAULT_BASKET_SLIPPAGE_BPS = 50;
export const MAX_BASKET_SLIPPAGE_BPS = 500;

export type TokenMetadata = Readonly<{
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  metadataAvailable: boolean;
}>;

export type BasketConstituent = Readonly<{
  token: TokenMetadata;
  bundleAmount: bigint;
  vaultBalance: bigint;
  walletBalance: bigint;
  allowance: bigint;
}>;

export type BasketRecord = Readonly<{
  basketId: bigint;
  name: string;
  symbol: string;
  token: TokenMetadata;
  creator: Address;
  status: number;
  totalSupply: bigint;
  walletBalance: bigint;
  constituents: readonly BasketConstituent[];
  mintFeeTiers: readonly FeeTier[];
  redemptionFeeTiers: readonly FeeTier[];
  flashFeeBps: number;
  originationFeeBps: number;
  extensionFeeBps: number;
  ltvBps: number;
  loanDuration: number;
}>;

export type BasketCatalog = Readonly<{
  baskets: readonly BasketRecord[];
  warning: string | null;
}>;

export async function loadTokenMetadata(
  publicClient: PublicClient,
  address: Address,
  fallback?: Readonly<{ name?: string; symbol?: string }>
): Promise<TokenMetadata> {
  const [name, symbol, decimals] = await Promise.all([
    publicClient
      .readContract({ address, abi: basketTokenAbi, functionName: "name" })
      .catch(() => null),
    publicClient
      .readContract({ address, abi: basketTokenAbi, functionName: "symbol" })
      .catch(() => null),
    publicClient
      .readContract({ address, abi: basketTokenAbi, functionName: "decimals" })
      .catch(() => null),
  ]);
  const metadataAvailable =
    typeof name === "string" &&
    name.length > 0 &&
    typeof symbol === "string" &&
    symbol.length > 0 &&
    typeof decimals === "number";
  return {
    address,
    name:
      typeof name === "string" && name.length > 0
        ? name
        : fallback?.name || `Token ${address.slice(0, 6)}…${address.slice(-4)}`,
    symbol:
      typeof symbol === "string" && symbol.length > 0
        ? symbol
        : fallback?.symbol || `${address.slice(0, 6)}…${address.slice(-4)}`,
    decimals: typeof decimals === "number" ? decimals : 18,
    metadataAvailable,
  };
}

async function loadBasket(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  basketId: bigint,
  wallet: Address | null,
  eventMetadata?: Readonly<{ name: string; symbol: string }>
): Promise<BasketRecord> {
  const configured = (await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "basket",
    args: [basketId],
  })) as BasketConfiguration;
  const token = getAddress(configured.token);
  const [tokenMetadata, totalSupply, walletBalance] = await Promise.all([
    loadTokenMetadata(publicClient, token, eventMetadata),
    publicClient.readContract({
      address: token,
      abi: basketTokenAbi,
      functionName: "totalSupply",
    }),
    wallet
      ? publicClient.readContract({
          address: token,
          abi: basketTokenAbi,
          functionName: "balanceOf",
          args: [wallet],
        })
      : 0n,
  ]);
  const constituents = await Promise.all(
    configured.assets.map(async (asset, index): Promise<BasketConstituent> => {
      const address = getAddress(asset);
      const [metadata, vaultBalance, constituentBalance, allowance] = await Promise.all([
        loadTokenMetadata(publicClient, address),
        publicClient.readContract({
          address: deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "vaultBalance",
          args: [basketId, address],
        }),
        wallet
          ? publicClient.readContract({
              address,
              abi: basketTokenAbi,
              functionName: "balanceOf",
              args: [wallet],
            })
          : 0n,
        wallet
          ? publicClient.readContract({
              address,
              abi: basketTokenAbi,
              functionName: "allowance",
              args: [wallet, deployment.contracts.diamond],
            })
          : 0n,
      ]);
      return {
        token: metadata,
        bundleAmount: configured.bundleAmounts[index] ?? 0n,
        vaultBalance,
        walletBalance: constituentBalance,
        allowance,
      };
    })
  );
  return {
    basketId,
    name: tokenMetadata.name,
    symbol: tokenMetadata.symbol,
    token: tokenMetadata,
    creator: getAddress(configured.creator),
    status: Number(configured.status),
    totalSupply,
    walletBalance,
    constituents,
    mintFeeTiers: configured.mintFeeTiers,
    redemptionFeeTiers: configured.redemptionFeeTiers,
    flashFeeBps: Number(configured.flashFeeBps),
    originationFeeBps: Number(configured.originationFeeBps),
    extensionFeeBps: Number(configured.extensionFeeBps),
    ltvBps: Number(configured.ltvBps),
    loanDuration: Number(configured.loanDuration),
  };
}

export async function loadBasketCatalog(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  wallet: Address | null
): Promise<BasketCatalog> {
  const [count, logs] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "basketCount",
    }),
    publicClient.getContractEvents({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      eventName: "BasketCreated",
      fromBlock: deployment.deploymentStartBlock,
      toBlock: "latest",
      strict: true,
    }),
  ]);
  if (count > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("The basket registry is too large for this client.");
  }
  const eventMetadata = new Map(
    logs.map((log) => [log.args.basketId, { name: log.args.name, symbol: log.args.symbol }])
  );
  const baskets = await Promise.all(
    Array.from({ length: Number(count) }, (_, index) => {
      const basketId = BigInt(index);
      return loadBasket(publicClient, deployment, basketId, wallet, eventMetadata.get(basketId));
    })
  );
  const eventIds = new Set(logs.map((log) => log.args.basketId.toString()));
  const warning =
    eventIds.size === Number(count) &&
    baskets.every((basket) => eventIds.has(basket.basketId.toString()))
      ? null
      : "Creation-event history is incomplete; current onchain basket state is shown.";
  return { baskets, warning };
}

export function basketStatusLabel(status: number): string {
  if (status === BasketStatus.Active) return "Active";
  if (status === BasketStatus.Quarantined) return "Quarantined";
  if (status === BasketStatus.ExitOnly) return "Exit only";
  return `Unknown (${status})`;
}

export function maximumWithSlippage(amount: bigint, slippageBps: number): bigint {
  const bps = BigInt(slippageBps);
  return amount === 0n ? 0n : (amount * (BPS + bps) + BPS - 1n) / BPS;
}

export function minimumWithSlippage(amount: bigint, slippageBps: number): bigint {
  return (amount * (BPS - BigInt(slippageBps))) / BPS;
}

export function parseSlippageBps(value: string): number | null {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return null;
  const bps = Math.round(Number(value) * 100);
  return Number.isInteger(bps) && bps >= 0 && bps <= MAX_BASKET_SLIPPAGE_BPS ? bps : null;
}

export type BasketQuoteState = "idle" | "refreshing" | "ready" | "error";
export type BasketActionAvailability = Readonly<{
  kind: "needs-input" | "blocked" | "refreshing" | "approve" | "execute";
  label: string;
  reason: string | null;
  approvalIndex?: number;
  executable: boolean;
}>;

export function deriveBasketActionAvailability(input: {
  mode: "mint" | "redeem";
  amount: bigint;
  status: number;
  quoteState: BasketQuoteState;
  slippageBps: number | null;
  walletBalance: bigint;
  constituents: readonly Pick<BasketConstituent, "walletBalance" | "allowance">[];
  quoteAmounts: readonly bigint[] | null;
}): BasketActionAvailability {
  if (input.amount <= 0n) {
    return { kind: "needs-input", label: "Enter basket amount", reason: null, executable: false };
  }
  if (input.slippageBps === null) {
    return {
      kind: "blocked",
      label: "Review slippage",
      reason: "Slippage must be between 0% and 5%.",
      executable: false,
    };
  }
  if (input.mode === "mint" && input.status !== BasketStatus.Active) {
    return {
      kind: "blocked",
      label: "Mint unavailable",
      reason: "Only active baskets can increase exposure.",
      executable: false,
    };
  }
  if (input.mode === "redeem" && input.amount > input.walletBalance) {
    return {
      kind: "blocked",
      label: "Redeem unavailable",
      reason: "This wallet does not have enough BasketToken.",
      executable: false,
    };
  }
  if (input.quoteState === "error") {
    return {
      kind: "blocked",
      label: `${input.mode === "mint" ? "Mint" : "Redeem"} unavailable`,
      reason: "The protocol could not produce a current quote.",
      executable: false,
    };
  }
  if (input.quoteState !== "ready" || !input.quoteAmounts) {
    return {
      kind: "refreshing",
      label: input.quoteState === "idle" ? "Load quote" : "Refreshing quote…",
      reason: "Wait for a current onchain quote.",
      executable: false,
    };
  }
  if (input.quoteAmounts.some((amount) => amount <= 0n)) {
    return {
      kind: "blocked",
      label: `${input.mode === "mint" ? "Mint" : "Redeem"} unavailable`,
      reason: "The current quote contains a zero-value constituent.",
      executable: false,
    };
  }
  if (input.mode === "mint") {
    for (let index = 0; index < input.constituents.length; index += 1) {
      const maximum = maximumWithSlippage(input.quoteAmounts[index] ?? 0n, input.slippageBps);
      const constituent = input.constituents[index];
      if (!constituent || constituent.walletBalance < maximum) {
        return {
          kind: "blocked",
          label: "Mint unavailable",
          reason: "This wallet does not have enough of every constituent.",
          executable: false,
        };
      }
      if (constituent.allowance < maximum) {
        return {
          kind: "approve",
          label: `Approve constituent ${index + 1}`,
          reason: null,
          approvalIndex: index,
          executable: true,
        };
      }
    }
  }
  return {
    kind: "execute",
    label: input.mode === "mint" ? "Mint basket" : "Redeem basket",
    reason: null,
    executable: true,
  };
}

const basketErrorMessages: Readonly<Record<string, string>> = {
  BasketNotFound: "This basket no longer exists.",
  InvalidShares: "Enter a valid BasketToken amount.",
  MaximumInputExceeded: "A constituent input moved above your selected slippage limit.",
  MinimumOutputNotMet: "A constituent output moved below your selected slippage limit.",
  ActionPaused: "This basket operation is currently paused.",
  InsufficientVaultBalance: "The basket vault cannot satisfy the requested redemption.",
  InsufficientTransferReceived: "A constituent transferred less than the protocol required.",
  BasketNotActive: "This basket cannot currently increase exposure.",
};

function findHexData(error: unknown): Hex | null {
  if (!(error instanceof BaseError)) return null;
  const revert = error.walk(
    (candidate) => candidate instanceof ContractFunctionRevertedError
  ) as ContractFunctionRevertedError | null;
  return revert?.raw ?? null;
}

export function describeBasketError(error: unknown): string {
  const data = findHexData(error);
  if (data) {
    try {
      const decoded = decodeErrorResult({ abi: staticsBasketErrorAbi, data });
      const message =
        basketErrorMessages[decoded.errorName] ?? "The protocol rejected this action.";
      return `${message} (${decoded.errorName})`;
    } catch {
      // Preserve the technical fallback for errors outside the basket ABI.
    }
  }
  const message = error instanceof Error ? error.message : "The wallet request failed.";
  const known = Object.entries(basketErrorMessages).find(([name]) => message.includes(name));
  if (known) return `${known[1]} (${known[0]})`;
  if (/rejected|denied|4001/i.test(message)) return "The wallet request was rejected.";
  return message;
}

export function validateBasketSimulation(
  functionName: "mint" | "redeem",
  result: Hex | undefined,
  expectedLegs: number
): readonly bigint[] {
  if (!result) throw new Error(`The basket ${functionName} simulation returned no result.`);
  const amounts = decodeFunctionResult({ abi: staticsAbi, functionName, data: result });
  if (amounts.length !== expectedLegs || amounts.some((amount) => amount <= 0n)) {
    throw new Error(`The basket ${functionName} simulation returned invalid constituent amounts.`);
  }
  return amounts;
}
