#!/usr/bin/env node

import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { staticsAbi, wethAbi } from "@statics-protocol/sdk";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  keccak256,
  parseEther,
  toHex,
} from "viem";
import { generateMnemonic, mnemonicToAccount } from "viem/accounts";
import { wordlist } from "@scure/bip39/wordlists/english";

import {
  defaultProtocolRoot,
  deployLocalDollar,
  seedLocalBasket,
  writeLocalEnvironment,
} from "./lib/local-dollar.mjs";
import { importPublicPrivyConfig } from "./lib/local-privy.mjs";

const siteRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const localDirectory = resolve(siteRoot, ".local");
const socketPath = resolve(localDirectory, "connected.sock");
const sessionPath = resolve(localDirectory, "connected-session.json");
const environmentPath = resolve(siteRoot, ".env.local");
const rpcPort = 8_545;
const rpcUrl = `http://127.0.0.1:${rpcPort}`;
let appPort;
let appUrl;
const sourcePath = resolve(
  siteRoot,
  process.env.EVES_MARKET_ENV_PATH || "../market-ui/eves-market-ui/.env.local"
);
const erc20TransferAbi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];
const mnemonic = generateMnemonic(wordlist);
const account = mnemonicToAccount(mnemonic);
const derivedPrivateKey = account.getHdKey().privateKey;
if (!derivedPrivateKey) throw new Error("Could not derive the ephemeral local operator.");
const privateKey = toHex(derivedPrivateKey);

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function requireAvailablePort(port, label) {
  const server = createNetServer();
  await new Promise((resolveCheck, reject) => {
    server.once("error", () => reject(new Error(`${label} port ${port} is already in use.`)));
    server.listen(port, "127.0.0.1", resolveCheck);
  });
  await new Promise((resolveClose) => server.close(resolveClose));
}

async function firstAvailablePort(start) {
  for (let port = start; port < start + 20; port += 1) {
    try {
      await requireAvailablePort(port, "Next.js");
      return port;
    } catch {
      // Preserve an existing local service and try the next loopback port.
    }
  }
  throw new Error(`No available Next.js port was found from ${start} through ${start + 19}.`);
}

async function waitForRpc() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (response.ok) return;
    } catch {
      // The local process is still starting.
    }
    await wait(100);
  }
  throw new Error("Anvil did not become ready.");
}

async function waitForApp(child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error("Next.js exited before the local DApp was ready.");
    try {
      const response = await fetch(`${appUrl}/app`);
      if (response.ok) return;
    } catch {
      // The application is still compiling.
    }
    await wait(250);
  }
  throw new Error("The connected local DApp did not become ready.");
}

async function verifiedStatus(publicClient, deployment, fixtureIds, operatorAddress) {
  if ((await publicClient.getChainId()) !== 31_337) {
    throw new Error("The connected fixture is no longer on Anvil chain 31337.");
  }
  for (const [name, address] of Object.entries({
    ...deployment.contracts,
    ...deployment.liquidity.contracts,
  })) {
    const expected =
      deployment.runtimeCodeHashes[name] ?? deployment.liquidity.runtimeCodeHashes[name];
    const code = await publicClient.getCode({ address });
    if (!code || code === "0x" || keccak256(code).toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`${name} no longer matches the verified local deployment manifest.`);
    }
  }

  const [block, basketCount] = await Promise.all([
    publicClient.getBlock(),
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "basketCount",
    }),
  ]);
  return {
    ok: true,
    chainId: 31_337,
    blockNumber: block.number.toString(),
    timestamp: block.timestamp.toString(),
    operator: operatorAddress,
    protocolCommit: deployment.protocolCommit,
    deploymentStartBlock: deployment.deploymentStartBlock.toString(),
    basketCount: basketCount.toString(),
    fixtureBasketIds: fixtureIds.map(String),
    rpcUrl,
    appUrl,
  };
}

async function confirmedSend(publicClient, walletClient, account, to, data, value = 0n) {
  await publicClient.call({ account: account.address, to, data, value });
  const hash = await walletClient.sendTransaction({ to, data, value });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Local fixture transaction ${hash} reverted.`);
  return hash;
}

async function fundWallet(command, context) {
  const { publicClient, walletClient, account, deployment } = context;
  const ethAmount = parseEther(command.eth);
  const wethAmount = parseEther(command.weth);
  const [ethBefore, wethBefore] = await Promise.all([
    publicClient.getBalance({ address: command.address }),
    publicClient.readContract({
      address: deployment.contracts.weth,
      abi: wethAbi,
      functionName: "balanceOf",
      args: [command.address],
    }),
  ]);

  if (ethAmount > 0n) {
    await publicClient.request({
      method: "anvil_setBalance",
      params: [command.address, `0x${(ethBefore + ethAmount).toString(16)}`],
    });
  }
  let wethHash = null;
  if (wethAmount > 0n) {
    await confirmedSend(
      publicClient,
      walletClient,
      account,
      deployment.contracts.weth,
      encodeFunctionData({ abi: wethAbi, functionName: "deposit" }),
      wethAmount
    );
    wethHash = await confirmedSend(
      publicClient,
      walletClient,
      account,
      deployment.contracts.weth,
      encodeFunctionData({
        abi: erc20TransferAbi,
        functionName: "transfer",
        args: [command.address, wethAmount],
      })
    );
  }

  const [ethAfter, wethAfter] = await Promise.all([
    publicClient.getBalance({ address: command.address }),
    publicClient.readContract({
      address: deployment.contracts.weth,
      abi: wethAbi,
      functionName: "balanceOf",
      args: [command.address],
    }),
  ]);
  if (ethAfter - ethBefore !== ethAmount || wethAfter - wethBefore !== wethAmount) {
    throw new Error("Local wallet funding did not produce the exact requested balance changes.");
  }
  return {
    ok: true,
    action: command.action,
    wallet: command.address,
    ethAdded: command.eth,
    wethAdded: command.weth,
    wethTransferHash: wethHash,
    ethBalance: ethAfter.toString(),
    wethBalance: wethAfter.toString(),
  };
}

async function advanceTime(command, publicClient) {
  const before = await publicClient.getBlock();
  await publicClient.request({
    method: "evm_increaseTime",
    params: [command.seconds],
  });
  await publicClient.request({ method: "evm_mine", params: [] });
  const after = await publicClient.getBlock();
  if (after.timestamp < before.timestamp + BigInt(command.seconds)) {
    throw new Error("Anvil did not advance by the requested number of seconds.");
  }
  return {
    ok: true,
    action: command.action,
    seconds: command.seconds,
    blockNumber: after.number.toString(),
    timestamp: after.timestamp.toString(),
  };
}

function createControlServer(context) {
  let commandQueue = Promise.resolve();
  return createHttpServer((request, response) => {
    if (request.method !== "POST" || request.url !== "/") {
      response.writeHead(404).end();
      return;
    }
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_192) request.destroy();
    });
    request.on("end", () => {
      commandQueue = commandQueue
        .then(async () => {
          const command = JSON.parse(body);
          if (command.action === "status") {
            return verifiedStatus(
              context.publicClient,
              context.deployment,
              context.fixtureIds,
              context.account.address
            );
          }
          if (command.action === "fund-wallet") return fundWallet(command, context);
          if (command.action === "advance") return advanceTime(command, context.publicClient);
          throw new Error("The connected fixture accepts typed local actions only.");
        })
        .then(
          (result) => {
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify(result));
          },
          (error) => {
            response.writeHead(400, { "content-type": "application/json" });
            response.end(
              JSON.stringify({
                ok: false,
                code: "LOCAL_FIXTURE_COMMAND_FAILED",
                error: error instanceof Error ? error.message : "The local fixture command failed.",
              })
            );
          }
        );
    });
  });
}

await requireAvailablePort(rpcPort, "Anvil");
appPort = await firstAvailablePort(3_000);
appUrl = `http://127.0.0.1:${appPort}`;
mkdirSync(localDirectory, { recursive: true, mode: 0o700 });
rmSync(socketPath, { force: true });
rmSync(sessionPath, { force: true });

importPublicPrivyConfig({ sourcePath, targetPath: environmentPath });
const importedEnvironment = readFileSync(environmentPath, "utf8");
if (!/^NEXT_PUBLIC_PRIVY_APP_ID=.+$/mu.test(importedEnvironment)) {
  throw new Error("The connected DApp requires the shared public Privy App ID.");
}

const anvil = spawn(
  "anvil",
  [
    "--host",
    "127.0.0.1",
    "--port",
    String(rpcPort),
    "--chain-id",
    "31337",
    "--mnemonic",
    mnemonic,
    "--accounts",
    "10",
    "--balance",
    "1000",
    "--silent",
  ],
  { stdio: "ignore" }
);
let next = null;
let controlServer = null;

const cleanup = () => {
  controlServer?.close();
  next?.kill("SIGTERM");
  anvil.kill("SIGTERM");
  rmSync(socketPath, { force: true });
  rmSync(sessionPath, { force: true });
};

try {
  await waitForRpc();
  const deployment = await deployLocalDollar({
    protocolRoot: defaultProtocolRoot(siteRoot),
    rpcUrl,
    privateKey,
    quiet: true,
  });
  if (deployment.chainId !== 31_337) throw new Error("Refusing a non-Anvil local deployment.");

  const dollarFixture = await seedLocalBasket({ deployment, rpcUrl, privateKey });
  const wethFixture = await seedLocalBasket({
    deployment,
    rpcUrl,
    privateKey,
    basket: {
      name: "Local Wrapped Ether",
      symbol: "lwETH",
      assets: [deployment.contracts.weth],
      bundleAmounts: [parseEther("0.01")],
    },
  });
  const fixtureIds = [dollarFixture.basketId, wethFixture.basketId];
  writeLocalEnvironment(environmentPath, deployment, rpcUrl);

  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, transport: http(rpcUrl) });
  controlServer = createControlServer({
    account,
    deployment,
    fixtureIds,
    publicClient,
    walletClient,
  });
  await new Promise((resolveListen, reject) => {
    controlServer.once("error", reject);
    controlServer.listen(socketPath, resolveListen);
  });
  chmodSync(socketPath, 0o600);
  writeFileSync(
    sessionPath,
    `${JSON.stringify(
      {
        pid: process.pid,
        socketPath,
        rpcUrl,
        appUrl,
        operator: account.address,
        fixtureBasketIds: fixtureIds.map(String),
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );

  next = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: siteRoot,
    stdio: "inherit",
  });
  await waitForApp(next);
  const status = await verifiedStatus(publicClient, deployment, fixtureIds, account.address);
  process.stdout.write(
    `Connected local DApp ready at ${status.appUrl}/app on verified Anvil chain ${status.chainId}.\n`
  );
  process.stdout.write("Use npm run local:status to inspect the running fixture.\n");

  await new Promise((resolveStop, reject) => {
    const stop = () => resolveStop();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    next.once("exit", (code) => {
      if (code === 0 || code === null) resolveStop();
      else reject(new Error(`Next.js exited with code ${code}.`));
    });
    anvil.once("exit", (code) => {
      reject(new Error(`Anvil exited unexpectedly with code ${code}.`));
    });
  });
} finally {
  cleanup();
}
