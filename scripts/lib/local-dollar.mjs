import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, http, keccak256 } from "viem";

const labels = {
  core: "STATICS_DOLLAR_CORE_ADDRESS",
  diamond: "STATICS_DIAMOND_ADDRESS",
  dollar: "STATICS_DOLLAR_TOKEN_ADDRESS",
  risk: "STATICS_DOLLAR_RISK_TOKEN_ADDRESS",
  gateway: "STATICS_DOLLAR_GATEWAY_ADDRESS",
  weth: "WETH_ADDRESS",
  oracle: "STATICS_DOLLAR_ORACLE_ADDRESS",
};

export async function deployLocalDollar({ protocolRoot, rpcUrl, privateKey, quiet = false }) {
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required for local deployment and is never persisted.");
  }
  const output = execFileSync(
    "forge",
    [
      "script",
      "script/dollar/DeployStaticsDollar.s.sol:DeployStaticsDollar",
      "--sig",
      "runLocal()",
      "--broadcast",
      "--slow",
      "--rpc-url",
      rpcUrl,
    ],
    {
      cwd: protocolRoot,
      encoding: "utf8",
      env: { ...process.env, PRIVATE_KEY: privateKey },
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

  const client = createPublicClient({ transport: http(rpcUrl) });
  const runtimeCodeHashes = {};
  for (const [name, address] of Object.entries(contracts)) {
    const code = await client.getCode({ address });
    if (!code || code === "0x") throw new Error(`${name} has no runtime code after deployment.`);
    runtimeCodeHashes[name] = keccak256(code);
  }

  const protocolCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: protocolRoot,
    encoding: "utf8",
  }).trim();
  return { chainId: await client.getChainId(), contracts, runtimeCodeHashes, protocolCommit };
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
    NEXT_PUBLIC_APP_NETWORK: "anvil",
    NEXT_PUBLIC_ANVIL_RPC_URL: rpcUrl,
    NEXT_PUBLIC_STATICS_CHAIN_ID: String(deployment.chainId),
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
