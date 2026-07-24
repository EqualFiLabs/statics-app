#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { request } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseLocalControlCommand } from "./lib/local-control.mjs";

const siteRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sessionPath = resolve(siteRoot, ".local/connected-session.json");

async function sendCommand(socketPath, command) {
  const body = JSON.stringify(command);
  return new Promise((resolveResponse, reject) => {
    const outgoing = request(
      {
        socketPath,
        path: "/",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let contents = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          contents += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = JSON.parse(contents);
            if (response.statusCode !== 200) {
              reject(new Error(parsed.error || "The local fixture rejected the command."));
              return;
            }
            resolveResponse(parsed);
          } catch {
            reject(new Error("The local fixture returned an invalid response."));
          }
        });
      }
    );
    outgoing.on("error", () => {
      reject(new Error("The connected local fixture is not running."));
    });
    outgoing.end(body);
  });
}

try {
  const command = parseLocalControlCommand(process.argv[2], process.argv.slice(3));
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  const result = await sendCommand(session.socketPath, command);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
