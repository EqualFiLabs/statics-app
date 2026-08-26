#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { request } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseLaunchForkControl } from "./lib/launch-fork-control.mjs";

const siteRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sessionPath = resolve(siteRoot, ".local/launch-fork/session.json");
const socketPath = resolve(siteRoot, ".local/launch-fork/control.sock");

function send(socketPath, command) {
  const body = JSON.stringify(command);
  return new Promise((resolveResponse, reject) => {
    const outgoing = request(
      {
        socketPath,
        path: "/",
        method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) },
      },
      (response) => {
        let contents = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (contents += chunk));
        response.on("end", () => {
          try {
            const parsed = JSON.parse(contents);
            if (response.statusCode !== 200)
              return reject(new Error(parsed.error || "Command rejected."));
            resolveResponse(parsed);
          } catch {
            reject(new Error("The launch fork returned an invalid response."));
          }
        });
      }
    );
    outgoing.on("error", () => reject(new Error("The launch fork is not running.")));
    outgoing.end(body);
  });
}

try {
  const command = parseLaunchForkControl(process.argv[2], process.argv.slice(3));
  JSON.parse(readFileSync(sessionPath, "utf8"));
  const result = await send(socketPath, command);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Launch fork command failed."}\n`
  );
  process.exitCode = 1;
}
