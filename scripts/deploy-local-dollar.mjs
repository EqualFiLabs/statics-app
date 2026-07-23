import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  defaultProtocolRoot,
  deployLocalDollar,
  writeLocalEnvironment,
} from "./lib/local-dollar.mjs";

const siteRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const rpcUrl = process.env.NEXT_PUBLIC_ANVIL_RPC_URL || "http://127.0.0.1:8545";
const deployment = await deployLocalDollar({
  protocolRoot: defaultProtocolRoot(siteRoot),
  rpcUrl,
  privateKey: process.env.PRIVATE_KEY,
});

if (deployment.chainId !== 31_337) {
  throw new Error(`Refusing to write local deployment state for chain ${deployment.chainId}.`);
}

writeLocalEnvironment(resolve(siteRoot, ".env.local"), deployment, rpcUrl);
console.log("Wrote public Anvil deployment addresses and code hashes to ignored .env.local.");
