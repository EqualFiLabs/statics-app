#!/usr/bin/env node

import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LOAN_RECOVERY_GRACE_PERIOD,
  basketTokenAbi,
  buildDepositETHTransaction,
  buildMintCall,
  staticsAbi,
  staticsDollarCoreAbi,
  staticsDollarTokenAbi,
  v4PositionManagerReadAbi,
  wethAbi,
} from "@statics-protocol/sdk";
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
const nextDirectory = resolve(localDirectory, "next-connected");
const connectedTypeScriptPath = resolve(localDirectory, "tsconfig.connected.json");
const nextEnvironmentDeclarationPath = resolve(siteRoot, "next-env.d.ts");
const nextEnvironmentDeclaration = readFileSync(nextEnvironmentDeclarationPath, "utf8");
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
const BPS = 10_000n;
const minimum = (amount) => (amount * 9_950n) / BPS;
const maximum = (amount) => (amount * 10_050n + BPS - 1n) / BPS;

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

async function ensureWeth(context, required) {
  const { publicClient, deployment, account, walletClient } = context;
  const balance = await publicClient.readContract({
    address: deployment.contracts.weth,
    abi: wethAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance >= required) return;
  await confirmedSend(
    publicClient,
    walletClient,
    account,
    deployment.contracts.weth,
    encodeFunctionData({ abi: wethAbi, functionName: "deposit" }),
    required - balance
  );
}

async function ensureDollar(context, required) {
  const { publicClient, deployment, account, walletClient } = context;
  let balance = await publicClient.readContract({
    address: deployment.contracts.dollar,
    abi: staticsDollarTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance >= required) return;

  const collateralAmount = parseEther("0.1");
  const preview = await publicClient.readContract({
    address: deployment.contracts.core,
    abi: staticsDollarCoreAbi,
    functionName: "previewDeposit",
    args: [1n, collateralAmount],
  });
  const transaction = buildDepositETHTransaction(
    collateralAmount,
    account.address,
    account.address,
    minimum(preview.staticsDollarMinted),
    minimum(preview.sharesMinted)
  );
  await confirmedSend(
    publicClient,
    walletClient,
    account,
    deployment.contracts.gateway,
    transaction.data,
    transaction.value
  );
  balance = await publicClient.readContract({
    address: deployment.contracts.dollar,
    abi: staticsDollarTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance < required) {
    throw new Error("The local operator could not mint enough Dollar for this bounded fixture.");
  }
}

async function mintBasket(context, basketId, shares) {
  const { publicClient, deployment, account, walletClient } = context;
  const basket = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "basket",
    args: [basketId],
  });
  if (basket.assets.length !== 1) {
    throw new Error("This local generator supports the seeded single-asset baskets only.");
  }
  const quote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteMint",
    args: [basketId, shares],
  });
  const required = maximum(quote[0]);
  const asset = basket.assets[0];
  if (asset.toLowerCase() === deployment.contracts.dollar.toLowerCase()) {
    await ensureDollar(context, required);
  } else if (asset.toLowerCase() === deployment.contracts.weth.toLowerCase()) {
    await ensureWeth(context, required);
  } else {
    throw new Error("The seeded basket asset is not fundable by the local operator.");
  }
  await confirmedSend(
    publicClient,
    walletClient,
    account,
    asset,
    encodeFunctionData({
      abi: basketTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, required],
    })
  );
  return confirmedSend(
    publicClient,
    walletClient,
    account,
    deployment.contracts.diamond,
    buildMintCall(basketId, shares, account.address, [required])
  );
}

async function generateRewards(command, context) {
  const { publicClient, deployment } = context;
  const positionId = BigInt(command.positionId);
  const owner = await publicClient
    .readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "ownerOf",
      args: [positionId],
    })
    .catch(() => null);
  if (!owner) {
    throw new Error(
      `PositionNFT #${command.positionId} does not exist on the connected local deployment.`
    );
  }
  const selected = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "positionRewardAssets",
    args: [positionId],
  });
  const supported = selected.filter(
    (asset) =>
      asset.toLowerCase() === deployment.contracts.dollar.toLowerCase() ||
      asset.toLowerCase() === deployment.contracts.weth.toLowerCase()
  );
  if (!supported.length) {
    throw new Error("Select Dollar or WETH rewards on the PositionNFT before generating fees.");
  }
  const before = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "pendingRewards",
    args: [positionId, supported],
  });
  const shares = parseEther(command.shares);
  const hashes = [];
  if (
    supported.some((asset) => asset.toLowerCase() === deployment.contracts.dollar.toLowerCase())
  ) {
    hashes.push(await mintBasket(context, BigInt(context.fixtureIds[0]), shares));
  }
  if (supported.some((asset) => asset.toLowerCase() === deployment.contracts.weth.toLowerCase())) {
    hashes.push(await mintBasket(context, BigInt(context.fixtureIds[1]), shares));
  }
  const after = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "pendingRewards",
    args: [positionId, supported],
  });
  if (after.some((amount, index) => amount <= (before[index] ?? 0n))) {
    throw new Error("Fee-bearing mints did not increase every requested PositionNFT reward.");
  }
  return {
    ok: true,
    action: command.action,
    positionId: command.positionId,
    assets: supported,
    generated: after.map((amount, index) => (amount - (before[index] ?? 0n)).toString()),
    hashes,
  };
}

async function ensureSwapToken(context, token, amount) {
  const { publicClient, deployment, account } = context;
  let balance = await publicClient.readContract({
    address: token,
    abi: basketTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance >= amount) return;
  if (token.toLowerCase() === deployment.contracts.dollar.toLowerCase()) {
    await ensureDollar(context, amount);
  } else if (token.toLowerCase() === deployment.contracts.weth.toLowerCase()) {
    await ensureWeth(context, amount);
  } else {
    const basketCount = await publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "basketCount",
    });
    let basketId = null;
    for (let candidate = 0n; candidate < basketCount; candidate += 1n) {
      const basket = await publicClient.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "basket",
        args: [candidate],
      });
      if (basket.token.toLowerCase() === token.toLowerCase()) {
        basketId = candidate;
        break;
      }
    }
    if (basketId === null) throw new Error("The selected pool input token is not a known basket.");
    await mintBasket(context, basketId, amount * 2n);
  }
  balance = await publicClient.readContract({
    address: token,
    abi: basketTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance < amount) throw new Error("The local operator could not fund the canonical swap.");
}

async function generateLpFees(command, context) {
  const { publicClient, walletClient, deployment, account, protocolRoot } = context;
  const positionId = BigInt(command.positionId);
  const tokenId = BigInt(command.tokenId);
  const staked = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "stakedLiquidityPosition",
    args: [tokenId],
  });
  if (!staked.staked || staked.positionId !== positionId) {
    throw new Error("The LP NFT is not staked under the requested PositionNFT.");
  }
  await publicClient.request({ method: "evm_mine", params: [] });
  const [poolKey] = await publicClient.readContract({
    address: deployment.liquidity.contracts.positionManager,
    abi: v4PositionManagerReadAbi,
    functionName: "getPoolAndPositionInfo",
    args: [tokenId],
  });
  const before = await publicClient.readContract({
    account: account.address,
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "pendingLiquidityRewards",
    args: [positionId, tokenId],
  });
  const swapAmount = parseEther(command.amount);
  await ensureSwapToken(context, poolKey.currency0, swapAmount);

  const artifact = JSON.parse(
    readFileSync(resolve(protocolRoot, "out/PoolSwapTest.sol/PoolSwapTest.json"), "utf8")
  );
  const deployHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [deployment.liquidity.contracts.poolManager],
  });
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  if (deployReceipt.status !== "success" || !deployReceipt.contractAddress) {
    throw new Error("The local canonical swap router did not deploy.");
  }
  await confirmedSend(
    publicClient,
    walletClient,
    account,
    poolKey.currency0,
    encodeFunctionData({
      abi: basketTokenAbi,
      functionName: "approve",
      args: [deployReceipt.contractAddress, swapAmount],
    })
  );
  const swapHash = await confirmedSend(
    publicClient,
    walletClient,
    account,
    deployReceipt.contractAddress,
    encodeFunctionData({
      abi: artifact.abi,
      functionName: "swap",
      args: [
        poolKey,
        {
          zeroForOne: true,
          amountSpecified: -swapAmount,
          sqrtPriceLimitX96: 4_295_128_740n,
        },
        { takeClaims: false, settleUsingBurn: false },
        "0x",
      ],
    })
  );
  const after = await publicClient.readContract({
    account: account.address,
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "pendingLiquidityRewards",
    args: [positionId, tokenId],
  });
  if (after[1] <= before[1] && after[3] <= before[3]) {
    throw new Error("The canonical swap did not increase LP NFT hook rewards.");
  }
  return {
    ok: true,
    action: command.action,
    positionId: command.positionId,
    tokenId: command.tokenId,
    swapHash,
    pending0: after[1].toString(),
    pending1: after[3].toString(),
  };
}

async function seedRecovery(command, context) {
  const { publicClient, deployment } = context;
  const loanId = BigInt(command.loanId);
  const loan = await publicClient
    .readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "loan",
      args: [loanId],
    })
    .catch(() => null);
  if (!loan) {
    throw new Error(`Loan #${command.loanId} does not exist on the connected local deployment.`);
  }
  const recoveryTimestamp = BigInt(loan.maturity) + LOAN_RECOVERY_GRACE_PERIOD + 1n;
  const current = await publicClient.getBlock();
  if (current.timestamp < recoveryTimestamp) {
    await publicClient.request({
      method: "evm_setNextBlockTimestamp",
      params: [Number(recoveryTimestamp)],
    });
    await publicClient.request({ method: "evm_mine", params: [] });
  }
  const confirmed = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "loan",
    args: [loanId],
  });
  const block = await publicClient.getBlock();
  if (confirmed.positionId !== loan.positionId || block.timestamp < recoveryTimestamp) {
    throw new Error("The loan did not enter the recoverable fixture state.");
  }
  return {
    ok: true,
    action: command.action,
    loanId: command.loanId,
    positionId: loan.positionId.toString(),
    basketId: loan.basketId.toString(),
    maturity: BigInt(loan.maturity).toString(),
    recoveryTimestamp: recoveryTimestamp.toString(),
    currentTimestamp: block.timestamp.toString(),
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
          if (command.action === "generate-rewards") return generateRewards(command, context);
          if (command.action === "generate-lp-fees") return generateLpFees(command, context);
          if (command.action === "seed-recovery") return seedRecovery(command, context);
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
rmSync(nextDirectory, { recursive: true, force: true });
writeFileSync(
  connectedTypeScriptPath,
  `${JSON.stringify(
    {
      extends: "../tsconfig.json",
      compilerOptions: { incremental: false },
      include: ["../next-env.d.ts", "../**/*.ts", "../**/*.tsx"],
      exclude: ["../node_modules"],
    },
    null,
    2
  )}\n`,
  { mode: 0o600 }
);

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

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
  child.kill("SIGTERM");
  await Promise.race([exited, wait(5_000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

const cleanup = async () => {
  if (controlServer?.listening) {
    await new Promise((resolveClose) => controlServer.close(resolveClose));
  }
  await stopChild(next);
  await stopChild(anvil);
  try {
    rmSync(socketPath, { force: true });
    rmSync(sessionPath, { force: true });
    rmSync(nextDirectory, { recursive: true, force: true });
    rmSync(connectedTypeScriptPath, { force: true });
  } finally {
    writeFileSync(nextEnvironmentDeclarationPath, nextEnvironmentDeclaration);
  }
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

  const protocolRoot = defaultProtocolRoot(siteRoot);
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
    protocolRoot,
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
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_ENV: "development",
        STATICS_NEXT_DIST_DIR: ".local/next-connected",
        STATICS_NEXT_TSCONFIG: ".local/tsconfig.connected.json",
      },
    }
  );
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
  await cleanup();
}
