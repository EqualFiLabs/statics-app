import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { appRoot, childEnvironment, json, profilePath, save, sleep, urls } from "./profile.mjs";
import { callSession } from "./launcher.mjs";
import { browserChecks } from "./verify.mjs";
import { run, stopChild } from "./processes.mjs";
async function freePort() {
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  await new Promise((r) => server.close(r));
  return port;
}
export async function testFork(options, environment, args) {
  if (args.length) throw new Error("test:fork accepts only --profile.");
  const selectedFile = resolve(profilePath(options.profile), "profile.json");
  const selected = existsSync(selectedFile) ? json(selectedFile) : null;
  environment = {
    ...environment,
    STATICS_PROTOCOL_REPOSITORY:
      environment.STATICS_PROTOCOL_REPOSITORY ?? selected?.protocolRepository,
    NEXT_PUBLIC_PRIVY_APP_ID: environment.NEXT_PUBLIC_PRIVY_APP_ID ?? selected?.privy.appId,
    NEXT_PUBLIC_PRIVY_CLIENT_ID:
      environment.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? selected?.privy.clientId,
  };
  // The selected interactive profile is never mutated or copied.
  const name = `test-${options.profile.slice(0, 12)}-${Date.now().toString(36)}`,
    path = profilePath(name),
    ports = [await freePort(), await freePort(), await freePort()];
  const supervisor = spawn(
    process.execPath,
    [
      resolve(appRoot, "scripts/fork.mjs"),
      "start",
      "--profile",
      name,
      "--rpc-port",
      String(ports[0]),
      "--indexer-port",
      String(ports[1]),
      "--app-port",
      String(ports[2]),
    ],
    { cwd: appRoot, env: environment, stdio: "inherit" }
  );
  let profile;
  try {
    for (let attempt = 0; attempt < 5400; attempt++) {
      if (supervisor.exitCode !== null)
        throw new Error("Isolated test profile failed during startup; artifacts preserved.");
      if (existsSync(resolve(path, "profile.json"))) {
        profile = json(resolve(path, "profile.json"));
        if (profile.status === "ready") break;
      }
      await sleep(1000);
    }
    if (profile?.status !== "ready") throw new Error("Isolated test profile did not become ready.");
    await callSession(profile, "status");
    const children = new Set();
    await run(
      process.execPath,
      [
        resolve(appRoot, "node_modules/vitest/vitest.mjs"),
        "run",
        "--config",
        "vitest.phase-one-fork.config.ts",
        "--reporter=json",
        "--outputFile",
        resolve(path, "lifecycle-results.json"),
      ],
      {
        cwd: appRoot,
        env: {
          ...childEnvironment(),
          STATICS_FORK_ROOT: path,
          STATICS_FORK_RPC_URL: urls(profile).rpc,
          STATICS_FORK_INDEXER_URL: urls(profile).indexer,
          STATICS_FORK_PROFILE_ID: profile.id,
        },
        log: resolve(path, "lifecycle.log"),
        children,
      }
    );
    await browserChecks(profile, path);
    save(resolve(path, "test-results.json"), {
      profile: name,
      lifecycle: "completed; inspect lifecycle-results.json for skips",
      browserChecks: 3,
      manualSigning: "not executed",
    });
    console.log(`Isolated tests completed; artifacts: ${path}`);
  } finally {
    if (profile?.owner)
      try {
        await callSession(profile, "stop");
      } catch {
        /* owned supervisor below */
      }
    await stopChild(supervisor);
  }
}
