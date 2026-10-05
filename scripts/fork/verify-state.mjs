import { readFile, readdir, writeFile } from "node:fs/promises";
import { encodeFunctionData, decodeFunctionResult, toEventSelector, parseAbi } from "viem";
import { urls, verifyAnvil } from "./profile.mjs";
import assert from "node:assert/strict";
import {
  staticsGenesisAbi,
  staticsGenesisVaultAbi,
  genesisActivationRegistryAbi,
  genesisLaunchDistributorAbi,
} from "@statics-protocol/sdk";
import { staticsGenesisCreditAbi } from "@statics-protocol/sdk/genesis-credit";
export async function verifyState(profile, root) {
  await verifyAnvil(profile);
  const indexer = urls(profile).indexer;
  const rpcUrl = urls(profile).rpc;
  const boundary = BigInt(profile.snapshot.number);
  const launch = JSON.parse(await readFile(`${root}/cleanup-launch-manifest.json`));
  const g = launch.contracts;
  let requestId = 0;
  async function rpc(method, params) {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    });
    const data = await response.json();
    if (data.error) throw new Error("Fork RPC read failed: " + method);
    return data.result;
  }
  async function api(path) {
    const response = await fetch(`${indexer}${path}`);
    if (!response.ok) throw new Error(`Indexer ${path}: HTTP ${response.status}`);
    return response.json();
  }
  const checkpoint = (await api("/status")).active;
  assert.equal(checkpoint.id, 4663);
  const anchor = BigInt(checkpoint.block.number);
  assert.ok(anchor > boundary, "Backfill must have reached local fork history before acceptance.");
  const blockTag = `0x${anchor.toString(16)}`;
  const head = BigInt(await rpc("eth_blockNumber", []));
  assert.ok(head >= anchor && head - anchor <= 100n, "Indexer must be near current fork head.");
  const logs = new Map();
  for (const file of await readdir(`${root}/history-cache`)) {
    if (!file.endsWith(".json")) continue;
    const data = JSON.parse(await readFile(`${root}/history-cache/${file}`));
    if (Array.isArray(data))
      for (const row of data)
        if (row.address && row.topics && row.blockNumber && BigInt(row.blockNumber) <= boundary)
          logs.set(`${row.blockHash}:${row.logIndex}`, row);
  }
  for (const row of await rpc("eth_getLogs", [
    {
      address: [g.genesis.address, g.vault.address],
      fromBlock: `0x${(boundary + 1n).toString(16)}`,
      toBlock: blockTag,
    },
  ]))
    logs.set(`${row.blockHash}:${row.logIndex}`, row);
  const transferTopic = toEventSelector("Transfer(address,address,uint256)");
  const consecutiveTopic = toEventSelector("ConsecutiveTransfer(uint256,uint256,address,address)");
  const ordered = [...logs.values()].sort(
    (a, b) =>
      Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) ||
      Number(BigInt(a.transactionIndex) - BigInt(b.transactionIndex)) ||
      Number(BigInt(a.logIndex) - BigInt(b.logIndex))
  );
  const owners = new Map(),
    wallets = new Set();
  for (const log of ordered)
    if (log.address.toLowerCase() === g.genesis.address.toLowerCase()) {
      if (log.topics[0] === consecutiveTopic) {
        const owner = `0x${log.topics[3].slice(-40)}`.toLowerCase();
        const start = BigInt(log.topics[1]),
          end = BigInt(log.data);
        assert.ok(start >= 1n && end <= 5555n && start <= end);
        for (let id = start; id <= end; id++) owners.set(id.toString(), owner);
        wallets.add(owner);
      } else if (log.topics[0] === transferTopic) {
        const id = BigInt(log.topics[3]).toString(),
          owner = `0x${log.topics[2].slice(-40)}`.toLowerCase();
        owners.set(id, owner);
        wallets.add(owner);
      }
    }
  const [mintedSupply, collectionSize] = await calls(
    ["mintedSupply", "COLLECTION_SIZE"].map((functionName) => ({
      address: g.genesis.address,
      abi: staticsGenesisAbi,
      functionName,
      args: [],
    }))
  );
  assert.equal(mintedSupply, collectionSize);
  assert.equal(
    owners.size,
    Number(mintedSupply),
    "Ownership reconstruction must include every initial mint."
  );
  for (let id = 1n; id <= mintedSupply; id++)
    assert.ok(owners.has(id.toString()), `Missing collection ID ${id}`);
  const zero = "0x" + "0".repeat(40),
    vault = g.vault.address.toLowerCase();
  wallets.delete(zero);
  wallets.delete(vault);
  const expected = new Map([...owners].filter(([, owner]) => owner !== zero && owner !== vault));
  const indexed = new Map();
  for (const wallet of wallets) {
    let cursor = null;
    const actual = [];
    do {
      const page = await api(
        `/wallets/${wallet}/genesis?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
      );
      assert.equal(page.deploymentId, launch.deploymentId);
      for (const row of page.items) {
        assert.ok(!indexed.has(row.id), `Duplicate indexed Operator ${row.id}`);
        indexed.set(row.id, { ...row, owner: wallet });
        actual.push(row.id);
      }
      cursor = page.nextCursor;
    } while (cursor);
    assert.deepEqual(
      actual.sort(),
      [...expected]
        .filter(([, owner]) => owner === wallet)
        .map(([id]) => id)
        .sort(),
      `Wallet ownership page mismatch: ${wallet}`
    );
  }
  assert.deepEqual(
    [...indexed.keys()].sort(),
    [...expected.keys()].sort(),
    "Indexer IDs must match full transfer reconstruction."
  );
  for (const [id, owner] of expected)
    assert.equal(indexed.get(id).owner, owner, `Indexed owner mismatch: ${id}`);
  console.log(
    `Ownership reconstruction and wallet pages agree for ${expected.size} circulating Operators; checking fork storage.`
  );
  async function calls(requests) {
    const results = [];
    for (let i = 0; i < requests.length; i += 8) {
      const batch = requests.slice(i, i + 8).map((request, index) => ({
        jsonrpc: "2.0",
        id: index,
        method: "eth_call",
        params: [{ to: request.address, data: encodeFunctionData(request) }, blockTag],
      }));
      let pending = batch;
      const values = new Map();
      for (let attempt = 0; pending.length && attempt < 4; attempt++) {
        let data;
        try {
          const response = await fetch(rpcUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(pending),
            signal: AbortSignal.timeout(120000),
          });
          if (!response.ok) throw new Error("Fork RPC read transport failed.");
          data = await response.json();
        } catch {
          if (attempt === 3)
            throw new Error(
              "Fork storage verification timed out after four read attempts; no state was changed."
            );
          console.log(
            `Retrying ${pending.length} unavailable fork reads (attempt ${attempt + 2}/4).`
          );
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
          continue;
        }
        assert.ok(Array.isArray(data), "Expected a JSON-RPC batch response.");
        const byId = new Map(data.map((row) => [row.id, row]));
        const retry = [];
        for (const request of pending) {
          const row = byId.get(request.id);
          assert.ok(row, "Every requested read needs a response.");
          if (row.error) {
            const message = String(row.error.message).replace(
              /https?:\/\/[^\s"<>]+/g,
              "[RPC URL redacted]"
            );
            if (attempt < 3 && /502|503|429|timeout|temporar|connection|transport/i.test(message)) {
              retry.push(request);
              continue;
            }
            throw new Error(message);
          }
          values.set(
            request.id,
            decodeFunctionResult({ ...requests[i + request.id], data: row.result })
          );
        }
        pending = retry;
        if (pending.length) {
          console.log(
            `Retrying ${pending.length} transient fork reads (attempt ${attempt + 2}/4).`
          );
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        }
      }
      assert.equal(values.size, batch.length);
      for (const request of batch) results.push(values.get(request.id));
    }
    return results;
  }
  const ownershipRequests = [...expected.keys()].map((id) => ({
    address: g.genesis.address,
    abi: staticsGenesisAbi,
    functionName: "ownerOf",
    args: [BigInt(id)],
  }));
  const chainOwners = await calls(ownershipRequests);
  for (let i = 0; i < ownershipRequests.length; i++)
    assert.equal(
      chainOwners[i].toLowerCase(),
      expected.get(ownershipRequests[i].args[0].toString())
    );
  const balanceWallets = [...new Set(expected.values()), vault];
  const balances = await calls(
    balanceWallets.map((wallet) => ({
      address: g.genesis.address,
      abi: staticsGenesisAbi,
      functionName: "balanceOf",
      args: [wallet],
    }))
  );
  for (let i = 0; i < balanceWallets.length; i++)
    assert.equal(
      Number(balances[i]),
      [...owners.values()].filter((owner) => owner === balanceWallets[i]).length
    );
  const stateIds = [...expected.keys()];
  const stateCalls = stateIds.flatMap((id) => [
    {
      address: g.activationRegistry.address,
      abi: genesisActivationRegistryAbi,
      functionName: "tierOf",
      args: [BigInt(id)],
    },
    {
      address: g.activationRegistry.address,
      abi: genesisActivationRegistryAbi,
      functionName: "multiplierBps",
      args: [BigInt(id)],
    },
    {
      address: g.launchDistributor.address,
      abi: genesisLaunchDistributorAbi,
      functionName: "registered",
      args: [BigInt(id)],
    },
    {
      address: g.launchDistributor.address,
      abi: genesisLaunchDistributorAbi,
      functionName: "effectiveWeight",
      args: [BigInt(id)],
    },
  ]);
  const states = await calls(stateCalls);
  for (let i = 0; i < stateIds.length; i++) {
    const row = indexed.get(stateIds[i]);
    assert.equal(row.tier, Number(states[4 * i]), `tier ${row.id}`);
    assert.equal(row.multiplierBps, Number(states[4 * i + 1]), `multiplier ${row.id}`);
    assert.equal(row.registered, states[4 * i + 2], `registered ${row.id}`);
    assert.equal(row.effectiveWeight, states[4 * i + 3].toString(), `weight ${row.id}`);
  }
  const creditIds = new Set();
  // Derive credit IDs from the ABI signature, avoiding assumptions about event field order.
  const opened = staticsGenesisCreditAbi.find(
    (event) => event.type === "event" && event.name === "GenesisCreditOpened"
  );
  const signature = toEventSelector(opened);
  for (const log of ordered)
    if (log.address.toLowerCase() === vault && log.topics[0] === signature)
      creditIds.add(BigInt(log.topics[1]).toString());
  const creditKeys = [...creditIds];
  const creditStates = await calls(
    creditKeys.map((id) => ({
      address: g.vault.address,
      abi: staticsGenesisCreditAbi,
      functionName: "credit",
      args: [BigInt(id)],
    }))
  );
  const activeCredits = new Map(
    creditKeys.map((id, i) => [id, creditStates[i]]).filter(([, state]) => state.active)
  );
  const indexedCredits = new Map();
  let cursor = null;
  do {
    const page = await api(
      `/genesis/credits/recoverable?asOf=1099511627776&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
    );
    for (const row of page.items) indexedCredits.set(row.genesisId, row);
    cursor = page.nextCursor;
  } while (cursor);
  assert.deepEqual(
    [...indexedCredits.keys()].sort(),
    [...activeCredits.keys()].sort(),
    "Active credit IDs must match fork state."
  );
  for (const [id, state] of activeCredits) {
    const row = indexedCredits.get(id);
    assert.equal(row.owner.toLowerCase(), state.owner.toLowerCase());
    assert.equal(row.principal, state.principal.toString());
    assert.equal(row.maturity, state.maturity.toString());
    assert.equal(row.recoverableAt, state.recoverableAt.toString());
  }
  const [outstandingPrincipal] = await calls([
    {
      address: g.vault.address,
      abi: parseAbi(["function totalOutstandingGenesisCredit() view returns (uint256)"]),
      functionName: "totalOutstandingGenesisCredit",
      args: [],
    },
  ]);
  assert.equal(
    [...activeCredits.values()].reduce((sum, state) => sum + state.principal, 0n),
    outstandingPrincipal,
    "All active credit principal must be accounted for independently of historical event discovery."
  );
  const inventory = await api("/genesis/next-available");
  const firstVaultId = [...owners]
    .filter(([, owner]) => owner === vault)
    .map(([id]) => BigInt(id))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[0];
  assert.equal(
    inventory.tokenId,
    firstVaultId.toString(),
    "Indexer must identify the first actual vault-owned Operator."
  );
  assert.ok(inventory.tokenId !== null, "Expected available vault inventory.");
  const [available] = await calls([
    {
      address: g.vault.address,
      abi: staticsGenesisVaultAbi,
      functionName: "isVaultInventory",
      args: [BigInt(inventory.tokenId)],
    },
  ]);
  assert.equal(available, true, "Indexer inventory candidate must actually be available.");
  const report = {
    indexer,
    indexedBlock: String(anchor),
    forkHead: String(head),
    transferLogs: ordered.filter(
      (log) =>
        log.address.toLowerCase() === g.genesis.address.toLowerCase() &&
        log.topics[0] === transferTopic
    ).length,
    collectionSize: String(collectionSize),
    circulatingOperators: expected.size,
    owningWallets: balanceWallets.length - 1,
    historicalWalletsChecked: wallets.size,
    operatorStateChecks: stateIds.length,
    creditIdsChecked: creditIds.size,
    activeCredits: activeCredits.size,
    outstandingPrincipal: String(outstandingPrincipal),
    nextAvailableOperator: inventory.tokenId,
    checks:
      "ownership reconstruction, ownerOf, balances, tiers, multipliers, registration, weights, credits, vault inventory",
  };
  await writeFile(`${root}/genesis-backfill-verification.json`, JSON.stringify(report, null, 2));
  return report;
}
