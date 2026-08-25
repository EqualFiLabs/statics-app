#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildQuoteV4ExactInputSingleCall,
  buildV4ExactInputSingleSwap,
  dopplerStaticsTokenAbi,
  genesisLaunchDistributorAbi,
  permit2AllowanceAbi,
  staticsFeeReceiverAbi,
  v4QuoterAbi,
  wethAbi,
} from "@statics-protocol/sdk";
import { generateMnemonic, mnemonicToAccount } from "viem/accounts";
import { wordlist } from "@scure/bip39/wordlists/english";
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionResult,
  encodeFunctionData,
  http,
  keccak256,
  parseEther,
  parseAbi,
  toHex,
} from "viem";
import { LAUNCH_FORK_RPC_PORT, validateLaunchForkCommand } from "./lib/launch-fork-control.mjs";

import {
  LAUNCH_FORK_DEFAULT_BLOCK,
  deployLaunchFork,
  readRobinhoodDependencies,
  startRpcRelay,
} from "./lib/launch-fork.mjs";
import { readPublicPrivyConfig } from "./lib/local-privy.mjs";

const siteRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const localRoot = resolve(siteRoot, ".local/launch-fork");
const socketPath = resolve(localRoot, "control.sock");
const sessionPath = resolve(localRoot, "session.json");
const ponderData = resolve(localRoot, "ponder");
const ponderProject = resolve(localRoot, "ponder-project");
const rpcPort = LAUNCH_FORK_RPC_PORT;
const rpcUrl = `http://127.0.0.1:${rpcPort}`;
const ponderPort = 42_070;
const indexerUrl = `http://127.0.0.1:${ponderPort}`;
const protocolRoot = process.env.STATICS_PROTOCOL_REPOSITORY?.trim();
const upstreamRpc = process.env.ROBINHOOD_MAINNET?.trim();
const dependencyManifest = protocolRoot ? readRobinhoodDependencies(protocolRoot) : null;
const forkBlock =
  process.env.ROBINHOOD_FORK_BLOCK?.trim() ||
  String(dependencyManifest?.forkBlock ?? LAUNCH_FORK_DEFAULT_BLOCK);
const mnemonic = generateMnemonic(wordlist);
const account = mnemonicToAccount(mnemonic);
const derivedPrivateKey = account.getHdKey().privateKey;
if (!derivedPrivateKey) throw new Error("Could not derive the ephemeral launch-fork operator.");
const privateKey = toHex(derivedPrivateKey);

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}
const launchForkVaultStatusAbi = parseAbi([
  "function vaultAccounting() view returns ((uint256 vaultPrice, uint256 maximumSupply, uint256 mintedSupply, uint256 vaultInventory, uint256 circulatingGenesis, uint256 tokenBacking, uint256 grossBacking, uint256 outstandingGenesisCredit, uint256 requiredBacking, uint256 tokenCustody, uint256 reserveETH, uint256 nativeCustody, uint256 genesisEpochEnd, bool epochActive, uint256 reserveBackingPerGenesis) accounting)",
]);

async function requirePort(port, label) {
  const server = createNetServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", () => reject(new Error(`${label} port ${port} is already in use.`)));
    server.listen(port, "127.0.0.1", resolveListen);
  });
  await new Promise((resolveClose) => server.close(resolveClose));
}

async function availableAppPort() {
  for (let port = 3_000; port < 3_020; port += 1) {
    try {
      await requirePort(port, "Next.js");
      return port;
    } catch {
      // Preserve unrelated local applications and try the next port.
    }
  }
  throw new Error("No available Next.js port was found from 3000 through 3019.");
}

async function waitForRpc() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "anvil_nodeInfo", params: [] }),
      });
      if (response.ok) {
        const body = await response.json();
        if (body.result) return;
      }
    } catch {
      // Anvil is still starting or hydrating the fork.
    }
    await wait(100);
  }
  throw new Error("The Robinhood Anvil fork did not become ready.");
}

async function waitForUrl(url, child, label, attempts = 300) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`${label} exited before becoming ready.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The child is still starting or indexing.
    }
    await wait(250);
  }
  throw new Error(`${label} did not become ready.`);
}

async function waitForGenesisIndexer(child, expectedDeploymentId) {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (child.exitCode !== null) throw new Error("Ponder exited before indexing Genesis events.");
    try {
      const response = await fetch(new URL("/genesis/next-available", indexerUrl));
      if (!response.ok) throw new Error("Genesis indexing is not ready.");
      const payload = await response.json();
      if (payload.deploymentId === expectedDeploymentId && payload.tokenId === "1") return;
    } catch {
      // Ponder can report ready before it has completed historical indexing.
    }
    await wait(500);
  }
  throw new Error("Ponder did not become ready for Genesis ownership discovery.");
}

async function confirmed(walletClient, publicClient, transaction) {
  const hash = await walletClient.sendTransaction(transaction);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Local fork transaction ${hash} reverted.`);
  return hash;
}

function poolKey(manifest) {
  return manifest.market.poolKey;
}

function zeroForInput(manifest, input) {
  const address =
    input === "statics" ? manifest.contracts.statics.address : manifest.contracts.weth.address;
  if (manifest.market.poolKey.currency0.toLowerCase() === address.toLowerCase()) return true;
  if (manifest.market.poolKey.currency1.toLowerCase() === address.toLowerCase()) return false;
  throw new Error("The generated local PoolKey does not contain the requested asset.");
}

async function quote(publicClient, manifest, input, amount) {
  const result = await publicClient.call({
    to: manifest.contracts.quoter.address,
    data: buildQuoteV4ExactInputSingleCall(
      poolKey(manifest),
      zeroForInput(manifest, input),
      amount
    ),
  });
  if (!result.data) throw new Error("The local V4 quote returned no data.");
  const [amountOut] = decodeFunctionResult({
    abi: v4QuoterAbi,
    functionName: "quoteExactInputSingle",
    data: result.data,
  });
  return amountOut;
}

async function generateVolume(command, context) {
  const { manifest, publicClient, walletClient } = context;
  const amountIn = parseEther(command.eth);
  const statics = manifest.contracts.statics.address;
  const router = manifest.contracts.universalRouter.address;
  const permit2 = manifest.contracts.permit2.address;
  await confirmed(walletClient, publicClient, {
    to: statics,
    data: encodeFunctionData({
      abi: dopplerStaticsTokenAbi,
      functionName: "approve",
      args: [permit2, 2n ** 256n - 1n],
    }),
  });
  await confirmed(walletClient, publicClient, {
    to: permit2,
    data: encodeFunctionData({
      abi: permit2AllowanceAbi,
      functionName: "approve",
      args: [statics, router, 2n ** 160n - 1n, 2n ** 48n - 1n],
    }),
  });

  let totalEthIn = 0n;
  let totalEthOut = 0n;
  for (let cycle = 0; cycle < command.cycles; cycle += 1) {
    const block = await publicClient.getBlock();
    const quotedBuy = await quote(publicClient, manifest, "weth", amountIn);
    const staticsBefore = await publicClient.readContract({
      address: statics,
      abi: dopplerStaticsTokenAbi,
      functionName: "balanceOf",
      args: [account.address],
    });
    const buy = buildV4ExactInputSingleSwap({
      router,
      poolKey: poolKey(manifest),
      zeroForOne: zeroForInput(manifest, "weth"),
      amountIn,
      amountOutMinimum: (quotedBuy * 99n) / 100n,
      deadline: block.timestamp + 120n,
      settlement: {
        input: "native",
        output: "erc20",
        wrappedNative: manifest.contracts.weth.address,
      },
    });
    await confirmed(walletClient, publicClient, {
      to: buy.target,
      data: buy.calldata,
      value: buy.value,
    });
    const staticsAfter = await publicClient.readContract({
      address: statics,
      abi: dopplerStaticsTokenAbi,
      functionName: "balanceOf",
      args: [account.address],
    });
    const sellAmount = staticsAfter - staticsBefore;
    const quotedSell = await quote(publicClient, manifest, "statics", sellAmount);
    const sell = buildV4ExactInputSingleSwap({
      router,
      poolKey: poolKey(manifest),
      zeroForOne: zeroForInput(manifest, "statics"),
      amountIn: sellAmount,
      amountOutMinimum: (quotedSell * 99n) / 100n,
      deadline: block.timestamp + 120n,
      settlement: {
        input: "erc20",
        output: "native",
        wrappedNative: manifest.contracts.weth.address,
      },
    });
    const ethBefore = await publicClient.getBalance({ address: account.address });
    const sellHash = await confirmed(walletClient, publicClient, {
      to: sell.target,
      data: sell.calldata,
    });
    const receipt = await publicClient.getTransactionReceipt({ hash: sellHash });
    const ethAfter = await publicClient.getBalance({ address: account.address });
    totalEthIn += amountIn;
    totalEthOut += ethAfter + receipt.gasUsed * receipt.effectiveGasPrice - ethBefore;
  }

  await confirmed(walletClient, publicClient, {
    to: manifest.contracts.launchDistributor.address,
    data: encodeFunctionData({ abi: genesisLaunchDistributorAbi, functionName: "accrue" }),
  });
  const [harvestedStatics, harvestedWeth] = await Promise.all([
    publicClient.readContract({
      address: manifest.contracts.feeReceiver.address,
      abi: staticsFeeReceiverAbi,
      functionName: "cumulativeHarvested",
      args: [manifest.contracts.statics.address],
    }),
    publicClient.readContract({
      address: manifest.contracts.feeReceiver.address,
      abi: staticsFeeReceiverAbi,
      functionName: "cumulativeHarvested",
      args: [manifest.contracts.weth.address],
    }),
  ]);
  return {
    ok: true,
    action: command.action,
    cycles: command.cycles,
    totalEthIn: totalEthIn.toString(),
    totalEthOut: totalEthOut.toString(),
    cumulativeHarvestedStatics: harvestedStatics.toString(),
    cumulativeHarvestedWeth: harvestedWeth.toString(),
  };
}

async function fundWallet(command, context) {
  const { manifest, publicClient, walletClient } = context;
  const eth = parseEther(command.eth);
  const weth = parseEther(command.weth);
  const statics = parseEther(command.statics);
  const before = await publicClient.getBalance({ address: command.wallet });
  if (eth > 0n) {
    await publicClient.request({
      method: "anvil_setBalance",
      params: [command.wallet, toHex(before + eth)],
    });
  }
  if (weth > 0n) {
    await confirmed(walletClient, publicClient, {
      to: manifest.contracts.weth.address,
      data: encodeFunctionData({ abi: wethAbi, functionName: "deposit" }),
      value: weth,
    });
    await confirmed(walletClient, publicClient, {
      to: manifest.contracts.weth.address,
      data: encodeFunctionData({
        abi: dopplerStaticsTokenAbi,
        functionName: "transfer",
        args: [command.wallet, weth],
      }),
    });
  }
  if (statics > 0n) {
    await confirmed(walletClient, publicClient, {
      to: manifest.contracts.statics.address,
      data: encodeFunctionData({
        abi: dopplerStaticsTokenAbi,
        functionName: "transfer",
        args: [command.wallet, statics],
      }),
    });
  }
  return {
    ok: true,
    action: command.action,
    wallet: command.wallet,
    eth: command.eth,
    weth: command.weth,
    statics: command.statics,
  };
}
async function advanceTime(command, context) {
  const before = await context.publicClient.getBlock();
  await context.publicClient.request({ method: "evm_increaseTime", params: [command.seconds] });
  await context.publicClient.request({ method: "evm_mine", params: [] });
  const after = await context.publicClient.getBlock();
  if (after.timestamp <= before.timestamp)
    throw new Error("The local fork timestamp did not advance.");
  return {
    ok: true,
    action: command.action,
    seconds: command.seconds,
    beforeTimestamp: before.timestamp.toString(),
    afterTimestamp: after.timestamp.toString(),
  };
}

async function verifiedStatus(context) {
  const { manifest, publicClient, appUrl } = context;
  const chainId = await publicClient.getChainId();
  if (chainId !== 31_337) throw new Error("The local fork no longer reports Anvil chain 31337.");
  const codeHashes = {};
  for (const [name, contract] of Object.entries(manifest.contracts)) {
    const code = await publicClient.getCode({ address: contract.address });
    const actual = code && code !== "0x" ? keccak256(code) : null;
    const verified = actual?.toLowerCase() === contract.runtimeCodeHash.toLowerCase();
    if (!verified) throw new Error(`${name} no longer matches the generated local manifest.`);
    codeHashes[name] = {
      address: contract.address,
      expected: contract.runtimeCodeHash,
      actual,
      verified,
    };
  }
  const ready = await fetch(`${indexerUrl}/ready`);
  if (!ready.ok) throw new Error("The launch-fork indexer is not ready.");
  const nextAvailableResponse = await fetch(`${indexerUrl}/genesis/next-available`);
  if (!nextAvailableResponse.ok) throw new Error("The Genesis indexer fixture is not ready.");
  const nextAvailable = await nextAvailableResponse.json();
  const accounting = await publicClient.readContract({
    address: manifest.contracts.vault.address,
    abi: launchForkVaultStatusAbi,
    functionName: "vaultAccounting",
  });
  const forkBlockData = await publicClient.getBlock({ blockNumber: context.forkBlock });
  const sdkProvenance = JSON.parse(
    readFileSync(resolve(siteRoot, "vendor/statics-sdk/provenance.json"), "utf8")
  );
  return {
    ok: true,
    sourceRepository: manifest.sourceRepository,
    protocolCommit: manifest.protocolCommit,
    sdkSourceCommit: sdkProvenance.extensionSource?.commit ?? sdkProvenance.source?.commit,
    deploymentChainId: 4_663,
    chainId,
    forkBlock: context.forkBlock.toString(),
    forkBlockHash: forkBlockData.hash,
    manifestForkBlock: manifest.dependencyManifest.forkBlock,
    manifestForkBlockHash: manifest.dependencyManifest.forkBlockHash,
    deploymentStartBlock: manifest.deploymentStartBlock,
    codeHashesVerified: true,
    contracts: codeHashes,
    ponderReady: true,
    indexedGenesisFixtureIds: nextAvailable.tokenId ? [nextAvailable.tokenId] : [],
    genesis: {
      vaultInventory: accounting.vaultInventory.toString(),
      circulatingGenesis: accounting.circulatingGenesis.toString(),
      reserveETH: accounting.reserveETH.toString(),
      genesisEpochEnd: accounting.genesisEpochEnd.toString(),
      epochActive: accounting.epochActive,
      totalOutstandingCredit: accounting.outstandingGenesisCredit.toString(),
    },
    rpcUrl,
    indexerUrl,
    appUrl,
  };
}

function createControlServer(context) {
  return createHttpServer((request, response) => {
    if (request.method !== "POST") return response.writeHead(405).end();
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) request.destroy();
    });
    request.on("end", () => {
      void Promise.resolve()
        .then(() => validateLaunchForkCommand(JSON.parse(body)))
        .then((command) => {
          if (command.action === "status") return verifiedStatus(context);
          if (command.action === "advance-time") return advanceTime(command, context);
          if (command.action === "fund-wallet") return fundWallet(command, context);
          if (command.action === "generate-volume") return generateVolume(command, context);
          throw new Error("Unsupported launch-fork command.");
        })
        .then((result) => {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify(result));
        })
        .catch((error) => {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(
            JSON.stringify({ error: error instanceof Error ? error.message : "Command failed." })
          );
        });
    });
  });
}

if (!protocolRoot)
  throw new Error("STATICS_PROTOCOL_REPOSITORY must name the Statics protocol checkout.");
if (!upstreamRpc) throw new Error("ROBINHOOD_MAINNET is required and remains server-only.");
if (forkBlock && !/^\d+$/u.test(forkBlock))
  throw new Error("ROBINHOOD_FORK_BLOCK must be a block number.");
let localPrivyAppId = null;
try {
  localPrivyAppId = readPublicPrivyConfig(
    readFileSync(resolve(siteRoot, ".env.local"), "utf8")
  ).appId;
} catch (error) {
  if (error?.code !== "ENOENT" && !process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim()) throw error;
}
const configuredPrivyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() || localPrivyAppId;
if (!configuredPrivyAppId) {
  throw new Error(
    "NEXT_PUBLIC_PRIVY_APP_ID is required in the local environment for wallet testing."
  );
}

await requirePort(rpcPort, "Anvil");
await requirePort(ponderPort, "Ponder");
const appPort = await availableAppPort();
const appUrl = `http://127.0.0.1:${appPort}`;
rmSync(localRoot, { recursive: true, force: true });
mkdirSync(ponderData, { recursive: true, mode: 0o700 });
mkdirSync(ponderProject, { recursive: true, mode: 0o700 });
symlinkSync(resolve(siteRoot, "ponder/node_modules"), resolve(ponderProject, "node_modules"));
for (const entry of [
  "package.json",
  "ponder.config.ts",
  "ponder.schema.ts",
  "src",
  "tsconfig.json",
]) {
  cpSync(resolve(siteRoot, "ponder", entry), resolve(ponderProject, entry), { recursive: true });
}
writeFileSync(resolve(ponderProject, ".env.local"), "", { mode: 0o600 });

const relay = await startRpcRelay(upstreamRpc);
let indexerRelay = null;
const anvilArguments = [
  "--host",
  "127.0.0.1",
  "--port",
  String(rpcPort),
  "--chain-id",
  "4663",
  "--fork-url",
  relay.url,
  "--timeout",
  process.env.ROBINHOOD_FORK_RPC_TIMEOUT_MS?.trim() || "300000",
  "--retries",
  "5",
  "--no-rate-limit",
  "--mnemonic",
  mnemonic,
  "--accounts",
  "10",
  "--balance",
  "1000000",
];
if (process.env.LAUNCH_FORK_DEBUG !== "1") anvilArguments.push("--silent");
if (forkBlock) anvilArguments.push("--fork-block-number", forkBlock);
const anvil = spawn("anvil", anvilArguments, {
  stdio: process.env.LAUNCH_FORK_DEBUG === "1" ? "inherit" : "ignore",
});
let ponder = null;
let next = null;
let control = null;

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
  child.kill("SIGTERM");
  await Promise.race([exited, wait(5_000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

async function cleanup() {
  if (control?.listening) await new Promise((resolveClose) => control.close(resolveClose));
  await stopChild(next);
  await stopChild(ponder);
  await stopChild(anvil);
  if (relay.server.listening) await new Promise((resolveClose) => relay.server.close(resolveClose));
  if (indexerRelay?.server.listening) {
    await new Promise((resolveClose) => indexerRelay.server.close(resolveClose));
  }
  rmSync(socketPath, { force: true });
  rmSync(sessionPath, { force: true });
}

try {
  await waitForRpc();
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, transport: http(rpcUrl) });
  const resolvedForkBlock = await publicClient.getBlockNumber();
  const { manifest } = await deployLaunchFork({
    protocolRoot,
    rpcUrl,
    privateKey,
    publicClient,
    salt: keccak256(toHex(`STATICS_LAUNCH_FORK:${resolvedForkBlock}:${account.address}`)),
  });
  // Deploy with Robinhood's chain identity so the production Doppler module
  // selection remains exact, then expose the interactive fork as ordinary
  // Anvil. This gives the app three unambiguous selectable network IDs.
  await publicClient.request({ method: "anvil_setChainId", params: [31_337] });
  // Anvil keeps the fork's finality distance. Finalize deployment blocks before
  // Ponder starts so its historical pass sees constructor and ERC-2309 logs.
  await publicClient.request({ method: "anvil_mine", params: ["0x60"] });
  indexerRelay = await startRpcRelay(rpcUrl);

  const ponderEnvironment = {
    ...process.env,
    DATABASE_URL: "",
    DATABASE_PRIVATE_URL: "",
    PONDER_DATABASE_DIRECTORY: ponderData,
    PONDER_DEPLOYMENT_ID: manifest.deploymentId,
    PONDER_CHAIN_ID: "31337",
    PONDER_DEPLOYMENT_START_BLOCK: manifest.deploymentStartBlock,
    PONDER_RPC_URL_31337: indexerRelay.url,
    PONDER_STATICS_GENESIS_ADDRESS: manifest.contracts.genesis.address,
    PONDER_GENESIS_VAULT_ADDRESS: manifest.contracts.vault.address,
    PONDER_GENESIS_ACTIVATION_REGISTRY_ADDRESS: manifest.contracts.activationRegistry.address,
    PONDER_GENESIS_LAUNCH_DISTRIBUTOR_ADDRESS: manifest.contracts.launchDistributor.address,
    PONDER_STATICS_FEE_RECEIVER_ADDRESS: manifest.contracts.feeReceiver.address,
    PONDER_POOL_MANAGER_ADDRESS: manifest.contracts.poolManager.address,
    PONDER_CANONICAL_POOL_ID: manifest.market.poolId,
    PONDER_ALLOWED_ORIGIN: appUrl,
  };
  ponder = spawn(
    resolve(siteRoot, "ponder/node_modules/.bin/ponder"),
    ["dev", "--hostname", "127.0.0.1", "--port", String(ponderPort), "--disable-ui"],
    {
      cwd: ponderProject,
      stdio: "inherit",
      env: ponderEnvironment,
    }
  );
  await waitForUrl(`${indexerUrl}/ready`, ponder, "Ponder", 600);
  await waitForGenesisIndexer(ponder, manifest.deploymentId);

  const nextEnvironment = {
    ...process.env,
    NEXT_PUBLIC_APP_ENV: "development",
    NEXT_PUBLIC_APP_NETWORK: "anvil",
    NEXT_PUBLIC_ANVIL_RPC_URL: rpcUrl,
    NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST: JSON.stringify(manifest),
    NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL: indexerUrl,
  };
  next = spawn(
    process.execPath,
    [
      resolve(siteRoot, "node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(appPort),
    ],
    {
      cwd: siteRoot,
      stdio: "inherit",
      env: nextEnvironment,
    }
  );
  await waitForUrl(`${appUrl}/app`, next, "Next.js");

  const context = { manifest, publicClient, walletClient, forkBlock: resolvedForkBlock, appUrl };
  control = createControlServer(context);
  await new Promise((resolveListen, reject) => {
    control.once("error", reject);
    control.listen(socketPath, resolveListen);
  });
  chmodSync(socketPath, 0o600);
  writeFileSync(sessionPath, `${JSON.stringify(await verifiedStatus(context), null, 2)}\n`, {
    mode: 0o600,
  });
  process.stdout.write(`Statics launch fork ready at ${appUrl}/app on Local Anvil chain 31337.\n`);
  process.stdout.write("Use npm run launch-fork:status to verify the running session.\n");
  await new Promise((resolveStop, reject) => {
    const stop = () => resolveStop();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    for (const [child, label] of [
      [anvil, "Anvil"],
      [ponder, "Ponder"],
      [next, "Next.js"],
    ]) {
      child.once("exit", (code) =>
        reject(new Error(`${label} exited unexpectedly with code ${code}.`))
      );
    }
  });
} finally {
  await cleanup();
}
