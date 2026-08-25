import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { getAddress, keccak256 } from "viem";
import { v4PoolId } from "@statics-protocol/sdk";

const outputLabels = {
  statics: "STATICS_TOKEN_ADDRESS",
  genesis: "STATICS_GENESIS_NFT_ADDRESS",
  vault: "STATICS_GENESIS_VAULT_ADDRESS",
  activationRegistry: "STATICS_GENESIS_ACTIVATION_REGISTRY_ADDRESS",
  feeReceiver: "STATICS_FEE_RECEIVER_ADDRESS",
  launchDistributor: "STATICS_GENESIS_DISTRIBUTOR_ADDRESS",
};

const dependencyNames = [
  "weth",
  "poolManager",
  "stateView",
  "quoter",
  "universalRouter",
  "permit2",
];
const execFileAsync = promisify(execFile);
export const LAUNCH_FORK_DEFAULT_BLOCK = 14_498_238;
export const LAUNCH_FORK_DEFAULT_BLOCK_HASH =
  "0x6aa5df55371aa944352e06703b7905fb0ddf3a58c495833ee7595ef08aa46417";

function requiredAddress(output, label) {
  const match = output.match(new RegExp(`${label}\\s+(0x[a-fA-F0-9]{40})`));
  if (!match) throw new Error(`Forge output did not include ${label}.`);
  return getAddress(match[1]);
}

function requiredPoolId(output) {
  const match = output.match(/STATICS_DOPPLER_POOL_ID\s+(0x[a-fA-F0-9]{64})/u);
  if (!match) throw new Error("Forge output did not include STATICS_DOPPLER_POOL_ID.");
  return match[1].toLowerCase();
}

async function contract(address, publicClient) {
  const code = await publicClient.getCode({ address });
  if (!code || code === "0x") throw new Error(`${address} has no runtime code on the local fork.`);
  return { address, runtimeCodeHash: keccak256(code) };
}

export function readRobinhoodDependencies(protocolRoot) {
  const path = resolve(protocolRoot, "deployments/robinhood-chain-4663.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.chainId !== 4_663) {
    throw new Error("The protocol dependency manifest is not Robinhood mainnet.");
  }
  if (!Number.isSafeInteger(manifest.forkBlock) || manifest.forkBlock <= 0) {
    throw new Error("The Robinhood dependency manifest is missing a pinned fork block.");
  }
  if (!/^0x[a-fA-F0-9]{64}$/u.test(manifest.forkBlockHash)) {
    throw new Error("The Robinhood dependency manifest is missing a pinned fork block hash.");
  }
  const contracts = Object.fromEntries(
    dependencyNames.map((name) => {
      const address = manifest.contracts?.[name]?.address;
      if (!address) throw new Error(`The Robinhood dependency manifest is missing ${name}.`);
      return [name, getAddress(address)];
    })
  );
  return {
    contracts,
    forkBlock: manifest.forkBlock,
    forkBlockHash: manifest.forkBlockHash.toLowerCase(),
  };
}

export async function deployLaunchFork({ protocolRoot, rpcUrl, privateKey, publicClient, salt }) {
  const dependencyManifest = readRobinhoodDependencies(protocolRoot);
  const dependencies = dependencyManifest.contracts;
  const deploymentStartBlock = (await publicClient.getBlockNumber()) + 1n;
  const fee = 30_000;
  const { stdout: output } = await execFileAsync(
    "forge",
    [
      "script",
      "script/DeployStaticsGenesisLocalFork.s.sol:DeployStaticsGenesisLocalFork",
      "--sig",
      "runLocalFork()",
      "--broadcast",
      "--skip-simulation",
      "--non-interactive",
      "--rpc-url",
      rpcUrl,
    ],
    {
      cwd: protocolRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PRIVATE_KEY: privateKey,
        WETH_ADDRESS: dependencies.weth,
        STATICS_DOPPLER_SALT: salt,
        STATICS_DOPPLER_FEE: String(fee),
        STATICS_GENESIS_REWARD_SHARE_BPS: "5000",
        ETH_RPC_TIMEOUT: process.env.ETH_RPC_TIMEOUT?.trim() || "300",
      },
      maxBuffer: 32 * 1024 * 1024,
    }
  );

  const addresses = Object.fromEntries(
    Object.entries(outputLabels).map(([name, label]) => [name, requiredAddress(output, label)])
  );
  const initializer = requiredAddress(output, "STATICS_DOPPLER_POOL_INITIALIZER_ADDRESS");
  const poolId = requiredPoolId(output);
  const protocolCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: protocolRoot,
    encoding: "utf8",
  }).trim();
  const contracts = {};
  for (const [name, address] of Object.entries({ ...addresses, ...dependencies })) {
    contracts[name] = await contract(address, publicClient);
  }
  const [currency0, currency1] =
    addresses.statics.toLowerCase() < dependencies.weth.toLowerCase()
      ? [addresses.statics, dependencies.weth]
      : [dependencies.weth, addresses.statics];
  const poolKey = { currency0, currency1, fee, tickSpacing: 100, hooks: initializer };
  if (v4PoolId(poolKey).toLowerCase() !== poolId) {
    throw new Error("The deployed PoolId does not match its canonical PoolKey.");
  }

  return {
    manifest: {
      schemaVersion: 1,
      deploymentId: "local-anvil-genesis",
      network: "Local Anvil",
      chainId: 31_337,
      deploymentStartBlock: deploymentStartBlock.toString(),
      protocolCommit,
      sourceRepository: "https://github.com/EqualFiLabs/statics",
      dependencyManifest: {
        forkBlock: dependencyManifest.forkBlock.toString(),
        forkBlockHash: dependencyManifest.forkBlockHash,
      },
      reproducibleFork: {
        block: LAUNCH_FORK_DEFAULT_BLOCK.toString(),
        blockHash: LAUNCH_FORK_DEFAULT_BLOCK_HASH,
      },
      contracts,
      market: { poolId, poolKey },
    },
    operator: addresses,
  };
}

export async function startRpcRelay(upstream) {
  const parsed = new URL(upstream);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("ROBINHOOD_MAINNET must be an HTTP(S) RPC URL.");
  }
  const server = createServer((request, response) => {
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) request.destroy();
    });
    request.on("end", () => {
      const startedAt = Date.now();
      let method = "unknown";
      if (process.env.LAUNCH_FORK_RPC_DEBUG === "1") {
        try {
          method = JSON.parse(body)?.method || "batch";
        } catch {
          method = "invalid";
        }
        process.stderr.write(`[launch-fork rpc] ${method}\n`);
        if (method === "eth_getLogs") process.stderr.write(`${body}\n`);
      }
      void fetch(parsed, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      })
        .then(async (upstreamResponse) => {
          const contents = await upstreamResponse.text();
          if (process.env.LAUNCH_FORK_RPC_DEBUG === "1") {
            process.stderr.write(`[launch-fork rpc] ${method} ${Date.now() - startedAt}ms\n`);
          }
          response.writeHead(upstreamResponse.status, { "content-type": "application/json" });
          response.end(contents);
        })
        .catch(() => response.writeHead(502).end());
    });
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("RPC relay did not bind a TCP port.");
  return { server, url: `http://127.0.0.1:${address.port}` };
}
