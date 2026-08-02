#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importPublicPrivyConfig, requirePublicPrivySource } from "./lib/local-privy.mjs";

const siteRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourcePath = resolve(siteRoot, requirePublicPrivySource(process.env.EVES_MARKET_ENV_PATH));
const targetPath = resolve(siteRoot, ".env.local");

try {
  const result = importPublicPrivyConfig({ sourcePath, targetPath });
  process.stdout.write(
    `Imported ${result.importedNames.join(", ")} into the ignored local environment.\n`
  );
} catch (error) {
  process.stderr.write(`Unable to import public Privy configuration: ${error.message}\n`);
  process.exitCode = 1;
}
