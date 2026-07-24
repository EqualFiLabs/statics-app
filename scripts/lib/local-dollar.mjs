import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCreateBasketTransaction, staticsAbi } from "@statics-protocol/sdk";
import { createPublicClient, createWalletClient, http, keccak256, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const labels = {
  core: "STATICS_DOLLAR_CORE_ADDRESS",
  diamond: "STATICS_DIAMOND_ADDRESS",
  dollar: "STATICS_DOLLAR_TOKEN_ADDRESS",
  risk: "STATICS_DOLLAR_RISK_TOKEN_ADDRESS",
  gateway: "STATICS_DOLLAR_GATEWAY_ADDRESS",
  weth: "WETH_ADDRESS",
  oracle: "STATICS_DOLLAR_ORACLE_ADDRESS",
};
const liquidityLabels = {
  poolManager: "STATICS_POOL_MANAGER_ADDRESS",
  positionManager: "STATICS_POSITION_MANAGER_ADDRESS",
  permit2: "STATICS_PERMIT2_ADDRESS",
  swapFeeHook: "STATICS_SWAP_FEE_HOOK_ADDRESS",
  liquidityManager: "STATICS_LIQUIDITY_MANAGER_ADDRESS",
  stateView: "STATICS_STATE_VIEW_ADDRESS",
};

export async function deployLocalDollar({ protocolRoot, rpcUrl, privateKey, quiet = false }) {
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required for local deployment and is never persisted.");
  }
  const client = createPublicClient({ transport: http(rpcUrl) });
  const deploymentStartBlock = (await client.getBlockNumber()) + 1n;
  const output = execFileSync(
    "forge",
    [
      "script",
      "script/dollar/DeployLocalStaticsWithLiquidity.s.sol:DeployLocalStaticsWithLiquidity",
      "--sig",
      "runLocalWithLiquidity()",
      "--broadcast",
      "--slow",
      "--rpc-url",
      rpcUrl,
    ],
    {
      cwd: protocolRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        FOUNDRY_ETH_RPC_TIMEOUT: process.env.FOUNDRY_ETH_RPC_TIMEOUT || "300",
        PRIVATE_KEY: privateKey,
      },
      maxBuffer: 20 * 1024 * 1024,
    }
  );
  if (!quiet) process.stdout.write(output);

  const contracts = {};
  for (const [name, label] of Object.entries(labels)) {
    const match = output.match(new RegExp(`${label}\\s+(0x[a-fA-F0-9]{40})`));
    if (!match) throw new Error(`Forge output did not include ${label}.`);
    contracts[name] = match[1];
  }
  const liquidityContracts = {};
  for (const [name, label] of Object.entries(liquidityLabels)) {
    const match = output.match(new RegExp(`${label}\\s+(0x[a-fA-F0-9]{40})`));
    if (!match) throw new Error(`Forge output did not include ${label}.`);
    liquidityContracts[name] = match[1];
  }

  const runtimeCodeHashes = {};
  for (const [name, address] of Object.entries(contracts)) {
    const code = await client.getCode({ address });
    if (!code || code === "0x") throw new Error(`${name} has no runtime code after deployment.`);
    runtimeCodeHashes[name] = keccak256(code);
  }
  const liquidityRuntimeCodeHashes = {};
  for (const [name, address] of Object.entries(liquidityContracts)) {
    const code = await client.getCode({ address });
    if (!code || code === "0x") throw new Error(`${name} has no runtime code after deployment.`);
    liquidityRuntimeCodeHashes[name] = keccak256(code);
  }

  const protocolCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: protocolRoot,
    encoding: "utf8",
  }).trim();
  return {
    chainId: await client.getChainId(),
    deploymentStartBlock,
    contracts,
    runtimeCodeHashes,
    liquidity: {
      contracts: liquidityContracts,
      runtimeCodeHashes: liquidityRuntimeCodeHashes,
    },
    protocolCommit,
  };
}

export async function seedLocalBasket({ deployment, rpcUrl, privateKey, basket = {} }) {
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required for local fixture setup and is never persisted.");
  }
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, transport: http(rpcUrl) });
  const basketId = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "basketCount",
  });
  const transaction = buildCreateBasketTransaction(
    {
      name: basket.name ?? "Local Dollar Reserve",
      symbol: basket.symbol ?? "lsUSD",
      assets: basket.assets ?? [deployment.contracts.dollar],
      bundleAmounts: basket.bundleAmounts ?? [parseEther("1")],
      mintFeeTiers: [{ minActionShares: 0n, feeShares: parseEther("0.001") }],
      redemptionFeeTiers: [{ minActionShares: 0n, feeShares: parseEther("0.001") }],
      flashFeeBps: 5,
      originationFeeBps: 100,
      extensionFeeBps: 25,
      ltvBps: 7_500,
      loanDuration: 30 * 24 * 60 * 60,
    },
    parseEther("1")
  );
  await publicClient.call({
    account: account.address,
    to: deployment.contracts.diamond,
    data: transaction.data,
    value: transaction.value,
  });
  const hash = await walletClient.sendTransaction({
    to: deployment.contracts.diamond,
    data: transaction.data,
    value: transaction.value,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Local basket fixture ${hash} reverted.`);
  const nextCount = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "basketCount",
  });
  if (nextCount !== basketId + 1n) {
    throw new Error("Local basket fixture did not increment the authoritative basket count.");
  }
  return { basketId, hash, receipt };
}

export function writeLocalEnvironment(path, deployment, rpcUrl) {
  let current = "";
  try {
    current = readFileSync(path, "utf8");
  } catch {
    // A new ignored local environment file is expected on first use.
  }

  const values = {
    NEXT_PUBLIC_APP_ENV: "development",
    NEXT_PUBLIC_DAPP_PREVIEW: "false",
    NEXT_PUBLIC_APP_NETWORK: "anvil",
    NEXT_PUBLIC_ANVIL_RPC_URL: rpcUrl,
    NEXT_PUBLIC_STATICS_CHAIN_ID: String(deployment.chainId),
    NEXT_PUBLIC_STATICS_DEPLOYMENT_START_BLOCK: String(deployment.deploymentStartBlock),
    NEXT_PUBLIC_STATICS_DIAMOND_ADDRESS: deployment.contracts.diamond,
    NEXT_PUBLIC_STATICS_DOLLAR_CORE_ADDRESS: deployment.contracts.core,
    NEXT_PUBLIC_STATICS_DOLLAR_GATEWAY_ADDRESS: deployment.contracts.gateway,
    NEXT_PUBLIC_STATICS_DOLLAR_TOKEN_ADDRESS: deployment.contracts.dollar,
    NEXT_PUBLIC_STATICS_DOLLAR_RISK_ADDRESS: deployment.contracts.risk,
    NEXT_PUBLIC_STATICS_WETH_ADDRESS: deployment.contracts.weth,
    NEXT_PUBLIC_STATICS_DOLLAR_ORACLE_ADDRESS: deployment.contracts.oracle,
    NEXT_PUBLIC_STATICS_WETH_PROFILE_ID: "1",
    NEXT_PUBLIC_STATICS_PROTOCOL_COMMIT: deployment.protocolCommit,
    NEXT_PUBLIC_STATICS_DIAMOND_CODE_HASH: deployment.runtimeCodeHashes.diamond,
    NEXT_PUBLIC_STATICS_DOLLAR_CORE_CODE_HASH: deployment.runtimeCodeHashes.core,
    NEXT_PUBLIC_STATICS_DOLLAR_GATEWAY_CODE_HASH: deployment.runtimeCodeHashes.gateway,
    NEXT_PUBLIC_STATICS_DOLLAR_TOKEN_CODE_HASH: deployment.runtimeCodeHashes.dollar,
    NEXT_PUBLIC_STATICS_DOLLAR_RISK_CODE_HASH: deployment.runtimeCodeHashes.risk,
    NEXT_PUBLIC_STATICS_WETH_CODE_HASH: deployment.runtimeCodeHashes.weth,
    NEXT_PUBLIC_STATICS_DOLLAR_ORACLE_CODE_HASH: deployment.runtimeCodeHashes.oracle,
    NEXT_PUBLIC_STATICS_POOL_MANAGER_ADDRESS: deployment.liquidity.contracts.poolManager,
    NEXT_PUBLIC_STATICS_POSITION_MANAGER_ADDRESS: deployment.liquidity.contracts.positionManager,
    NEXT_PUBLIC_STATICS_PERMIT2_ADDRESS: deployment.liquidity.contracts.permit2,
    NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_ADDRESS: deployment.liquidity.contracts.swapFeeHook,
    NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_ADDRESS: deployment.liquidity.contracts.liquidityManager,
    NEXT_PUBLIC_STATICS_STATE_VIEW_ADDRESS: deployment.liquidity.contracts.stateView,
    NEXT_PUBLIC_STATICS_POOL_MANAGER_CODE_HASH: deployment.liquidity.runtimeCodeHashes.poolManager,
    NEXT_PUBLIC_STATICS_POSITION_MANAGER_CODE_HASH:
      deployment.liquidity.runtimeCodeHashes.positionManager,
    NEXT_PUBLIC_STATICS_PERMIT2_CODE_HASH: deployment.liquidity.runtimeCodeHashes.permit2,
    NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_CODE_HASH: deployment.liquidity.runtimeCodeHashes.swapFeeHook,
    NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_CODE_HASH:
      deployment.liquidity.runtimeCodeHashes.liquidityManager,
    NEXT_PUBLIC_STATICS_STATE_VIEW_CODE_HASH: deployment.liquidity.runtimeCodeHashes.stateView,
  };

  const lines = current ? current.trimEnd().split("\n") : [];
  for (const [name, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => line.startsWith(`${name}=`));
    const next = `${name}=${value}`;
    if (index === -1) lines.push(next);
    else lines[index] = next;
  }
  writeFileSync(path, `${lines.join("\n")}\n`, { mode: 0o600 });
}

export function defaultProtocolRoot(siteRoot) {
  return resolve(siteRoot, process.env.STATICS_PROTOCOL_REPOSITORY || "../statics");
}
