import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const configuredKeys = [...template.matchAll(/^(NEXT_PUBLIC_STATICS_[A-Z0-9_]+)=/gm)].map(
  (match) => match[1]
);
for (const key of new Set([...Object.keys(process.env), ...configuredKeys])) {
  // An empty process value prevents Next from reloading a developer-specific
  // value from an ignored .env.local file during the isolated build.
  if (key.startsWith("NEXT_PUBLIC_STATICS_")) process.env[key] = "";
}
process.env.NEXT_PUBLIC_APP_ENV = "development";
process.env.NEXT_PUBLIC_APP_NETWORK = "robinhood-testnet";

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A command is required.");
const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
