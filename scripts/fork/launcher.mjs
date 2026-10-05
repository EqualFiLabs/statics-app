import { createServer } from "node:http";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import {
  appRoot,
  childEnvironment,
  compatible,
  json,
  newProfile,
  profilePath,
  provenance,
  requirePort,
  rpc,
  save,
  urls,
  verifyAnvil,
} from "./profile.mjs";
import { ownedProcess, stopChild, upstreamRelay, waitRpc } from "./processes.mjs";
import { deploy, transactionContext } from "./deploy.mjs";
import { startForkHistoryRpc } from "./history-rpc.mjs";
import { startApp, startIndexer } from "./app.mjs";
import { applyControl, lightweightStatus } from "./controls.mjs";

export async function callSession(profile, action, command) {
  if (!profile.owner) throw new Error("Profile is stopped; start it with dev:fork first.");
  let result;
  try {
    result = await fetch(`http://127.0.0.1:${profile.owner.controlPort}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${profile.owner.token}`,
      },
      body: JSON.stringify({ id: profile.id, action, command }),
      signal: AbortSignal.timeout(action === "status" ? 150000 : 600000),
    });
  } catch {
    throw new Error(
      "Owned supervisor is unavailable. Preserve the profile; inspect its lock and process state before restart."
    );
  }
  const body = await result.json();
  if (!result.ok) throw new Error(body.error);
  if (body.id !== profile.id)
    throw new Error("Foreign supervisor rejected; no mutation was sent to Anvil.");
  return body.result;
}
export async function launch(options, environment) {
  const path = profilePath(options.profile),
    profileFile = resolve(path, "profile.json"),
    lock = resolve(path, "launcher.lock");
  mkdirSync(path, { recursive: true, mode: 0o700 });
  const saved = existsSync(profileFile) ? json(profileFile) : null;
  const protocol = environment.STATICS_PROTOCOL_REPOSITORY ?? saved?.protocolRepository;
  if (!protocol)
    throw new Error(
      "Set STATICS_PROTOCOL_REPOSITORY to the existing compatible protocol checkout."
    );
  const source = provenance(protocol),
    profile = saved ?? newProfile(options, environment, source);
  if (saved) compatible(profile, options, environment, source);
  if (existsSync(lock)) {
    const prior = json(lock);
    let alive = true;
    try {
      process.kill(prior.pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") alive = false;
      else throw error;
    }
    if (alive) {
      const status = await callSession(profile, "status");
      if (!Object.values(status.health).every(Boolean))
        throw new Error("Owned session is unhealthy; inspect logs or stop it explicitly.");
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    if (prior.id !== profile.id)
      throw new Error("Foreign lock; preserve it and inspect ownership.");
    unlinkSync(lock);
  }
  for (const port of Object.values(profile.ports)) await requirePort(port);
  if (!environment.ROBINHOOD_MAINNET)
    throw new Error("ROBINHOOD_MAINNET is required for lazy fork state and historical backfill.");
  writeFileSync(lock, JSON.stringify({ pid: process.pid, id: profile.id }), {
    flag: "wx",
    mode: 0o600,
  });
  const children = new Set(),
    relays = [];
  let control,
    anvil,
    stopping = false,
    stopResolve;
  const stopped = new Promise((r) => {
    stopResolve = r;
  });
  const persist = () => save(profileFile, profile);
  const stop = async () => {
    if (stopping) return stopped;
    stopping = true;
    control?.close();
    for (const child of [...children].filter((c) => c !== anvil)) await stopChild(child);
    if (anvil) await stopChild(anvil); // --state saves historical snapshots on SIGTERM.
    for (const relay of relays) relay.server.close();
    profile.status = "stopped";
    delete profile.owner;
    persist();
    if (existsSync(lock) && json(lock).id === profile.id) unlinkSync(lock);
    stopResolve();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    profile.status = "starting";
    profile.owner = { pid: process.pid, token: randomBytes(32).toString("hex") };
    let queue = Promise.resolve();
    control = createServer(async (req, res) => {
      if (req.method !== "POST" || req.headers.authorization !== `Bearer ${profile.owner?.token}`)
        return res.writeHead(403).end();
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 4096) throw new Error("Request too large.");
        }
        const request = JSON.parse(body);
        if (request.id !== profile.id) throw new Error("Profile identity mismatch.");
        let result;
        if (request.action === "status") result = await lightweightStatus(profile);
        else if (request.action === "stop") {
          result = { stopping: true };
          setTimeout(() => void stop(), 100);
        } else if (request.action === "mutate") {
          if (profile.status !== "ready")
            throw new Error("Profile is still starting; mutations are unavailable.");
          const { validateLaunchForkCommand } = await import("../lib/launch-fork-control.mjs");
          const command = validateLaunchForkCommand(request.command);
          if (!["fund-wallet", "advance-time"].includes(command.action))
            throw new Error("Unsupported control.");
          const task = queue.then(() => applyControl(command, profile, path));
          queue = task.catch(() => {});
          result = await task;
        } else throw new Error("Unknown control.");
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify({ id: profile.id, result }));
      } catch (error) {
        res
          .writeHead(400, { "content-type": "application/json" })
          .end(JSON.stringify({ error: error.message }));
      }
    });
    await new Promise((r, reject) => {
      control.once("error", reject);
      control.listen(0, "127.0.0.1", r);
    });
    profile.owner.controlPort = control.address().port;
    persist();
    const upstream = await upstreamRelay(environment.ROBINHOOD_MAINNET);
    relays.push(upstream);
    if (Number(BigInt(await rpc(upstream.url, "eth_chainId"))) !== 4663)
      throw new Error("ROBINHOOD_MAINNET is not chain 4663.");
    if (!profile.snapshot) {
      const block = await rpc(upstream.url, "eth_getBlockByNumber", [
        options.snapshot ? `0x${BigInt(options.snapshot).toString(16)}` : "latest",
        false,
      ]);
      if (!block?.hash) throw new Error("Snapshot block is unavailable.");
      // Verify executable state now, rather than recording an unusable header-only snapshot.
      const genesis = json(resolve(appRoot, "deployments/robinhood-genesis.json"));
      if (
        (await rpc(upstream.url, "eth_getCode", [
          genesis.contracts.vault.address,
          block.number,
        ])) === "0x"
      )
        throw new Error("Snapshot has no Genesis vault code.");
      profile.snapshot = { number: String(BigInt(block.number)), hash: block.hash };
      persist();
    } else if (!existsSync(resolve(path, "state.json")))
      throw new Error(
        "Saved snapshot has no Anvil state file. Preserve artifacts and create a new profile; refusing silent rebuild."
      );
    console.log(`Fork snapshot ${profile.snapshot.number} (${profile.snapshot.hash})`);
    anvil = ownedProcess(
      "anvil",
      [
        "--host",
        "127.0.0.1",
        "--port",
        String(profile.ports.rpc),
        "--chain-id",
        "4663",
        "--fork-url",
        upstream.url,
        "--fork-block-number",
        profile.snapshot.number,
        "--mnemonic",
        "test test test test test test test test test test test junk",
        "--accounts",
        "20",
        "--balance",
        "1000000",
        "--state",
        resolve(path, "state.json"),
        "--state-interval",
        "15",
        "--preserve-historical-states",
        "--cache-path",
        resolve(path, "anvil-cache"),
        "--silent",
      ],
      { cwd: path, env: childEnvironment(), log: resolve(path, "anvil.log"), children }
    );
    await waitRpc(urls(profile).rpc, anvil);
    await verifyAnvil(profile);
    if (stopping) throw new Error("Startup interrupted.");
    await deploy(profile, path, children);
    if (!profile.stages.finalize) {
      await rpc(urls(profile).rpc, "anvil_mine", ["0x60"]);
      profile.stages.finalize = { status: "complete" };
      persist();
    }
    await rpc(urls(profile).rpc, "anvil_setIntervalMining", [1]);
    if (profile.historyProbe) {
      const result = await rpc(urls(profile).rpc, "eth_call", [
        profile.historyProbe.call,
        profile.historyProbe.block,
      ]);
      if (result !== profile.historyProbe.result)
        throw new Error("Historical contract read changed after restart; preserve state.");
    } else {
      const { client } = transactionContext(profile),
        block = await client.getBlockNumber();
      const { encodeFunctionData, parseAbi } = await import("viem");
      const call = {
        to: profile.addresses.STATICS_DIAMOND_ADDRESS,
        data: encodeFunctionData({
          abi: parseAbi(["function nextPositionId() view returns (uint256)"]),
          functionName: "nextPositionId",
        }),
      };
      profile.historyProbe = {
        call,
        block: `0x${block.toString(16)}`,
        result: await rpc(urls(profile).rpc, "eth_call", [call, `0x${block.toString(16)}`]),
      };
      persist();
    }
    const history = await startForkHistoryRpc({
      mainnetUrl: environment.ROBINHOOD_MAINNET,
      forkUrl: urls(profile).rpc,
      snapshotBlock: profile.snapshot.number,
      snapshotHash: profile.snapshot.hash,
      cacheDirectory: resolve(path, "history-cache"),
    });
    relays.push(history);
    const indexed = await startIndexer(profile, path, history.url, children);
    await startApp(profile, path, indexed.launch, indexed.phaseOne, children);
    profile.owner.controlPort = control.address().port;
    profile.status = "ready";
    persist();
    console.log(
      `Statics fork ready: ${urls(profile).app}/app — chain 4663, profile ${profile.profile}`
    );
    for (const child of children)
      child.once("exit", () => {
        if (!stopping) {
          console.error("Owned component exited; stopping this profile and preserving its state.");
          void stop();
        }
      });
    await stopped;
  } finally {
    await stop();
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
