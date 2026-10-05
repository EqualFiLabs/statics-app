import { test } from "node:test";
import assert from "node:assert/strict";
import { controlCommand } from "./controls.mjs";
import { encodeFunctionData, erc20Abi, parseEther } from "viem";

test("funding accepts exact decimal amounts and rejects truncation or malformed requests", () => {
  const command = controlCommand("fund-wallet", [
    "0x81709E16Bf99936891Cc720689f269103fabeD91",
    "--eth",
    "10",
    "--weth",
    "0.123456789012345678",
    "--statics",
    "25",
  ]);
  assert.equal(parseEther(command.eth), 10000000000000000000n);
  assert.equal(parseEther(command.weth), 123456789012345678n);
  assert.equal(parseEther(command.statics), 25000000000000000000n);
  assert.equal(
    encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [command.wallet, parseEther(command.statics)],
    }).slice(-64),
    parseEther("25").toString(16).padStart(64, "0")
  );
  for (const args of [
    [command.wallet, "--eth", "0.0000000000000000001"],
    [command.wallet, "--statics", "10000001"],
    [command.wallet, "--eth", "1", "--eth", "2"],
  ])
    assert.throws(() => controlCommand("fund-wallet", args));
  assert.throws(() => controlCommand("advance-time", ["0"]));
  assert.throws(() => controlCommand("advance-time", ["31536001"]));
  assert.throws(() => controlCommand("generate-volume", []));
});

test("funding sends exact transfers and wrap amounts, and insufficiency sends nothing", async () => {
  const { createServer } = await import("node:http");
  const { mkdir, mkdtemp } = await import("node:fs/promises");
  const { parseTransaction, keccak256, encodeAbiParameters } = await import("viem");
  const { applyControl } = await import("./controls.mjs");
  const { save } = await import("./profile.mjs");
  const { resolve } = await import("node:path");
  await mkdir(".local/tooling-tests", { recursive: true });
  const path = await mkdtemp(".local/tooling-tests/funding-");
  const transactions = [],
    receipts = new Map();
  let balance = parseEther("1000");
  const hash = "0x" + "a".repeat(64),
    token = "0x" + "b".repeat(40),
    weth = "0x" + "c".repeat(40);
  const s = createServer(async (req, res) => {
    let b = "";
    for await (const c of req) b += c;
    const q = JSON.parse(b);
    let result;
    if (q.method === "anvil_dumpState") result = "0x7b7d";
    else if (q.method === "web3_clientVersion") result = "anvil";
    else if (q.method === "anvil_nodeInfo") result = { forkConfig: { forkBlockNumber: 100 } };
    else if (q.method === "eth_chainId") result = "0x1237";
    else if (q.method === "eth_getBlockByNumber") result = { hash, number: "0x65" };
    else if (q.method === "eth_blockNumber") result = "0x65";
    else if (q.method === "eth_getTransactionCount") result = "0x0";
    else if (q.method === "eth_gasPrice") result = "0x3b9aca00";
    else if (q.method === "eth_getBalance") result = "0x" + parseEther("100000").toString(16);
    else if (q.method === "eth_call")
      result = encodeAbiParameters([{ type: "uint256" }], [balance]);
    else if (q.method === "eth_sendRawTransaction") {
      result = keccak256(q.params[0]);
      transactions.push(parseTransaction(q.params[0]));
      receipts.set(result, {
        transactionHash: result,
        transactionIndex: "0x0",
        blockHash: hash,
        blockNumber: "0x65",
        from: token,
        to: weth,
        cumulativeGasUsed: "0x5208",
        gasUsed: "0x5208",
        effectiveGasPrice: "0x3b9aca00",
        logs: [],
        logsBloom: "0x" + "0".repeat(512),
        status: "0x1",
        type: "0x0",
      });
    } else if (q.method === "eth_getTransactionReceipt") result = receipts.get(q.params[0]) ?? null;
    else {
      res.end(JSON.stringify({ id: q.id, error: { code: -1, message: `Unexpected ${q.method}` } }));
      return;
    }
    res.end(JSON.stringify({ id: q.id, jsonrpc: "2.0", result }));
  });
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const profile = {
    chainId: 4663,
    snapshot: { number: "100", hash },
    ports: { rpc: s.address().port },
    receipts: [],
  };
  save(resolve(path, "cleanup-launch-manifest.json"), {
    contracts: { statics: { address: token }, weth: { address: weth } },
  });
  const command = controlCommand("fund-wallet", [
    "0x81709E16Bf99936891Cc720689f269103fabeD91",
    "--eth",
    "10",
    "--weth",
    "2.123456789012345678",
    "--statics",
    "25",
  ]);
  try {
    await applyControl(command, profile, path);
    assert.equal(transactions.length, 4);
    assert.equal(transactions[0].value, parseEther("10"));
    assert.equal(transactions[1].value, parseEther(command.weth));
    assert.equal(
      transactions[2].data,
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [command.wallet, parseEther(command.weth)],
      })
    );
    assert.equal(
      transactions[3].data,
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [command.wallet, parseEther("25")],
      })
    );
    assert.ok(profile.receipts.every((row) => row.status === "success"));
    balance = 0n;
    await assert.rejects(() => applyControl(command, profile, path), /insufficient/);
    assert.equal(transactions.length, 4);
  } finally {
    s.close();
  }
});
