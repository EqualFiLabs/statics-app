import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildBasketConversionZapCall,
  quoteReviewedBasketConversion,
  simulateBasketConversionZap,
} from "@statics-protocol/sdk/basket-conversion";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  zeroAddress,
} from "viem";

const [rpc, marketFile, routesFile, chainFile] = process.argv.slice(2);
if (!rpc || !marketFile || !routesFile || !chainFile) {
  throw new Error(
    "Provide a local Anvil RPC, exported market, reviewed routes and chain manifest."
  );
}
const endpoint = new URL(rpc);
if (endpoint.protocol !== "http:" || endpoint.hostname !== "127.0.0.1") {
  throw new Error("The conversion rehearsal must run against loopback Anvil.");
}
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const market = readJson(marketFile);
const { routes } = readJson(routesFile);
const deployment = readJson(chainFile);
const chain = defineChain({
  id: deployment.chainId,
  name: "Robinhood fork",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const publicClient = createPublicClient({ chain, transport: http(rpc) });
await publicClient.request({ method: "anvil_nodeInfo" });
assert.equal(await publicClient.getChainId(), chain.id);

const buyer = market.buyer;
const wallet = createWalletClient({ account: buyer, chain, transport: http(rpc) });
const reviewed = {
  chainId: chain.id,
  basketId: BigInt(market.basketId),
  poolId: market.poolId,
  quote: market.quote,
  assets: market.assets,
  pools: market.assets.map((asset) => {
    const leg = routes.find((candidate) => candidate.token.toLowerCase() === asset.toLowerCase());
    assert.ok(leg, "reviewed route missing");
    const [currency0, currency1] = [asset, market.quote].map((value) => value.toLowerCase()).sort();
    return { currency0, currency1, fee: leg.fee, tickSpacing: leg.tickSpacing, hooks: zeroAddress };
  }),
};
const quoter = deployment.contracts.quoter.address;
const amount = 10n ** 18n;
const balance = (address) =>
  publicClient.readContract({ address, abi: erc20Abi, functionName: "balanceOf", args: [buyer] });
const supply = () =>
  publicClient.readContract({ address: market.token, abi: erc20Abi, functionName: "totalSupply" });
assert.equal(await supply(), 0n);
for (const asset of market.assets) assert.equal(await balance(asset), 0n);
const start = await balance(market.quote);

for (const mode of ["buy", "sell"]) {
  const quote = await quoteReviewedBasketConversion(
    publicClient,
    market.diamond,
    quoter,
    reviewed,
    mode,
    amount,
    50n
  );
  assert.equal(quote.zap.toLowerCase(), market.zap.toLowerCase());
  const approval = await wallet.writeContract({
    address: mode === "buy" ? market.quote : market.token,
    abi: erc20Abi,
    functionName: "approve",
    args: [quote.zap, mode === "buy" ? quote.request.limit : amount],
  });
  assert.equal(
    (await publicClient.waitForTransactionReceipt({ hash: approval })).status,
    "success"
  );
  const simulated = await simulateBasketConversionZap(
    publicClient,
    quote.zap,
    buyer,
    mode,
    market.poolId,
    amount,
    buyer,
    quote.request
  );
  const quoteBefore = await balance(market.quote);
  const hash = await wallet.sendTransaction({
    to: quote.zap,
    data: buildBasketConversionZapCall(mode, market.poolId, amount, buyer, quote.request),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success");
  assert.ok(receipt.gasUsed < (2n ** 24n * 9n) / 10n);
  const quoteAfter = await balance(market.quote);
  const received = mode === "buy" ? quoteBefore - quoteAfter : quoteAfter - quoteBefore;
  assert.equal(received, simulated.result);
  assert.equal(await balance(market.token), mode === "buy" ? amount : 0n);
  assert.equal(await supply(), mode === "buy" ? amount : 0n);
  for (const asset of market.assets) assert.equal(await balance(asset), 0n);
  console.log(`${mode}: ${receipt.gasUsed} gas, ${received} USDG base units`);
}
assert.ok((await balance(market.quote)) > 0n && start > 0n);
