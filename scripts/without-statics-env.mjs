import { spawnSync } from "node:child_process";

for (const key of Object.keys(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_STATICS_")) delete process.env[key];
}

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A command is required.");
const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
