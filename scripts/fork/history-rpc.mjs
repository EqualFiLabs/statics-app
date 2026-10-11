import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, readdir } from "node:fs/promises";
import { join } from "node:path";

const number = (value) =>
  typeof value === "string" && /^0x[0-9a-f]+$/i.test(value) ? BigInt(value) : null;
const hex = (value) => `0x${value.toString(16)}`;
const allowed = new Set([
  "eth_chainId",
  "net_version",
  "web3_clientVersion",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getBlockReceipts",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
  "eth_getLogs",
  "eth_call",
  "eth_getCode",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_getStorageAt",
  "eth_getProof",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
]);
const blockArgument = {
  eth_getBlockByNumber: 0,
  eth_getBlockReceipts: 0,
  eth_call: 1,
  eth_getCode: 1,
  eth_getBalance: 1,
  eth_getTransactionCount: 1,
  eth_getStorageAt: 2,
  eth_getProof: 2,
};
const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])])
        )
      : value;

export async function startForkHistoryRpc({
  mainnetUrl,
  forkUrl,
  snapshotBlock,
  snapshotHash,
  cacheDirectory,
  localCacheNamespace,
  port = 0,
}) {
  if (!mainnetUrl) throw new Error("ROBINHOOD_MAINNET is required for historical replay.");
  const fork = new URL(forkUrl);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(fork.hostname))
    throw new Error("Fork RPC must be loopback.");
  const boundary = BigInt(snapshotBlock);
  await mkdir(cacheDirectory, { recursive: true });
  const stats = { mainnet: 0, fork: 0, cacheHits: 0, failures: 0, splitLogs: 0 };
  const inFlight = new Map();
  const hashHeights = new Map();
  const remember = (result) => {
    if (result?.hash && result?.number)
      hashHeights.set(result.hash.toLowerCase(), BigInt(result.number));
    if (result?.hash && result?.blockNumber)
      hashHeights.set(result.hash.toLowerCase(), BigInt(result.blockNumber));
    if (result?.transactionHash && result?.blockNumber)
      hashHeights.set(result.transactionHash.toLowerCase(), BigInt(result.blockNumber));
    if (Array.isArray(result))
      for (const row of result) {
        if (row?.blockHash && row?.blockNumber)
          hashHeights.set(row.blockHash.toLowerCase(), BigInt(row.blockNumber));
        if (row?.transactionHash && row?.blockNumber)
          hashHeights.set(row.transactionHash.toLowerCase(), BigInt(row.blockNumber));
      }
    if (result?.number && Array.isArray(result.transactions))
      for (const tx of result.transactions) {
        const hash = typeof tx === "string" ? tx : tx.hash;
        if (hash) hashHeights.set(hash.toLowerCase(), BigInt(result.number));
      }
    return result;
  };
  // Restore proven historical hash classifications even when Ponder resumes from its own cache.
  for (const file of await readdir(cacheDirectory))
    if (file.endsWith(".json")) {
      remember(JSON.parse(await readFile(join(cacheDirectory, file), "utf8")));
    }
  async function rpc(target, method, params) {
    stats[target]++;
    let response;
    try {
      response = await fetch(target === "mainnet" ? mainnetUrl : forkUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(60000),
      });
    } catch {
      throw new Error(`${target} RPC transport failed for ${method}.`);
    }
    if (!response.ok) throw new Error(`${target} RPC HTTP ${response.status} for ${method}.`);
    const data = await response.json();
    if (data.error) {
      const error = new Error(`${target} RPC rejected ${method}.`);
      error.code = data.error.code;
      if (
        typeof data.error.data === "string" &&
        /^0x[0-9a-f]*$/i.test(data.error.data) &&
        data.error.data.length <= 65536
      )
        error.data = data.error.data;
      throw error;
    }
    if (!Object.hasOwn(data, "result")) throw new Error(`${target} RPC response has no result.`);
    return remember(data.result);
  }
  async function historical(method, params) {
    const key = createHash("sha256")
      .update(JSON.stringify(stable([4663, String(boundary), snapshotHash, method, params])))
      .digest("hex");
    const file = join(cacheDirectory, `${key}.json`);
    try {
      const result = JSON.parse(await readFile(file, "utf8"));
      stats.cacheHits++;
      return remember(result);
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error("Historical RPC cache could not be read.");
    }
    if (inFlight.has(key)) return inFlight.get(key);
    const task = (async () => {
      const result = await rpc("mainnet", method, params);
      if (result !== null) {
        const temporary = `${file}.${process.pid}.partial`;
        await writeFile(temporary, JSON.stringify(result));
        await rename(temporary, file);
      }
      return result;
    })();
    inFlight.set(key, task);
    try {
      return await task;
    } finally {
      inFlight.delete(key);
    }
  }
  // Cache only successful immutable local block reads. The profile identity isolates
  // different forks at the same mainnet pin. Mutable tags always reach live Anvil.
  const localDirectory = localCacheNamespace
    ? join(
        cacheDirectory,
        "local-" + createHash("sha256").update(localCacheNamespace).digest("hex")
      )
    : null;
  if (localDirectory) await mkdir(localDirectory, { recursive: true });
  async function localPinned(method, params) {
    if (!localDirectory) return rpc("fork", method, params);
    const tag = params[blockArgument[method]];
    const block = await rpc("fork", "eth_getBlockByNumber", [tag?.blockNumber ?? tag, false]);
    if (!block?.hash)
      throw new Error("Pinned local block identity is unavailable; refusing cached state.");
    const key = createHash("sha256")
      .update(
        JSON.stringify(stable([4663, String(boundary), snapshotHash, block.hash, method, params]))
      )
      .digest("hex");
    const file = join(localDirectory, key + ".json");
    try {
      const result = JSON.parse(await readFile(file, "utf8"));
      stats.cacheHits++;
      return remember(result);
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error("Local history cache could not be read.");
    }
    const flightKey = "local-" + key;
    if (inFlight.has(flightKey)) return inFlight.get(flightKey);
    const task = (async () => {
      const result = await rpc("fork", method, params);
      if (result !== null) {
        const temporary = file + "." + process.pid + ".partial";
        await writeFile(temporary, JSON.stringify(result), { mode: 0o600 });
        await rename(temporary, file);
      }
      return result;
    })();
    inFlight.set(flightKey, task);
    try {
      return await task;
    } finally {
      inFlight.delete(flightKey);
    }
  }
  async function byHash(method, params) {
    const known = hashHeights.get(String(params[0]).toLowerCase());
    if (known !== undefined && known <= boundary) return historical(method, params);
    // Unknown and post-snapshot hashes cannot authorize an upstream lookup.
    return rpc("fork", method, params);
  }
  async function blockHeight(tag) {
    if (tag === "earliest") return 0n;
    const height = number(tag);
    if (height !== null) return height;
    if (!["latest", "pending", "safe", "finalized"].includes(tag))
      throw new Error("Invalid log block tag.");
    const block = await rpc("fork", "eth_getBlockByNumber", [tag, false]);
    if (!block?.number) throw new Error("Fork block tag is unavailable.");
    return BigInt(block.number);
  }
  async function route(method, params = []) {
    if (!allowed.has(method)) {
      const e = new Error("Indexer relay supports read-only RPC methods.");
      e.code = -32601;
      throw e;
    }
    if (
      method === "eth_getBlockByHash" ||
      method === "eth_getTransactionReceipt" ||
      method === "eth_getTransactionByHash"
    )
      return byHash(method, params);
    if (method === "eth_getLogs") {
      const filter = params[0] ?? {};
      if (filter.blockHash) {
        const block = await byHash("eth_getBlockByHash", [filter.blockHash, false]);
        if (!block) return [];
        return BigInt(block.number) <= boundary
          ? historical(method, params)
          : rpc("fork", method, params);
      }
      const from = await blockHeight(filter.fromBlock ?? "latest");
      const to = await blockHeight(filter.toBlock ?? "latest");
      if (from > to) throw new Error("Log range starts after its end.");
      if (from > boundary)
        return rpc("fork", method, [{ ...filter, fromBlock: hex(from), toBlock: hex(to) }]);
      if (to <= boundary)
        return historical(method, [{ ...filter, fromBlock: hex(from), toBlock: hex(to) }]);
      stats.splitLogs++;
      const old = await historical(method, [
        { ...filter, fromBlock: hex(from), toBlock: hex(boundary) },
      ]);
      const recent = await rpc("fork", method, [
        { ...filter, fromBlock: hex(boundary + 1n), toBlock: hex(to) },
      ]);
      return [...old, ...recent];
    }
    if (Object.hasOwn(blockArgument, method)) {
      const arg = params[blockArgument[method]];
      if (
        method === "eth_getBlockReceipts" &&
        typeof arg === "string" &&
        /^0x[0-9a-f]{64}$/i.test(arg)
      )
        return byHash(method, params);
      if (arg && typeof arg === "object" && arg.blockHash) {
        const block = await byHash("eth_getBlockByHash", [arg.blockHash, false]);
        if (!block) throw new Error("Requested block is outside the fork history.");
        return BigInt(block.number) <= boundary
          ? historical(method, params)
          : rpc("fork", method, params);
      }
      const height = arg === "earliest" ? 0n : number(arg?.blockNumber ?? arg);
      if (height !== null && height <= boundary) return historical(method, params);
      if (
        height !== null &&
        [
          "eth_call",
          "eth_getCode",
          "eth_getBalance",
          "eth_getStorageAt",
          "eth_getTransactionCount",
          "eth_getProof",
          "eth_getBlockByNumber",
        ].includes(method)
      ) {
        const head = BigInt(await rpc("fork", "eth_blockNumber", []));
        if (height <= head) return localPinned(method, params);
      }
    }
    return rpc("fork", method, params);
  }
  const [mainChain, forkChain, mainAnchor, forkAnchor] = await Promise.all([
    rpc("mainnet", "eth_chainId", []),
    rpc("fork", "eth_chainId", []),
    rpc("mainnet", "eth_getBlockByNumber", [hex(boundary), false]),
    rpc("fork", "eth_getBlockByNumber", [hex(boundary), false]),
  ]);
  if (
    BigInt(mainChain) !== 4663n ||
    BigInt(forkChain) !== 4663n ||
    mainAnchor?.hash?.toLowerCase() !== snapshotHash.toLowerCase() ||
    forkAnchor?.hash?.toLowerCase() !== snapshotHash.toLowerCase()
  )
    throw new Error("Fork snapshot boundary does not match mainnet.");
  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/stats") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ snapshotBlock: String(boundary), snapshotHash, ...stats }));
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    let body = "";
    try {
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 2 * 1024 * 1024) throw new Error("RPC request exceeds limit.");
      }
      const input = JSON.parse(body);
      const handle = async (request) => {
        try {
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: await route(request.method, request.params),
          };
        } catch (error) {
          stats.failures++;
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: error.code ?? -32000,
              message: error.message,
              ...(error.data ? { data: error.data } : {}),
            },
          };
        }
      };
      const result = Array.isArray(input)
        ? await Promise.all(input.map(handle))
        : await handle(input);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
    } catch {
      res.writeHead(400).end("Invalid RPC request.");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}`, route, stats };
}
