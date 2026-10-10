import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const toolingRoot = fileURLToPath(new URL(".", import.meta.url));
const applicationRoot = process.env.STATICS_FORK_APP_ROOT ?? toolingRoot;

export default defineConfig({
  root: toolingRoot,
  resolve: {
    alias: [
      {
        find: /^@statics-protocol\/sdk$/,
        replacement: resolve(applicationRoot, "vendor/statics-sdk/dist/index.js"),
      },
      {
        find: /^@statics-protocol\/sdk\/phase-one$/,
        replacement: resolve(applicationRoot, "vendor/statics-sdk/dist/phase-one/index.js"),
      },
      {
        find: /^@statics-protocol\/sdk\/genesis-credit$/,
        replacement: resolve(applicationRoot, "vendor/statics-sdk/dist/genesis-credit.js"),
      },
      { find: "@", replacement: applicationRoot },
    ],
  },
  test: {
    environment: "node",
    include: ["test/integration/phase-one-fork.ts"],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
