import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { createServer } from "node:http";
import { childEnvironment, redact, rpc, sleep } from "./profile.mjs";

export async function upstreamRelay(upstream) {
  const methods = new Set([
    "eth_chainId",
    "net_version",
    "web3_clientVersion",
    "eth_blockNumber",
    "eth_getBlockByNumber",
    "eth_getBlockByHash",
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
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== "POST") return res.writeHead(405).end();
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 2 * 1024 * 1024) throw new Error("Too large");
      }
      const input = JSON.parse(body),
        requests = Array.isArray(input) ? input : [input];
      if (requests.some((row) => !methods.has(row.method)))
        return res.writeHead(403).end("Read-only upstream relay.");
      const result = await fetch(upstream, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(120000),
      });
      const data = await result.json();
      const sanitize = (row) =>
        row.error
          ? {
              jsonrpc: "2.0",
              id: row.id,
              error: { code: row.error.code, message: "Upstream RPC rejected the read." },
            }
          : row;
      res
        .writeHead(result.status, { "content-type": "application/json" })
        .end(JSON.stringify(Array.isArray(data) ? data.map(sanitize) : sanitize(data)));
    } catch {
      res.writeHead(502).end("Upstream read failed.");
    }
  });
  await new Promise((r, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", r);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
export function ownedProcess(command, args, { cwd, env, log, children }) {
  const output = createWriteStream(log, { flags: "a", mode: 0o600 });
  const child = spawn(command, args, {
    cwd,
    env: env ?? childEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  for (const stream of [child.stdout, child.stderr])
    stream.setEncoding("utf8").on("data", (chunk) => output.write(redact(chunk)));
  child.on("error", () => {
    child.spawnFailed = true;
  });
  child.once("close", () => {
    children.delete(child);
    output.end();
  });
  return child;
}
export async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const finished = new Promise((r) => child.once("close", r));
  child.kill("SIGTERM");
  await Promise.race([finished, sleep(15000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await finished;
  }
}
export async function run(command, args, options) {
  const child = ownedProcess(command, args, options);
  const code = await new Promise((r) => {
    child.once("error", () => r(-1));
    child.once("exit", r);
  });
  if (code !== 0)
    throw new Error(`${command} failed (${code}); inspect the profile log ${options.log}.`);
}
export async function waitRpc(url, child) {
  for (let i = 0; i < 240; i++) {
    if (child.exitCode !== null || child.spawnFailed)
      throw new Error("Anvil exited before readiness; inspect its profile log.");
    try {
      if (await rpc(url, "anvil_nodeInfo")) return;
    } catch {
      /* hydration */
    }
    await sleep(500);
  }
  throw new Error("Anvil did not become ready.");
}
export async function waitHttp(url, child, attempts = 600) {
  for (let i = 0; i < attempts; i++) {
    if (child.exitCode !== null || child.spawnFailed)
      throw new Error("Component exited before readiness; inspect its profile log.");
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return;
    } catch {
      /* startup */
    }
    await sleep(1000);
  }
  throw new Error("Component did not become ready; backfill data is preserved.");
}
