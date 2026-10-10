import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import {
  buildV4ExactInputSingleSwap as buildSdkSwap,
  universalRouterAbi,
  type V4ExactInputSingleRequest,
} from "@statics-protocol/sdk";

export type SwapSettlement =
  | Readonly<{ input: "erc20"; output: "erc20" }>
  | Readonly<{ input: "native"; output: "erc20"; wrappedNative?: Address }>
  | Readonly<{ input: "erc20"; output: "native"; wrappedNative?: Address }>;

const self = "0x0000000000000000000000000000000000000002";
const sender = "0x0000000000000000000000000000000000000001";

/** Shared settlement for single and multi-pool swaps. Native PoolKeys never wrap ETH. */
export function buildV4Execution(request: {
  router: Address;
  currencyIn: Address;
  currencyOut: Address;
  swap: Hex;
  action: 0x06 | 0x07;
  amountIn: bigint;
  amountOutMinimum: bigint;
  deadline: bigint;
  settlement: SwapSettlement;
}) {
  const max128 = (1n << 128n) - 1n;
  if (request.amountIn <= 0n || request.amountIn > max128) throw new Error("Invalid swap input.");
  if (request.amountOutMinimum < 0n || request.amountOutMinimum > max128)
    throw new Error("Invalid minimum output.");
  const nativeInput = request.settlement.input === "native";
  const nativeOutput = request.settlement.output === "native";
  const wrap = nativeInput && request.currencyIn !== zeroAddress;
  const unwrap = nativeOutput && request.currencyOut !== zeroAddress;
  if (
    nativeInput &&
    request.settlement.input === "native" &&
    (wrap
      ? request.settlement.wrappedNative?.toLowerCase() !== request.currencyIn.toLowerCase()
      : request.settlement.wrappedNative !== undefined)
  )
    throw new Error("Native input does not match its settlement currency.");
  if (
    nativeOutput &&
    request.settlement.output === "native" &&
    (unwrap
      ? request.settlement.wrappedNative?.toLowerCase() !== request.currencyOut.toLowerCase()
      : request.settlement.wrappedNative !== undefined)
  )
    throw new Error("Native output does not match its settlement currency.");
  if (
    (request.currencyIn === zeroAddress) !== (nativeInput && !wrap) ||
    (request.currencyOut === zeroAddress) !== (nativeOutput && !unwrap)
  )
    throw new Error("Native pool currency requires native settlement.");
  const actions = toHex(
    new Uint8Array([request.action, nativeInput ? 0x0b : 0x0c, unwrap ? 0x0e : 0x0f])
  );
  const params = [
    request.swap,
    nativeInput
      ? encodeAbiParameters(
          parseAbiParameters("address currency,uint256 amount,bool payerIsUser"),
          [request.currencyIn, request.amountIn, false]
        )
      : encodeAbiParameters(parseAbiParameters("address currency,uint256 amount"), [
          request.currencyIn,
          request.amountIn,
        ]),
    unwrap
      ? encodeAbiParameters(
          parseAbiParameters("address currency,address recipient,uint256 amount"),
          [request.currencyOut, self, 0n]
        )
      : encodeAbiParameters(parseAbiParameters("address currency,uint256 minimumAmount"), [
          request.currencyOut,
          request.amountOutMinimum,
        ]),
  ];
  const plan = encodeAbiParameters(parseAbiParameters("bytes actions,bytes[] params"), [
    actions,
    params,
  ]);
  const commands = toHex(new Uint8Array(wrap ? [0x0b, 0x10] : unwrap ? [0x10, 0x0c] : [0x10]));
  const inputs = wrap
    ? [
        encodeAbiParameters(parseAbiParameters("address recipient,uint256 amount"), [
          self,
          request.amountIn,
        ]),
        plan,
      ]
    : unwrap
      ? [
          plan,
          encodeAbiParameters(parseAbiParameters("address recipient,uint256 amountMinimum"), [
            sender,
            request.amountOutMinimum,
          ]),
        ]
      : [plan];
  return {
    target: request.router,
    calldata: encodeFunctionData({
      abi: universalRouterAbi,
      functionName: "execute",
      args: [commands, inputs, request.deadline],
    }),
    value: nativeInput ? request.amountIn : 0n,
  };
}

/** Keep the SDK's legacy wrapped-native behavior and encode actual native pools locally. */
export function buildV4ExactInputSingleSwap(
  request: Omit<V4ExactInputSingleRequest, "settlement"> & { settlement: SwapSettlement }
) {
  const currencyIn = request.zeroForOne ? request.poolKey.currency0 : request.poolKey.currency1;
  const currencyOut = request.zeroForOne ? request.poolKey.currency1 : request.poolKey.currency0;
  if (currencyIn !== zeroAddress && currencyOut !== zeroAddress) {
    if (
      (request.settlement.input === "native" || request.settlement.output === "native") &&
      !request.settlement.wrappedNative
    )
      throw new Error("Wrapped-native settlement requires its configured currency.");
    return buildSdkSwap(request as V4ExactInputSingleRequest);
  }
  if (request.permit) throw new Error("Native-pool execution uses the existing approval flow.");
  const swap = encodeAbiParameters(
    parseAbiParameters(
      "((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,uint256 minHopPriceX36,bytes hookData)"
    ),
    [
      {
        poolKey: request.poolKey,
        zeroForOne: request.zeroForOne,
        amountIn: request.amountIn,
        amountOutMinimum: request.amountOutMinimum,
        minHopPriceX36: request.minHopPriceX36 ?? 0n,
        hookData: request.hookData ?? "0x",
      },
    ]
  );
  return buildV4Execution({ ...request, currencyIn, currencyOut, swap, action: 0x06 });
}
