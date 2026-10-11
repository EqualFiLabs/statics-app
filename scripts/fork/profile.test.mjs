import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  appRoot,
  childEnvironment,
  compatible,
  json,
  loadConfig,
  newProfile,
  parseOptions,
  redact,
  requirePort,
  save,
  verifyAnvil,
} from "./profile.mjs";
import { upstreamRelay, ownedProcess, stopChild } from "./processes.mjs";
import { stage, confirmed, localGasPrice } from "./deploy.mjs";
import { lifecycleInvocation, testEnvironment } from "./testing.mjs";
import { forkCompilerRoot } from "./app.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const source = { protocol: "revision", sdkDigest: "digest", sdk: {} };
test("compiler root contains both the isolated app copy and its source dependencies", () => {
  assert.equal(forkCompilerRoot("/work/app/.local/profile/app", "/work/app"), "/work/app");
  assert.equal(forkCompilerRoot("/work/tooling/.local/app", "/work/candidate"), "/work");
});
test("local transaction fees use block base fee rather than feedback recommendations", async () => {
  const client = {
    getBlock: async () => ({ baseFeePerGas: 7n }),
    getGasPrice: async () => {
      throw new Error("must not request recommended gas price");
    },
  };
  assert.equal(await localGasPrice(client), 1_000_000_014n);
  const p = fixture(),
    path = await directory();
  let submitted;
  await confirmed(
    {
      client: {
        ...client,
        waitForTransactionReceipt: async () => ({ status: "success", blockNumber: 101n }),
      },
    },
    {
      sendTransaction: async (tx) => {
        submitted = tx;
        return "0xfee";
      },
    },
    {},
    p,
    path
  );
  assert.equal(submitted.gasPrice, 1_000_000_014n);
  assert.equal(submitted.type, "legacy");
});
test("disposable tests inherit the selected source checkout without losing explicit overrides", () => {
  const selected = {
    appRepository: "/selected/app",
    protocolRepository: "/selected/protocol",
    privy: { appId: "public", clientId: "client" },
  };
  assert.equal(testEnvironment({}, selected).STATICS_APP_REPOSITORY, "/selected/app");
  assert.equal(
    testEnvironment({ STATICS_APP_REPOSITORY: "/override" }, selected).STATICS_APP_REPOSITORY,
    "/override"
  );
  assert.equal(testEnvironment({}, selected).STATICS_PROTOCOL_REPOSITORY, "/selected/protocol");
});
test("lifecycle execution uses the guarded tooling suite and selected app imports", () => {
  const profile = fixture();
  profile.appRepository = "/selected/older-app";
  profile.ports.rpc = 12345;
  profile.ports.indexer = 12346;
  const invocation = lifecycleInvocation(profile, "/profiles/test-isolated");
  assert.equal(invocation.env.STATICS_FORK_APP_ROOT, "/selected/older-app");
  assert.equal(invocation.env.STATICS_FORK_RPC_URL, "http://127.0.0.1:12345");
  assert.equal(invocation.env.STATICS_FORK_PROFILE_ID, profile.id);
  assert.equal(invocation.env.STATICS_FORK_ROOT, "/profiles/test-isolated");
  assert.equal(invocation.args[0], resolve(invocation.cwd, "node_modules/vitest/vitest.mjs"));
  assert.equal(invocation.args[3], resolve(invocation.cwd, "vitest.phase-one-fork.config.ts"));
  assert.notEqual(invocation.cwd, profile.appRepository);
});
test("lifecycle config selects application and SDK imports but retains the owned suite", async () => {
  const { loadConfigFromFile } = await import("vite");
  const previous = process.env.STATICS_FORK_APP_ROOT;
  process.env.STATICS_FORK_APP_ROOT = "/selected/older-app";
  try {
    const loaded = await loadConfigFromFile(
      { command: "serve", mode: "test" },
      resolve(appRoot, "vitest.phase-one-fork.config.ts"),
      appRoot
    );
    assert.equal(resolve(loaded.config.root), appRoot);
    assert.deepEqual(loaded.config.test.include, ["test/integration/phase-one-fork.ts"]);
    const aliases = loaded.config.resolve.alias;
    for (const [specifier, target] of [
      ["@statics-protocol/sdk", "index.js"],
      ["@statics-protocol/sdk/phase-one", "phase-one/index.js"],
      ["@statics-protocol/sdk/genesis-credit", "genesis-credit.js"],
    ]) {
      const alias = aliases.find(
        (entry) => entry.find instanceof RegExp && entry.find.test(specifier)
      );
      assert.equal(
        alias.replacement,
        resolve("/selected/older-app/vendor/statics-sdk/dist", target)
      );
    }
    assert.equal(aliases.find((entry) => entry.find === "@").replacement, "/selected/older-app");
  } finally {
    if (previous === undefined) delete process.env.STATICS_FORK_APP_ROOT;
    else process.env.STATICS_FORK_APP_ROOT = previous;
  }
});
function fixture() {
  const p = newProfile(
    { profile: "dev" },
    { STATICS_PROTOCOL_REPOSITORY: ".", NEXT_PUBLIC_PRIVY_APP_ID: "public" },
    source
  );
  p.snapshot = { number: "100", hash: "0xabc" };
  return p;
}
async function directory() {
  await mkdir(".local/tooling-tests", { recursive: true });
  return mkdtemp(".local/tooling-tests/profile-");
}
async function server(handler) {
  const s = createServer(handler);
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  return s;
}
test("strict options, configuration persistence, incompatible and uncertain stages", () => {
  assert.equal(parseOptions([]).options.profile, "dev");
  assert.equal(parseOptions(["--app-mode", "preview"]).options.appMode, "preview");
  assert.throws(() => parseOptions(["--app-mode", "invalid"]), /app-mode/);
  assert.throws(() => parseOptions(["--profile", "../bad"]), /Profile/);
  assert.throws(() => parseOptions(["--rpc-port", "0"]), /port/);
  const p = fixture();
  assert.equal(p.appMode, "preview");
  compatible(p, { profile: "dev", appMode: "preview" }, {}, source);
  assert.throws(() => compatible(p, { appMode: "development" }, {}, source), /conflicts/);
  assert.throws(() => compatible(p, { rpcPort: 1 }, {}, source), /conflicts/);
  assert.throws(() => compatible(p, { snapshot: "99" }, {}, source), /conflicts/);
  assert.throws(() => compatible(p, {}, {}, { ...source, sdkDigest: "changed" }), /Incompatible/);
  p.stages.deployment = { status: "started" };
  assert.throws(() => compatible(p, {}, {}, source), /Nothing was repeated/);
});
test("dotenv is read as data and environment overrides; credentials never reach children", async () => {
  const path = await directory();
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    resolve(path, ".env.fork.local"),
    "ROBINHOOD_MAINNET='https://private.invalid/key'\nNEXT_PUBLIC_PRIVY_APP_ID=public\n"
  );
  const env = loadConfig({ NEXT_PUBLIC_PRIVY_APP_ID: "override" }, path);
  assert.equal(env.NEXT_PUBLIC_PRIVY_APP_ID, "override");
  assert.deepEqual(
    childEnvironment({ ...env, PATH: "/bin", PRIVATE_KEY: "secret", NEXT_PUBLIC_SECRET: "bad" }),
    { PATH: "/bin" }
  );
  assert.ok(!redact(`failure ${env.ROBINHOOD_MAINNET} secret`, ["secret"]).includes("secret"));
  assert.ok(!redact(`failure ${env.ROBINHOOD_MAINNET}`).includes("private.invalid"));
});
test("foreign ports are rejected without signalling their owners", async () => {
  const s = await server((req, res) => res.end("alive"));
  try {
    await assert.rejects(() => requirePort(s.address().port), /occupied/);
    assert.equal(
      await fetch(`http://127.0.0.1:${s.address().port}`).then((r) => r.text()),
      "alive"
    );
  } finally {
    s.close();
  }
});
test("upstream relay rejects submissions and redacts provider errors", async () => {
  const methods = [];
  const s = await server(async (req, res) => {
    let b = "";
    for await (const c of req) b += c;
    const q = JSON.parse(b);
    methods.push(q.method);
    res.end(
      JSON.stringify({
        id: q.id,
        error: { code: -1, message: "credential=https://secret.invalid/key" },
      })
    );
  });
  const relay = await upstreamRelay(`http://127.0.0.1:${s.address().port}`);
  try {
    const send = (method) =>
      fetch(relay.url, {
        method: "POST",
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params: [] }),
      });
    assert.equal((await send("eth_sendRawTransaction")).status, 403);
    assert.equal(methods.length, 0);
    assert.ok(!(await (await send("eth_getCode")).text()).includes("secret.invalid"));
  } finally {
    relay.server.close();
    s.close();
  }
});
test("mutations reject non-loopback and non-Anvil endpoints before sending", async () => {
  const p = fixture();
  await assert.rejects(() => verifyAnvil(p, "https://mainnet.invalid"), /loopback/);
  const methods = [];
  const s = await server(async (req, res) => {
    let b = "";
    for await (const c of req) b += c;
    const q = JSON.parse(b);
    methods.push(q.method);
    const values = {
      web3_clientVersion: "geth",
      eth_chainId: "0x1237",
      eth_getBlockByNumber: { hash: p.snapshot.hash },
      anvil_nodeInfo: { forkConfig: { forkBlockNumber: 100 } },
    };
    res.end(JSON.stringify({ id: q.id, result: values[q.method] }));
  });
  p.ports.rpc = s.address().port;
  try {
    await assert.rejects(() => verifyAnvil(p), /identity/);
    assert.ok(methods.every((m) => !m.includes("send") && !m.includes("Time")));
  } finally {
    s.close();
  }
});
test("receipt failure is recorded; uncertain stage is never marked complete", async () => {
  const p = fixture(),
    path = await directory();
  await assert.rejects(
    () =>
      stage(p, path, "deployment", async () => {
        throw new Error("interrupted");
      }),
    /interrupted/
  );
  assert.equal(json(resolve(path, "profile.json")).stages.deployment.status, "started");
  await assert.rejects(
    () =>
      confirmed(
        {
          client: {
            getBlock: async () => ({ baseFeePerGas: 1n }),
            waitForTransactionReceipt: async () => ({ status: "reverted", blockNumber: 101n }),
          },
        },
        { sendTransaction: async () => "0xhash" },
        {},
        p,
        path
      ),
    /reverted/
  );
  assert.equal(json(resolve(path, "profile.json")).receipts[0].status, "reverted");
});
test("shutdown signals only a child created by this supervisor", async () => {
  const path = await directory(),
    children = new Set();
  const child = ownedProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
    cwd: process.cwd(),
    log: resolve(path, "owned.log"),
    children,
  });
  await stopChild(child);
  assert.ok(child.signalCode || child.exitCode !== null);
  assert.equal(children.size, 0);
});
test("successful child shutdown leaves no timeout keeping the supervisor alive", async () => {
  const path = await directory();
  await promisify(execFile)(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { ownedProcess, stopChild } from "./scripts/fork/processes.mjs";
    const child = ownedProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      cwd: process.cwd(), log: ${JSON.stringify(resolve(path, "shutdown.log"))}, children: new Set(),
    });
    await stopChild(child, 10000);
  `,
    ],
    { cwd: process.cwd(), timeout: 3000 }
  );
});
test("atomic profile writes do not serialize private upstream configuration", async () => {
  const path = await directory(),
    p = fixture();
  save(resolve(path, "profile.json"), p);
  assert.ok(!(await readFile(resolve(path, "profile.json"), "utf8")).includes("ROBINHOOD_MAINNET"));
});

test("process completion waits for log flush and cancellation prevents late child starts", async () => {
  const { run, waitRpc, waitHttp } = await import("./processes.mjs");
  const path = await directory(),
    children = new Set(),
    log = resolve(path, "flush.log");
  await run(
    process.execPath,
    [
      "-e",
      'process.stdout.write("x".repeat(1024*1024));process.stdout.write("\\nFINAL_DEPLOYMENT_LABEL\\n");',
    ],
    { cwd: process.cwd(), log, children }
  );
  assert.ok((await readFile(log, "utf8")).endsWith("FINAL_DEPLOYMENT_LABEL\n"));
  const controller = new AbortController();
  children.signal = controller.signal;
  controller.abort();
  assert.throws(
    () =>
      ownedProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
        cwd: process.cwd(),
        log,
        children,
      }),
    /aborted/
  );
  assert.equal(children.size, 0);
  const child = { exitCode: null, signalCode: "SIGTERM", spawnFailed: false };
  await assert.rejects(() => waitRpc("http://unused.invalid", child), /exited/);
  await assert.rejects(() => waitHttp("http://unused.invalid", child), /exited/);
});
test("handler renames invalidate indexer replay and uncertain final saves block resume", async () => {
  const { indexerFingerprint } = await import("./app.mjs");
  const { writeFile, mkdir, rename } = await import("node:fs/promises");
  const path = await directory();
  await mkdir(resolve(path, "src"));
  for (const file of ["ponder.config.ts", "ponder.schema.ts", "package-lock.json"])
    await writeFile(resolve(path, file), "config");
  await writeFile(resolve(path, "src/one.ts"), "handler");
  const first = indexerFingerprint(path);
  await rename(resolve(path, "src/one.ts"), resolve(path, "src/two.ts"));
  assert.notEqual(indexerFingerprint(path), first);
  const p = fixture();
  p.status = "uncertain-stop";
  assert.throws(() => compatible(p, {}, {}, source), /Refusing automatic resume/);
  p.status = "ready";
  p.controlMutation = { status: "started" };
  assert.throws(() => compatible(p, {}, {}, source), /Nothing was repeated/);
});

test("terminal interrupt leaves isolated Anvil child alive until supervisor cleanup", async () => {
  const { spawn } = await import("node:child_process");
  const { pathToFileURL } = await import("node:url");
  const { writeFile } = await import("node:fs/promises");
  const path = resolve(await directory());
  const script = resolve(path, "supervisor.mjs"),
    report = resolve(path, "interrupt.json");
  await writeFile(
    script,
    `
    import { ownedProcess, stopChild } from ${JSON.stringify(pathToFileURL(resolve("scripts/fork/processes.mjs")).href)};
    import { writeFileSync } from 'node:fs';
    const children = new Set();
    const child = ownedProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      cwd: ${JSON.stringify(path)}, log: ${JSON.stringify(resolve(path, "child.log"))}, children,
      abortable: false, detached: true
    });
    process.once('SIGINT', async () => {
      await new Promise(r => setTimeout(r, 100));
      writeFileSync(${JSON.stringify(report)}, JSON.stringify({ aliveBeforeCheckpoint: child.exitCode === null && child.signalCode === null }));
      await stopChild(child);
    });
    child.once('spawn', () => console.log('ready'));
  `
  );
  const supervisor = spawn(process.execPath, [script], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const closed = new Promise((r) => supervisor.once("close", r));
  await new Promise((r) => supervisor.stdout.once("data", r));
  process.kill(-supervisor.pid, "SIGINT");
  await closed;
  assert.equal(JSON.parse(await readFile(report)).aliveBeforeCheckpoint, true);
});
