import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { appRoot, childEnvironment, digest, json, save, sleep, urls } from "./profile.mjs";
import { transactionContext } from "./deploy.mjs";
import { ownedProcess, waitHttp } from "./processes.mjs";

export async function manifests(profile, path) {
  const launch = {
    ...json(resolve(appRoot, "deployments/robinhood-genesis.json")),
    deploymentId: "local-anvil-genesis",
    network: "Robinhood mainnet fork",
    deploymentStartBlock: profile.snapshot.number,
  };
  const deps = json(
    resolve(profile.protocolRepository, "deployments/robinhood-chain-4663.json")
  ).contracts;
  const contracts = {};
  for (const [name, key] of [
    ["diamond", "STATICS_DIAMOND_ADDRESS"],
    ["timelock", "STATICS_TIMELOCK_ADDRESS"],
    ["publicHook", "STATICS_SWAP_FEE_HOOK_ADDRESS"],
    ["liquidityManager", "STATICS_LIQUIDITY_MANAGER_ADDRESS"],
  ])
    contracts[name] = { address: profile.addresses[key] };
  contracts.statics = launch.contracts.statics;
  contracts.weth = launch.contracts.weth;
  for (const name of [
    "poolManager",
    "positionManager",
    "permit2",
    "quoter",
    "stateView",
    "universalRouter",
  ])
    contracts[name] = { address: deps[name].address };
  const { client } = transactionContext(profile);
  async function metadata(address) {
    const { parseAbi } = await import("viem");
    const abi = parseAbi([
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
    ]);
    const [name, symbol, decimals] = await Promise.all(
      ["name", "symbol", "decimals"].map((functionName) =>
        client.readContract({ address, abi, functionName })
      )
    );
    return { address, name, symbol, decimals };
  }
  const phaseOne = {
    schemaVersion: 1,
    deploymentId: "local-anvil-phase-one",
    network: "Robinhood mainnet fork",
    chainId: 4663,
    deploymentStartBlock: profile.phaseOneStartBlock,
    protocolCommit: profile.provenance.protocol,
    sdkCommit: profile.provenance.sdk.phaseOneSource.commit,
    installedPhase: 1,
    contracts,
    supportedPools: [
      {
        ...profile.pool,
        token0: await metadata(profile.pool.poolKey.currency0),
        token1: await metadata(profile.pool.poolKey.currency1),
        enabled: true,
      },
    ],
  };
  // Rehearsal filenames remain usable by the integration suite.
  save(resolve(path, "manifest.json"), phaseOne);
  save(resolve(path, "cleanup-launch-manifest.json"), launch);
  return { launch, phaseOne };
}
export function indexerFingerprint(root = resolve(appRoot, "ponder")) {
  return ["ponder.config.ts", "ponder.schema.ts", "package-lock.json"]
    .map((file) => digest(readFileSync(resolve(root, file))))
    .join(":");
}
export async function startIndexer(profile, path, historyUrl, children) {
  const { launch, phaseOne } = await manifests(profile, path),
    c = phaseOne.contracts,
    g = launch.contracts;
  const origin = urls(profile).app;
  // Include handler sources, not just the schema, when deciding to replay.
  const { readdirSync } = await import("node:fs");
  function files(dir) {
    return readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? files(resolve(dir, e.name)) : [resolve(dir, e.name)]))
      .sort();
  }
  const sourceDigest = digest(
    [
      indexerFingerprint(),
      ...files(resolve(appRoot, "ponder/src")).map((file) => digest(readFileSync(file))),
    ].join("\n")
  );
  if (profile.indexer?.sourceDigest !== sourceDigest) {
    profile.indexer = {
      sourceDigest,
      database: resolve(path, `database-${Date.now()}`),
      project: resolve(path, `ponder-${Date.now()}`),
    };
    save(resolve(path, "profile.json"), profile);
  }
  const { database, project } = profile.indexer;
  mkdirSync(project, { recursive: true });
  if (!existsSync(resolve(project, "node_modules")))
    symlinkSync(resolve(appRoot, "ponder/node_modules"), resolve(project, "node_modules"), "dir");
  for (const entry of [
    "package.json",
    "ponder.config.ts",
    "ponder.schema.ts",
    "src",
    "tsconfig.json",
  ])
    cpSync(resolve(appRoot, "ponder", entry), resolve(project, entry), { recursive: true });
  writeFileSync(resolve(project, ".env.local"), "", { mode: 0o600 });
  const configPath = resolve(project, "ponder.config.ts");
  writeFileSync(
    configPath,
    readFileSync(configPath, "utf8").replace(
      "pollingInterval: chainId === 4_663 ? 2_000 : undefined,",
      "pollingInterval: chainId === 4_663 ? 2_000 : undefined,\n      ethGetLogsBlockRange: 1_000_000,"
    )
  );
  const genesisStart = json(
    resolve(appRoot, "deployments/robinhood-genesis.json")
  ).deploymentStartBlock;
  const env = {
    ...childEnvironment(),
    DATABASE_URL: "",
    DATABASE_PRIVATE_URL: "",
    PONDER_DATABASE_DIRECTORY: database,
    PONDER_CHAIN_ID: "4663",
    PONDER_RPC_URL_4663: historyUrl,
    PONDER_DEPLOYMENT_ID: launch.deploymentId,
    PONDER_PHASE_ONE_DEPLOYMENT_ID: phaseOne.deploymentId,
    PONDER_DEPLOYMENT_START_BLOCK: phaseOne.deploymentStartBlock,
    PONDER_PHASE_ONE_START_BLOCK: phaseOne.deploymentStartBlock,
    PONDER_STATICS_DIAMOND_ADDRESS: c.diamond.address,
    PONDER_PUBLIC_HOOK_ADDRESS: c.publicHook.address,
    PONDER_POSITION_MANAGER_ADDRESS: c.positionManager.address,
    PONDER_POOL_MANAGER_ADDRESS: c.poolManager.address,
    PONDER_CANONICAL_POOL_ID: launch.market.poolId,
    PONDER_STATICS_GENESIS_ADDRESS: g.genesis.address,
    PONDER_GENESIS_VAULT_ADDRESS: g.vault.address,
    PONDER_GENESIS_ACTIVATION_REGISTRY_ADDRESS: g.activationRegistry.address,
    PONDER_GENESIS_LAUNCH_DISTRIBUTOR_ADDRESS: g.launchDistributor.address,
    PONDER_STATICS_FEE_RECEIVER_ADDRESS: g.feeReceiver.address,
    PONDER_POOL_MANAGER_START_BLOCK: profile.snapshot.number,
    PONDER_STATICS_GENESIS_START_BLOCK: genesisStart,
    PONDER_GENESIS_VAULT_START_BLOCK: genesisStart,
    PONDER_GENESIS_ACTIVATION_START_BLOCK: genesisStart,
    PONDER_GENESIS_DISTRIBUTOR_START_BLOCK: genesisStart,
    PONDER_STATICS_FEE_RECEIVER_START_BLOCK: genesisStart,
    PONDER_ALLOWED_ORIGIN: origin,
  };
  const child = ownedProcess(
    resolve(appRoot, "ponder/node_modules/.bin/ponder"),
    ["dev", "--hostname", "127.0.0.1", "--port", String(profile.ports.indexer), "--disable-ui"],
    { cwd: project, env, log: resolve(path, "ponder.log"), children }
  );
  await waitHttp(`${urls(profile).indexer}/ready`, child, 3600);
  const { client } = transactionContext(profile);
  for (let attempt = 0; attempt < 3600; attempt++) {
    if (child.exitCode !== null) throw new Error("Indexer exited during catch-up.");
    const status = await fetch(`${urls(profile).indexer}/status`).then((r) => r.json());
    const indexed = BigInt(status.active?.block?.number ?? 0),
      head = await client.getBlockNumber();
    if (attempt % 15 === 0) console.log(`Backfill block ${indexed} / ${head}`);
    if (indexed >= BigInt(profile.phaseOneStartBlock) && head - indexed <= 10n)
      return { child, launch, phaseOne };
    await sleep(1000);
  }
  throw new Error("Indexer has not caught up; preserve the profile and inspect ponder.log.");
}
export async function startApp(profile, path, launch, phaseOne, children) {
  const local = urls(profile);
  // Next loads dotenv files from its cwd. A profile-owned source copy avoids
  // inheriting credentials or writing generated files in the contributor checkout.
  const project = resolve(path, `app-${Date.now()}`);
  mkdirSync(project, { recursive: true });
  for (const entry of [
    "app",
    "components",
    "deployments",
    "hooks",
    "i18n",
    "lib",
    "messages",
    "providers",
    "next.config.ts",
    "next-env.d.ts",
    "proxy.ts",
    "tsconfig.json",
    "package.json",
    "package-lock.json",
  ]) {
    cpSync(resolve(appRoot, entry), resolve(project, entry), { recursive: true });
  }
  symlinkSync(resolve(appRoot, "node_modules"), resolve(project, "node_modules"), "dir");
  symlinkSync(resolve(appRoot, "public"), resolve(project, "public"), "dir");
  symlinkSync(resolve(appRoot, "vendor"), resolve(project, "vendor"), "dir");
  profile.appProject = project;
  save(resolve(path, "profile.json"), profile);

  const env = {
    ...childEnvironment(),
    STATICS_NEXT_DIST_DIR: ".next",
    NEXT_PUBLIC_APP_ENV: "development",
    NEXT_PUBLIC_APP_NETWORK: "anvil",
    NEXT_PUBLIC_ANVIL_RPC_URL: local.rpc,
    NEXT_PUBLIC_ANVIL_CHAIN_ID: "4663",
    STATICS_ROBINHOOD_MAINNET_RPC_URL: local.rpc,
    STATICS_ROBINHOOD_MAINNET_WALLET_RPC_URL: local.rpc,
    NEXT_PUBLIC_STATICS_LOCAL_PHASE_ONE_MANIFEST: JSON.stringify(phaseOne),
    NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST: JSON.stringify(launch),
    NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL: local.indexer,
    NEXT_PUBLIC_PRIVY_APP_ID: profile.privy.appId,
    ...(profile.privy.clientId ? { NEXT_PUBLIC_PRIVY_CLIENT_ID: profile.privy.clientId } : {}),
  };
  const child = ownedProcess(
    process.execPath,
    [
      resolve(appRoot, "node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(profile.ports.app),
    ],
    { cwd: project, env, log: resolve(path, "app.log"), children }
  );
  await waitHttp(`${local.app}/app/swap`, child);
  return child;
}
