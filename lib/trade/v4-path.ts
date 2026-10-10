import {
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  parseAbi,
  parseAbiParameters,
  toHex,
  type Address,
  type Hex,
} from "viem";

/**
 * Multi-pool exact-input swaps use IV4Router.ExactInputParams, including its maxHopSlippage
 * array. An empty per-hop array leaves the reviewed overall minimum as the payout limit.
 */
export type PathPool = Readonly<{
  poolId: Hex;
  poolKey: Readonly<{
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  }>;
  swappable: boolean;
  reviewed?: boolean;
}>;
export type PathHop = Readonly<{
  poolId: Hex;
  intermediateCurrency: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
  reviewed: boolean;
}>;

const lower = (address: Address) => address.toLowerCase();

/**
 * Simple paths of 2 to `maxPools` pools from `input` to `output`, fewest pools first and,
 * among those, paths through reviewed pools first. Single-pool trades are routed directly.
 */
export function candidatePaths(
  input: Address,
  output: Address,
  pools: readonly PathPool[],
  maxPools = 3,
  limit = 8
): PathHop[][] {
  const usable = pools.filter((pool) => pool.swappable);
  const found: PathHop[][] = [];
  const walk = (at: Address, hops: PathHop[], seen: Set<string>) => {
    if (hops.length >= maxPools) return;
    for (const pool of usable) {
      const { currency0, currency1 } = pool.poolKey;
      const next =
        lower(currency0) === lower(at)
          ? currency1
          : lower(currency1) === lower(at)
            ? currency0
            : null;
      if (!next || seen.has(lower(next)) || hops.some((hop) => hop.poolId === pool.poolId))
        continue;
      const hop: PathHop = {
        poolId: pool.poolId,
        intermediateCurrency: getAddress(next),
        fee: pool.poolKey.fee,
        tickSpacing: pool.poolKey.tickSpacing,
        hooks: pool.poolKey.hooks,
        reviewed: pool.reviewed !== false,
      };
      if (lower(next) === lower(output)) {
        if (hops.length >= 1) found.push([...hops, hop]);
        continue;
      }
      walk(next, [...hops, hop], new Set([...seen, lower(next)]));
    }
  };
  walk(getAddress(input), [], new Set([lower(input)]));
  return found
    .sort(
      (a, b) =>
        a.length - b.length ||
        a.filter((hop) => !hop.reviewed).length - b.filter((hop) => !hop.reviewed).length
    )
    .slice(0, limit);
}

const pathKeys = (path: readonly PathHop[]) =>
  path.map((hop) => ({
    intermediateCurrency: hop.intermediateCurrency,
    fee: hop.fee,
    tickSpacing: hop.tickSpacing,
    hooks: hop.hooks,
    hookData: "0x" as Hex,
  }));

const quoterAbi = parseAbi([
  "struct PathKey { address intermediateCurrency; uint24 fee; int24 tickSpacing; address hooks; bytes hookData; }",
  "struct QuoteExactParams { address exactCurrency; PathKey[] path; uint128 exactAmount; }",
  "function quoteExactInput(QuoteExactParams params) returns (uint256 amountOut, uint256 gasEstimate)",
]);
export { quoterAbi as v4PathQuoterAbi };

export function buildQuoteV4ExactInputCall(
  currencyIn: Address,
  path: readonly PathHop[],
  amountIn: bigint
): Hex {
  return encodeFunctionData({
    abi: quoterAbi,
    functionName: "quoteExactInput",
    args: [{ exactCurrency: currencyIn, path: pathKeys(path), exactAmount: amountIn }],
  });
}

type Settlement =
  | Readonly<{ input: "erc20"; output: "erc20" }>
  | Readonly<{ input: "native"; output: "erc20"; wrappedNative: Address }>
  | Readonly<{ input: "erc20"; output: "native"; wrappedNative: Address }>;

const MSG_SENDER = "0x0000000000000000000000000000000000000001";
const ROUTER_SELF = "0x0000000000000000000000000000000000000002";
const routerAbi = parseAbi([
  "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable",
]);

/** Universal Router calldata for a multi-pool exact-input swap, mirroring the SDK's single-pool builder. */
export function buildV4ExactInputPathSwap(request: {
  router: Address;
  currencyIn: Address;
  path: readonly PathHop[];
  amountIn: bigint;
  amountOutMinimum: bigint;
  deadline: bigint;
  settlement: Settlement;
}) {
  const max128 = (1n << 128n) - 1n;
  if (request.amountIn <= 0n || request.amountIn > max128) throw new Error("Invalid swap input.");
  if (request.amountOutMinimum < 0n || request.amountOutMinimum > max128)
    throw new Error("Invalid minimum output.");
  if (request.path.length < 2) throw new Error("A path swap needs at least two pools.");
  const settlement = request.settlement;
  const nativeInput = settlement.input === "native",
    nativeOutput = settlement.output === "native";
  const outputCurrency = request.path.at(-1)!.intermediateCurrency;
  if (
    settlement.input === "native" &&
    lower(settlement.wrappedNative) !== lower(request.currencyIn)
  )
    throw new Error("Native input must enter as the wrapped-native currency.");
  if (settlement.output === "native" && lower(settlement.wrappedNative) !== lower(outputCurrency))
    throw new Error("Native output must leave as the wrapped-native currency.");
  const swap = encodeAbiParameters(
    parseAbiParameters(
      "(address currencyIn,(address intermediateCurrency,uint24 fee,int24 tickSpacing,address hooks,bytes hookData)[] path,uint256[] maxHopSlippage,uint128 amountIn,uint128 amountOutMinimum)"
    ),
    [
      {
        currencyIn: request.currencyIn,
        path: pathKeys(request.path),
        maxHopSlippage: [],
        amountIn: request.amountIn,
        amountOutMinimum: request.amountOutMinimum,
      },
    ]
  );
  // Actions: SWAP_EXACT_IN (0x07), then SETTLE (0x0b) / SETTLE_ALL (0x0c), TAKE (0x0e) / TAKE_ALL (0x0f).
  const actions = toHex(
    new Uint8Array(
      nativeInput ? [0x07, 0x0b, 0x0f] : nativeOutput ? [0x07, 0x0c, 0x0e] : [0x07, 0x0c, 0x0f]
    )
  );
  const params = [
    swap,
    nativeInput
      ? encodeAbiParameters(
          parseAbiParameters("address currency,uint256 amount,bool payerIsUser"),
          [request.currencyIn, request.amountIn, false]
        )
      : encodeAbiParameters(parseAbiParameters("address currency,uint256 amount"), [
          request.currencyIn,
          request.amountIn,
        ]),
    nativeOutput
      ? encodeAbiParameters(
          parseAbiParameters("address currency,address recipient,uint256 amount"),
          [outputCurrency, ROUTER_SELF, 0n]
        )
      : encodeAbiParameters(parseAbiParameters("address currency,uint256 minimumAmount"), [
          outputCurrency,
          request.amountOutMinimum,
        ]),
  ];
  const plan = encodeAbiParameters(parseAbiParameters("bytes actions,bytes[] params"), [
    actions,
    params,
  ]);
  // Commands: WRAP_ETH (0x0b), V4_SWAP (0x10), UNWRAP_WETH (0x0c).
  const commands = toHex(
    new Uint8Array(nativeInput ? [0x0b, 0x10] : nativeOutput ? [0x10, 0x0c] : [0x10])
  );
  const inputs = nativeInput
    ? [
        encodeAbiParameters(parseAbiParameters("address recipient,uint256 amount"), [
          ROUTER_SELF,
          request.amountIn,
        ]),
        plan,
      ]
    : nativeOutput
      ? [
          plan,
          encodeAbiParameters(parseAbiParameters("address recipient,uint256 amountMinimum"), [
            MSG_SENDER,
            request.amountOutMinimum,
          ]),
        ]
      : [plan];
  return {
    target: request.router,
    calldata: encodeFunctionData({
      abi: routerAbi,
      functionName: "execute",
      args: [commands, inputs, request.deadline],
    }),
    value: nativeInput ? request.amountIn : 0n,
  };
}
