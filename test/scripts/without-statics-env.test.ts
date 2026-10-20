import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";

import { readWalletEnvironment } from "@/lib/wallet-config";

it("isolates the browser fixture build from a configured chain-4663 fork", () => {
  const result = spawnSync(
    process.execPath,
    [
      resolve("scripts/without-statics-env.mjs"),
      process.execPath,
      "-e",
      'process.stdout.write(JSON.stringify(Object.fromEntries(["NEXT_PUBLIC_APP_ENV", "NEXT_PUBLIC_APP_NETWORK", "NEXT_PUBLIC_ANVIL_CHAIN_ID", "NEXT_PUBLIC_ANVIL_RPC_URL"].map(key => [key, process.env[key]]))))',
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_NETWORK: "anvil",
        NEXT_PUBLIC_ANVIL_CHAIN_ID: "4663",
        NEXT_PUBLIC_ANVIL_RPC_URL: "http://127.0.0.1:8663",
      },
    }
  );
  expect(result.status).toBe(0);
  const environment = readWalletEnvironment(JSON.parse(result.stdout));
  expect(environment.defaultChain.id).toBe(46_630);
  expect(environment.anvilChain.id).toBe(31_337);
  expect(environment.anvilRpcUrl).toBe("http://127.0.0.1:8545/");
});
