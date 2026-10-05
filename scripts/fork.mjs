#!/usr/bin/env node
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { controlCommand } from "./fork/controls.mjs";
import { callSession, launch } from "./fork/launcher.mjs";
import { json, loadConfig, parseOptions, profilePath, redact } from "./fork/profile.mjs";

try {
  const [action, ...args] = process.argv.slice(2),
    { options, positional } = parseOptions(args);
  if (action !== "start" && Object.keys(options).some((key) => key !== "profile"))
    throw new Error("Snapshot and port options are only accepted by dev:fork.");
  if (action === "start") {
    if (positional.length) throw new Error(`Unknown startup option ${positional[0]}.`);
    await launch(options, loadConfig());
  } else {
    const path = profilePath(options.profile);
    if (action === "test") {
      const { testFork } = await import("./fork/testing.mjs");
      await testFork(options, loadConfig(), positional);
    } else {
      if (!existsSync(resolve(path, "profile.json")))
        throw new Error("Profile does not exist; run dev:fork first.");
      const profile = json(resolve(path, "profile.json"));
      if (["status", "stop", "verify"].includes(action) && positional.length)
        throw new Error(`${action} does not accept positional arguments.`);
      if (action === "verify") {
        const { verifyFork } = await import("./fork/verify.mjs");
        await verifyFork(profile, path);
      } else if (action === "status" || action === "stop")
        console.log(
          JSON.stringify(
            profile.owner
              ? await callSession(profile, action)
              : { profile: profile.profile, status: profile.status, snapshot: profile.snapshot },
            null,
            2
          )
        );
      else
        console.log(
          JSON.stringify(
            await callSession(profile, "mutate", controlCommand(action, positional)),
            null,
            2
          )
        );
    }
  }
} catch (error) {
  console.error(redact(error.message));
  process.exitCode = 1;
}
