import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
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
import { stage, confirmed } from "./deploy.mjs";
const source = { protocol: "revision", sdkDigest: "digest", sdk: {} };
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
  assert.throws(() => parseOptions(["--profile", "../bad"]), /Profile/);
  assert.throws(() => parseOptions(["--rpc-port", "0"]), /port/);
  const p = fixture();
  compatible(p, { profile: "dev" }, {}, source);
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
test("atomic profile writes do not serialize private upstream configuration", async () => {
  const path = await directory(),
    p = fixture();
  save(resolve(path, "profile.json"), p);
  assert.ok(!(await readFile(resolve(path, "profile.json"), "utf8")).includes("ROBINHOOD_MAINNET"));
});
