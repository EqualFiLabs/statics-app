import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir } from "node:fs/promises";
import { startForkHistoryRpc } from "./history-rpc.mjs";
const anchor = "0x" + "a".repeat(64),
  oldHash = "0x" + "b".repeat(64),
  oldTx = "0x" + "c".repeat(64),
  futureTx = "0x" + "d".repeat(64);
test("history relay pins reads, splits ranges, caches hashes and excludes unproven history", async () => {
  const seen = [];
  let activeAnchor = anchor;
  let localStatePruned = false;
  let localHash = "0x" + "f".repeat(64);
  async function mock(label) {
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const b of req) body += b;
      const r = JSON.parse(body);
      if (
        r.method === "eth_call" &&
        (r.params[0]?.fault || (label === "fork" && r.params[1] === "0x65" && localStatePruned))
      ) {
        res.end(
          JSON.stringify({
            id: r.id,
            error: { code: -1, message: "API secret=bare-private-credential" },
          })
        );
        return;
      }

      seen.push([label, r.method, r.params]);
      let result = null;
      if (r.method === "eth_chainId") result = "0x1237";
      else if (r.method === "eth_getBlockByNumber")
        result = {
          number: ["latest", "pending"].includes(r.params[0])
            ? "0x70"
            : ["safe", "finalized"].includes(r.params[0])
              ? "0x68"
              : r.params[0],
          hash: label === "fork" && r.params[0] === "0x65" ? localHash : activeAnchor,
        };
      else if (r.method === "eth_blockNumber") result = "0x70";
      else if (r.method === "eth_getLogs")
        result =
          label === "mainnet"
            ? [{ source: label, blockHash: oldHash, transactionHash: oldTx, blockNumber: "0x60" }]
            : [{ source: label }];
      else if (r.method === "eth_getCode" || r.method === "eth_call")
        result = label === "mainnet" ? "0x01" : "0x02";
      else if (r.method === "eth_getTransactionReceipt")
        result = label === "mainnet" ? { transactionHash: r.params[0], blockNumber: "0x60" } : null;
      else if (r.method === "eth_getBlockByHash")
        result = label === "mainnet" ? { hash: r.params[0], number: "0x60" } : null;
      res.end(JSON.stringify({ jsonrpc: "2.0", id: r.id, result }));
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    return { server, url: "http://127.0.0.1:" + server.address().port };
  }
  const main = await mock("mainnet"),
    fork = await mock("fork");
  let relay;
  await mkdir(".local/tooling-tests", { recursive: true });
  const cache = await mkdtemp(".local/tooling-tests/relay-cache-");
  const options = {
    mainnetUrl: main.url,
    forkUrl: fork.url,
    snapshotBlock: 100,
    snapshotHash: anchor,
    cacheDirectory: cache,
    localCacheNamespace: "owned-profile-a",
  };
  try {
    relay = await startForkHistoryRpc(options);
    assert.equal(await relay.route("eth_getCode", ["addr", "0x60"]), "0x01");
    let prior = relay.stats.mainnet;
    assert.equal(await relay.route("eth_getCode", ["addr", "0x60"]), "0x01");
    assert.equal(relay.stats.mainnet, prior);
    assert.equal(await relay.route("eth_getCode", ["addr", "0x65"]), "0x02");
    assert.equal(await relay.route("eth_call", [{}, "latest"]), "0x02");
    assert.equal(await relay.route("eth_call", [{}, "0x65"]), "0x02");
    const calls = seen.filter(([side, method]) => side === "fork" && method === "eth_call").length;
    localStatePruned = true;
    assert.equal(await relay.route("eth_call", [{}, "0x65"]), "0x02");
    assert.equal(
      seen.filter(([side, method]) => side === "fork" && method === "eth_call").length,
      calls
    );

    const logs = await relay.route("eth_getLogs", [{ fromBlock: "0x60", toBlock: "0x70" }]);
    assert.deepEqual(
      logs.map((x) => x.source),
      ["mainnet", "fork"]
    );
    prior = relay.stats.mainnet;
    assert.equal(await relay.route("eth_getTransactionReceipt", [futureTx]), null);
    assert.equal(relay.stats.mainnet, prior);
    assert.equal((await relay.route("eth_getTransactionReceipt", [oldTx])).blockNumber, "0x60");
    prior = relay.stats.mainnet;
    assert.equal((await relay.route("eth_getTransactionReceipt", [oldTx])).blockNumber, "0x60");
    assert.equal(relay.stats.mainnet, prior);
    assert.equal(await relay.route("eth_call", [{}, { blockHash: oldHash }]), "0x01");
    await relay.route("eth_getLogs", [{ fromBlock: "earliest", toBlock: "earliest" }]);
    assert.ok(
      seen.some(
        ([side, method, p]) =>
          side === "mainnet" &&
          method === "eth_getLogs" &&
          p[0].fromBlock === "0x0" &&
          p[0].toBlock === "0x0"
      )
    );
    await relay.route("eth_getLogs", [{ fromBlock: "0x65", toBlock: "finalized" }]);
    assert.ok(
      seen.some(
        ([side, method, p]) =>
          side === "fork" && method === "eth_getLogs" && p[0].toBlock === "0x68"
      )
    );
    await assert.rejects(
      () => relay.route("eth_getLogs", [{ fromBlock: "bad", toBlock: "latest" }]),
      /Invalid log block tag/
    );
    await assert.rejects(() => relay.route("eth_sendRawTransaction", ["0x"]), /read-only/);
    await new Promise((r) => relay.server.close(r));
    relay = await startForkHistoryRpc(options);
    assert.equal(
      await relay.route("eth_call", [{}, "0x65"]),
      "0x02",
      "Pinned local reads survive relay restart and Anvil pruning"
    );
    prior = relay.stats.mainnet;
    assert.equal((await relay.route("eth_getTransactionReceipt", [oldTx])).blockNumber, "0x60");
    assert.equal(relay.stats.mainnet, prior);
    await assert.rejects(() => relay.route("eth_call", [{ fault: true }, "0x60"]), /RPC rejected/);
    await new Promise((r) => relay.server.close(r));
    relay = await startForkHistoryRpc({ ...options, localCacheNamespace: "owned-profile-b" });
    await assert.rejects(() => relay.route("eth_call", [{}, "0x65"]), /RPC rejected/);
    await new Promise((r) => relay.server.close(r));
    localStatePruned = false;
    // Reusing a lost height after a stale checkpoint cannot resurrect old cached state.
    relay = await startForkHistoryRpc(options);
    localHash = "0x" + "9".repeat(64);
    localStatePruned = true;
    await assert.rejects(() => relay.route("eth_call", [{}, "0x65"]), /RPC rejected/);
    await new Promise((r) => relay.server.close(r));
    localStatePruned = false;
    const differentHash = "0x" + "e".repeat(64);
    activeAnchor = differentHash;
    relay = await startForkHistoryRpc({ ...options, snapshotHash: differentHash });
    prior = relay.stats.mainnet;
    assert.equal(await relay.route("eth_getCode", ["addr", "0x60"]), "0x01");
    assert.equal(
      relay.stats.mainnet,
      prior + 1,
      "Different snapshot hashes cannot share cached responses"
    );
    await assert.rejects(
      () => startForkHistoryRpc({ ...options, snapshotHash: anchor }),
      /boundary/
    );
  } finally {
    if (relay?.server.listening) await new Promise((r) => relay.server.close(r));
    main.server.close();
    fork.server.close();
  }
});
