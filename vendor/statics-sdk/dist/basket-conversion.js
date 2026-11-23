import { encodeAbiParameters, encodeFunctionData, parseAbi, parseAbiParameters, } from "viem";
const key = "(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)";
const route = `(address[] currencies,${key}[] pools,bytes[] hookData)`;
const request = `(uint256 deadline,uint256 limit,uint256[] routeLimits,bool preset,${route}[] routes)`;
const step = `(${key} key,(bool zeroForOne,int256 amountSpecified,uint160 sqrtPriceLimitX96) params,bytes data)`;
const bounds = "(uint256 maxQuoteIn,uint256 minQuoteOut,uint256 minBasketOut,uint256 deadline)";
export const staticsBasketConversionAbi = parseAbi([
    "function basketConversionConfiguration() view returns ((address hook,address zap,address router,address poolManager))",
    `function basketConversionMarket(bytes32 poolId) view returns ((${key} key,uint256 basketId,address basketToken,address quote,bool active))`,
    "function createBasketConversionMarket(uint256 basketId,address quote,uint256 maximumCreationFee,uint256 deadline) payable returns (bytes32)",
    "function decommissionBasketConversionMarket(bytes32 poolId)",
    "function mintBasketConversion(bytes32 poolId,uint256 shares,address receiver,uint256[] expected)",
    "function prefundBasketConversion(bytes32 poolId,address payer,uint256 amount)",
    "event BasketConversionMarketCreated(bytes32 indexed poolId,uint256 indexed basketId,address indexed quote)",
    "event BasketConversionMarketDecommissioned(bytes32 indexed poolId)",
]);
export const staticsBasketConversionZapAbi = parseAbi([
    `function buy(bytes32 poolId,uint256 shares,address receiver,${request} r) returns (uint256)`,
    `function sell(bytes32 poolId,uint256 shares,address receiver,${request} r) returns (uint256)`,
]);
export const staticsBasketConversionHookAbi = parseAbi([
    `function setPreset(bytes32 poolId,bool buying,${route}[] paths)`,
    `function preset(bytes32 poolId,bool buying) view returns (${route}[])`,
    "event BasketConversionPresetSet(bytes32 indexed poolId,bool indexed buying,bytes32 routesHash)",
]);
export const staticsBasketConversionRouterAbi = parseAbi([
    `function execute(bytes32 poolId,${step}[] steps,uint256 prefund,${bounds} bounds) returns (int256 quoteDelta)`,
]);
const requestParameters = parseAbiParameters(`${request} r`);
function uint(value, label) {
    if (value < 0n || value >= 1n << 256n)
        throw new Error(`invalid ${label}`);
}
/** Bounds include existing basket charges and underlying swaps; no outer conversion fee is added. */
export function validateBasketConversionRequest(r) {
    uint(r.deadline, "deadline");
    uint(r.limit, "aggregate bound");
    if (r.routeLimits.length < 1 || r.routeLimits.length > 16)
        throw new Error("invalid constituent count");
    r.routeLimits.forEach(v => uint(v, "route bound"));
    if (r.preset ? r.routes.length !== 0 : r.routes.length !== r.routeLimits.length)
        throw new Error("route count mismatch");
    for (const path of r.routes) {
        if (path.pools.length > 4 || path.currencies.length !== path.pools.length + 1 || path.hookData.length !== path.pools.length)
            throw new Error("invalid route shape");
        const currencies = path.currencies.map(a => a.toLowerCase());
        if (currencies.some(a => /^0x0{40}$/.test(a)) || new Set(currencies).size !== currencies.length)
            throw new Error("native or cyclic route");
        for (let i = 0; i < path.pools.length; i++) {
            const a = currencies[i];
            const b = currencies[i + 1];
            if (path.pools[i].currency0.toLowerCase() !== (a < b ? a : b) || path.pools[i].currency1.toLowerCase() !== (a < b ? b : a))
                throw new Error("pool currencies mismatch");
        }
    }
}
/** Hook modes are exact basket output when buying and exact basket input when selling. */
export function encodeBasketConversionRequest(r) {
    validateBasketConversionRequest(r);
    return encodeAbiParameters(requestParameters, [r]);
}
function validateZap(shares, r) {
    validateBasketConversionRequest(r);
    if (shares <= 0n || shares > (1n << 127n) - 1n)
        throw new Error("invalid shares");
}
export function buildBasketConversionZapCall(mode, poolId, shares, receiver, r) {
    validateZap(shares, r);
    return encodeFunctionData({ abi: staticsBasketConversionZapAbi, functionName: mode, args: [poolId, shares, receiver, r] });
}
function validateRouter(steps, prefund, b) {
    if (steps.length < 1 || steps.length > 4)
        throw new Error("invalid step count");
    uint(prefund, "prefund");
    Object.entries(b).forEach(([name, value]) => uint(value, name));
}
export function buildBasketConversionRouterCall(poolId, steps, prefund, b) {
    validateRouter(steps, prefund, b);
    return encodeFunctionData({ abi: staticsBasketConversionRouterAbi, functionName: "execute", args: [poolId, steps, prefund, b] });
}
export function buildCreateBasketConversionMarketCall(basketId, quote, maximumCreationFee, deadline) {
    return encodeFunctionData({ abi: staticsBasketConversionAbi, functionName: "createBasketConversionMarket", args: [basketId, quote, maximumCreationFee, deadline] });
}
export async function readBasketConversionMarket(client, diamond, poolId) {
    return client.readContract({ address: diamond, abi: staticsBasketConversionAbi, functionName: "basketConversionMarket", args: [poolId] });
}
/** Simulate from the real payer: approvals, lifecycle, route liquidity and fee rounding affect executability. */
export async function simulateBasketConversionZap(client, zap, payer, mode, poolId, shares, receiver, r) {
    validateZap(shares, r);
    return client.simulateContract({ address: zap, account: payer, abi: staticsBasketConversionZapAbi, functionName: mode, args: [poolId, shares, receiver, r] });
}
export async function simulateBasketConversionRouter(client, router, payer, poolId, steps, prefund, b) {
    validateRouter(steps, prefund, b);
    return client.simulateContract({ address: router, account: payer, abi: staticsBasketConversionRouterAbi, functionName: "execute", args: [poolId, steps, prefund, b] });
}
/** Discover registered identities over an explicit block range; retired markets remain discoverable. */
export async function discoverBasketConversionMarkets(client, diamond, fromBlock, toBlock, basketId) {
    const events = await client.getContractEvents({ address: diamond, abi: staticsBasketConversionAbi,
        eventName: "BasketConversionMarketCreated", args: basketId === undefined ? {} : { basketId }, fromBlock, toBlock });
    return Promise.all(events.map(event => readBasketConversionMarket(client, diamond, event.args.poolId)));
}
export const staticsBasketDistributorAbi = parseAbi([
    "function setBasketDistributor(uint256 basketId,address account,bool allowed)",
    "function isBasketDistributor(uint256 basketId,address account) view returns (bool)",
    "event BasketDistributorSet(uint256 indexed basketId,address indexed account,bool allowed)",
]);
const basketQuoteAbi = parseAbi([
    "function basket(uint256 basketId) view returns ((address token,address creator,uint8 status,address[] assets,uint256[] bundleAmounts,(uint256 minActionShares,uint256 feeShares)[] mintFeeTiers,(uint256 minActionShares,uint256 feeShares)[] redemptionFeeTiers,uint16 flashFeeBps,uint16 originationFeeBps,uint16 extensionFeeBps,uint16 ltvBps,uint16 recoveryPenaltyBps,uint40 loanDuration) result)",
    "function quoteMint(uint256 basketId,uint256 shares) view returns (uint256[])",
    "function quoteRedeem(uint256 basketId,uint256 shares) view returns (uint256[])",
    "function protocolPoolSwapsBlocked(bytes32 poolId) view returns (bool)",
]);
const singleQuoteParams = `(${key} poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData)`;
const conversionQuoterAbi = parseAbi([
    `function quoteExactInputSingle(${singleQuoteParams} params) returns (uint256 amount,uint256 gasEstimate)`,
    `function quoteExactOutputSingle(${singleQuoteParams} params) returns (uint256 amount,uint256 gasEstimate)`,
]);
export async function quoteReviewedBasketConversion(client, diamond, quoter, reviewed, mode, shares, slippageBps) {
    if (shares <= 0n || shares >= 1n << 127n)
        throw new Error("invalid shares");
    if (slippageBps < 0n || slippageBps > 500n)
        throw new Error("invalid slippage");
    if (await client.getChainId() !== reviewed.chainId)
        throw new Error("wrong conversion chain");
    const block = await client.getBlock({ blockTag: "latest" });
    const blockNumber = block.number;
    const [basketMarket, configuration, blocked, amounts, basket] = await Promise.all([
        client.readContract({ address: diamond, abi: staticsBasketConversionAbi,
            functionName: "basketConversionMarket", args: [reviewed.poolId], blockNumber }),
        client.readContract({ address: diamond, abi: staticsBasketConversionAbi,
            functionName: "basketConversionConfiguration", blockNumber }),
        client.readContract({ address: diamond, abi: basketQuoteAbi,
            functionName: "protocolPoolSwapsBlocked", args: [reviewed.poolId], blockNumber }),
        client.readContract({ address: diamond, abi: basketQuoteAbi,
            functionName: mode === "buy" ? "quoteMint" : "quoteRedeem",
            args: [reviewed.basketId, shares], blockNumber }),
        client.readContract({ address: diamond, abi: basketQuoteAbi, functionName: "basket",
            args: [reviewed.basketId], blockNumber }),
    ]);
    const same = (left, right) => left.toLowerCase() === right.toLowerCase();
    if (!basketMarket.active || blocked || basketMarket.basketId !== reviewed.basketId ||
        basket.status !== 0 || !same(basket.token, basketMarket.basketToken) ||
        !same(basketMarket.quote, reviewed.quote) || !same(basketMarket.key.hooks, configuration.hook)) {
        throw new Error("conversion market unavailable");
    }
    if (mode === "sell" && !await client.readContract({
        address: diamond, abi: staticsBasketDistributorAbi, functionName: "isBasketDistributor",
        args: [reviewed.basketId, configuration.zap], blockNumber,
    }))
        throw new Error("conversion sell unavailable");
    if (amounts.length !== reviewed.assets.length || amounts.length !== reviewed.pools.length ||
        amounts.length === 0 || amounts.length > 16 || basket.assets.length !== reviewed.assets.length ||
        basket.assets.some((asset, index) => !same(asset, reviewed.assets[index])))
        throw new Error("incomplete constituent routes");
    const routes = reviewed.assets.map((asset, index) => {
        const pool = reviewed.pools[index];
        if (same(asset, reviewed.quote)) {
            if (pool !== null)
                throw new Error("quote constituent requires a zero-hop route");
            return { currencies: [asset], pools: [], hookData: [] };
        }
        if (!pool || same(pool.hooks, configuration.hook) ||
            !((same(pool.currency0, reviewed.quote) && same(pool.currency1, asset)) ||
                (same(pool.currency1, reviewed.quote) && same(pool.currency0, asset)))) {
            throw new Error("missing reviewed constituent route");
        }
        return { currencies: [reviewed.quote, asset], pools: [pool], hookData: ["0x"] };
    });
    const legs = await Promise.all(routes.map(async (route, index) => {
        const poolKey = route.pools[0];
        const exactAmount = amounts[index];
        if (!poolKey || exactAmount === 0n)
            return exactAmount;
        if (exactAmount >= 1n << 127n)
            throw new Error("constituent amount exceeds the swap limit");
        const input = mode === "buy" ? reviewed.quote : reviewed.assets[index];
        const { result: [amount] } = await client.simulateContract({
            address: quoter, abi: conversionQuoterAbi,
            functionName: mode === "buy" ? "quoteExactOutputSingle" : "quoteExactInputSingle",
            args: [{ poolKey, zeroForOne: same(poolKey.currency0, input), exactAmount, hookData: "0x" }],
            blockNumber,
        });
        if (amount === 0n)
            throw new Error("constituent route returned no quote");
        return amount;
    }));
    const total = legs.reduce((acc, amount) => acc + amount, 0n);
    const bound = (value) => mode === "buy"
        ? (value * (10000n + slippageBps) + 9999n) / 10000n
        : value * (10000n - slippageBps) / 10000n;
    const request = {
        deadline: block.timestamp + 120n, limit: bound(total), routeLimits: legs.map(bound), preset: false, routes,
    };
    if (request.limit === 0n)
        throw new Error("conversion quote too small");
    validateBasketConversionRequest(request);
    return { blockNumber, total, request, zap: configuration.zap, basketToken: basketMarket.basketToken };
}
