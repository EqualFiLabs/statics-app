import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const appRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const protocolCommit = "ec73b2c3e1919b79a01726001d78bf666279c59d";
export const sdkCommit = "6770d0caef5b94b8f102d2a33534970fb31b681e";
export const mnemonic = "test test test test test test test test test test test junk";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const json = (path) => JSON.parse(readFileSync(path, "utf8"));
export const digest = (value) => createHash("sha256").update(value).digest("hex");
export function save(path, value) {
  mkdirSync(resolve(path, ".."), { recursive: true, mode: 0o700 });
  writeFileSync(`${path}.partial`, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  renameSync(`${path}.partial`, path);
}
export function redact(value, secrets = []) {
  let output = String(value).replace(/https?:\/\/[^\s"'<>]+/g, "[URL redacted]");
  for (const secret of secrets.filter(Boolean)) output = output.split(secret).join("[redacted]");
  return output.replace(/0x[a-fA-F0-9]{64}/g, (match) =>
    secrets.includes(match) ? "[redacted]" : match
  );
}
export function childEnvironment(environment = process.env) {
  // Allowlist avoids forwarding credentials, dotenv files or public production configuration.
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) =>
      /^(PATH|HOME|USER|LOGNAME|SHELL|TMPDIR|TEMP|TMP|SystemRoot|LANG|LC_.*|TERM|CI|NODE_EXTRA_CA_CERTS)$/.test(
        key
      )
    )
  );
}
export function loadConfig(environment = process.env, root = appRoot) {
  const result = {};
  const path = resolve(root, ".env.fork.local");
  if (existsSync(path))
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      const match = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
      if (!match)
        throw new Error("Invalid .env.fork.local entry; use NAME=value without shell expressions.");
      result[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  return { ...result, ...environment };
}
export function parseOptions(args) {
  const options = { profile: "dev" },
    positional = [];
  const seen = new Set();
  const names = {
    "--profile": "profile",
    "--snapshot": "snapshot",
    "--rpc-port": "rpcPort",
    "--indexer-port": "indexerPort",
    "--app-port": "appPort",
  };
  for (let i = 0; i < args.length; i++) {
    const key = names[args[i]];
    if (!key) {
      positional.push(args[i]);
      continue;
    }
    if (seen.has(key)) throw new Error(`Duplicate ${args[i]}.`);
    seen.add(key);
    if (
      !args[i + 1] ||
      args[i + 1].startsWith("--") ||
      (Object.hasOwn(options, key) && key !== "profile")
    )
      throw new Error(`Invalid or duplicate ${args[i]}.`);
    options[key] = args[++i];
  }
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(options.profile))
    throw new Error("Profile must use lowercase letters, digits and hyphens (max 32 characters).");
  for (const name of ["rpcPort", "indexerPort", "appPort"])
    if (options[name] !== undefined) {
      if (
        !/^\d+$/.test(options[name]) ||
        Number(options[name]) < 1024 ||
        Number(options[name]) > 65535
      )
        throw new Error(`${name} must be a port from 1024 through 65535.`);
      options[name] = Number(options[name]);
    }
  if (options.snapshot !== undefined && !/^\d+$/.test(options.snapshot))
    throw new Error("--snapshot must be a block number.");
  return { options, positional };
}
export function profilePath(profile, root = appRoot) {
  return resolve(root, ".local/fork", profile);
}
export function provenance(protocol, root = appRoot) {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: protocol,
    encoding: "utf8",
  }).trim();
  if (revision !== protocolCommit)
    throw new Error(`Protocol checkout must be at ${protocolCommit}; no branch was changed.`);
  for (const path of [
    "script/DeployStaticsPhaseOne.s.sol",
    "script/DeployStaticsPermissionedPeriphery.s.sol",
    "script/ConfigureStaticsPhaseOneLiquidity.s.sol",
    "lib/forge-std/src/Script.sol",
    "lib/openzeppelin-contracts/contracts/governance/TimelockController.sol",
  ]) {
    if (!existsSync(resolve(protocol, path)))
      throw new Error(
        `Missing protocol source/submodule ${path}; initialize dependencies manually.`
      );
  }
  const changed = execFileSync(
    "git",
    ["diff", "HEAD", "--", "src", "script", "lib", "foundry.toml"],
    { cwd: protocol, encoding: "utf8" }
  );
  if (changed)
    throw new Error(
      "Protocol deployment sources differ from the compatibility revision; preserve your work and use a compatible checkout."
    );
  const sdk = json(resolve(root, "vendor/statics-sdk/provenance.json"));
  if (sdk.phaseOneSource?.commit !== sdkCommit)
    throw new Error("Vendored SDK is incompatible; do not synchronize it automatically.");
  return {
    protocol: revision,
    sdk,
    sdkDigest: digest(readFileSync(resolve(root, "vendor/statics-sdk/provenance.json"))),
  };
}
export function newProfile(options, environment, source) {
  if (!environment.STATICS_PROTOCOL_REPOSITORY || !environment.NEXT_PUBLIC_PRIVY_APP_ID)
    throw new Error(
      "Set STATICS_PROTOCOL_REPOSITORY and maintainer-provided NEXT_PUBLIC_PRIVY_APP_ID."
    );
  const ports = {
    rpc: options.rpcPort ?? 8663,
    indexer: options.indexerPort ?? 42070,
    app: options.appPort ?? 3000,
  };
  if (new Set(Object.values(ports)).size !== 3)
    throw new Error("Component ports must be distinct.");
  return {
    schemaVersion: 1,
    id: randomUUID(),
    profile: options.profile,
    chainId: 4663,
    ports,
    protocolRepository: resolve(environment.STATICS_PROTOCOL_REPOSITORY),
    provenance: source,
    privy: {
      appId: environment.NEXT_PUBLIC_PRIVY_APP_ID,
      clientId: environment.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? null,
    },
    stages: {},
    receipts: [],
    status: "created",
    createdAt: new Date().toISOString(),
  };
}
export function compatible(profile, options, environment, source) {
  if (
    profile.schemaVersion !== 1 ||
    profile.chainId !== 4663 ||
    profile.provenance.protocol !== source.protocol ||
    profile.provenance.sdkDigest !== source.sdkDigest
  )
    throw new Error("Incompatible saved profile; preserve it and create a new profile.");
  for (const [option, port] of [
    ["rpcPort", "rpc"],
    ["indexerPort", "indexer"],
    ["appPort", "app"],
  ])
    if (options[option] !== undefined && options[option] !== profile.ports[port])
      throw new Error(`Saved profile conflicts with ${option}.`);
  if (options.snapshot !== undefined && options.snapshot !== profile.snapshot?.number)
    throw new Error("Saved profile conflicts with --snapshot.");
  if (
    environment.STATICS_PROTOCOL_REPOSITORY &&
    resolve(environment.STATICS_PROTOCOL_REPOSITORY) !== profile.protocolRepository
  )
    throw new Error("Saved profile uses a different protocol checkout.");
  for (const [name, value] of [
    ["NEXT_PUBLIC_PRIVY_APP_ID", profile.privy.appId],
    ["NEXT_PUBLIC_PRIVY_CLIENT_ID", profile.privy.clientId],
  ])
    if (environment[name] && environment[name] !== value)
      throw new Error(`Saved profile conflicts with ${name}.`);
  if (profile.controlMutation)
    throw new Error(
      "Uncertain local control: preserve receipts and state; inspect the transaction outcome before recovery. Nothing was repeated."
    );
  const uncertain = Object.entries(profile.stages).find(([, stage]) => stage.status === "started");
  if (uncertain)
    throw new Error(
      `Uncertain ${uncertain[0]} stage. Preserve state, receipts and Forge broadcasts in this profile. Inspect its transactions before recovery; use a new profile for a fresh deployment. Nothing was repeated.`
    );
}
export async function requirePort(port) {
  const server = createServer();
  await new Promise((r, reject) => {
    server.once("error", () =>
      reject(new Error(`Port ${port} is occupied; no process was stopped.`))
    );
    server.listen(port, "127.0.0.1", r);
  });
  await new Promise((r) => server.close(r));
}
export async function rpc(url, method, params = []) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new Error(`RPC transport failed for ${method}.`);
  }
  if (!response.ok) throw new Error(`RPC HTTP ${response.status} for ${method}.`);
  const body = await response.json();
  if (body.error) throw new Error(`RPC ${method}: ${redact(body.error.message)}`);
  return body.result;
}
export function urls(profile) {
  return {
    rpc: `http://127.0.0.1:${profile.ports.rpc}`,
    indexer: `http://127.0.0.1:${profile.ports.indexer}`,
    app: `http://localhost:${profile.ports.app}`,
  };
}
export async function verifyAnvil(profile, url = urls(profile).rpc) {
  const endpoint = new URL(url);
  if (
    endpoint.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname) ||
    Number(endpoint.port) !== profile.ports.rpc
  )
    throw new Error("Mutation endpoint must be the recorded loopback Anvil.");
  const [version, chain, anchor, info] = await Promise.all([
    rpc(url, "web3_clientVersion"),
    rpc(url, "eth_chainId"),
    rpc(url, "eth_getBlockByNumber", [`0x${BigInt(profile.snapshot.number).toString(16)}`, false]),
    rpc(url, "anvil_nodeInfo"),
  ]);
  if (
    !/anvil/i.test(version) ||
    Number(BigInt(chain)) !== profile.chainId ||
    anchor?.hash !== profile.snapshot.hash ||
    Number(info?.forkConfig?.forkBlockNumber) !== Number(profile.snapshot.number)
  )
    throw new Error("Anvil chain/snapshot identity does not match the owned profile.");
  if (profile.identityMarker) {
    const code = await rpc(url, "eth_getCode", [profile.identityMarker.address, "latest"]);
    if (code !== profile.identityMarker.code)
      throw new Error("Anvil belongs to a different profile.");
  }
}
