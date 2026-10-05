import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseAbi,
  parseEther,
  keccak256,
  stringToHex,
  zeroHash,
  maxUint256,
  parseEventLogs,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { buildV4ExactInputSingleSwap, v4PoolId } from "@statics-protocol/sdk";
import { appRoot, childEnvironment, json, mnemonic, rpc, save, urls } from "./profile.mjs";
import { run } from "./processes.mjs";

export function transactionContext(profile) {
  const url = urls(profile).rpc,
    transport = http(url, { timeout: 120000 });
  const client = createPublicClient({ transport });
  const account = (index) => mnemonicToAccount(mnemonic, { addressIndex: index });
  const wallet = (index) => createWalletClient({ transport, account: account(index) });
  return { client, account, wallet, url };
}
export async function confirmed(context, sender, transaction, profile, path) {
  const hash = await sender.sendTransaction({
    ...transaction,
    chain: null,
    type: "legacy",
    gas: transaction.gas ?? 12000000n,
  });
  // Receipt hashes are durable recovery evidence even before confirmation.
  profile.receipts.push({ hash, status: "pending" });
  save(resolve(path, "profile.json"), profile);
  const receipt = await context.client.waitForTransactionReceipt({ hash, timeout: 180000 });
  Object.assign(profile.receipts.at(-1), {
    status: receipt.status,
    blockNumber: String(receipt.blockNumber),
  });
  save(resolve(path, "profile.json"), profile);
  save(
    resolve(path, "receipts", `${hash}.json`),
    JSON.parse(JSON.stringify(receipt, (_, v) => (typeof v === "bigint" ? v.toString() : v)))
  );
  if (receipt.status !== "success") throw new Error(`Local transaction reverted: ${hash}`);
  return receipt;
}
export async function stage(profile, path, name, operation) {
  if (profile.stages[name]?.status === "complete") return;
  profile.stages[name] = { status: "started", startedAt: new Date().toISOString() };
  save(resolve(path, "profile.json"), profile);
  console.log(`Fork stage: ${name}`);
  await operation();
  profile.stages[name].status = "complete";
  save(resolve(path, "profile.json"), profile);
  // Save with historical states after every completed mutation stage.
  const state = await rpc(urls(profile).rpc, "anvil_dumpState", [true]);
  save(resolve(path, "checkpoint-state.json"), state);
}
function label(log, name) {
  const match = log.match(new RegExp(`${name}\\s*:?\\s*(0x[0-9a-fA-F]+|[0-9]+)`));
  if (!match)
    throw new Error(`Deployment output is missing ${name}; retain all artifacts for recovery.`);
  return match[1];
}
export async function deploy(profile, path, children) {
  const { client, account, wallet, url } = transactionContext(profile);
  const genesis = json(
    resolve(profile.protocolRepository, "deployments/robinhood-mainnet-genesis.json")
  );
  const env = {
    ...childEnvironment(),
    FOUNDRY_BROADCAST: resolve(path, "forge/broadcast"),
    PRIVATE_KEY: `0x${Buffer.from(account(0).getHdKey().privateKey).toString("hex")}`,
    MULTISIG: genesis.roles.governance,
    GUARDIAN: account(1).address,
    TREASURY: genesis.roles.treasury,
    STAKING_TOKEN: genesis.contracts.staticsToken.address,
    WETH_ADDRESS: genesis.externalDependencies.weth.address,
    POSITION_CREATION_FEE_AMOUNT: "1000000000000000",
    WEEKLY_GAUGE_RELEASE_BPS: "400",
    STATICS_REVENUE_MAINTENANCE_TIP_BPS: "500",
    STATICS_POL_OPERATOR: account(3).address,
    STATICS_POL_ACTIVATION_FEE: "100000000000000000",
    STATICS_LIQUIDITY_TIMELOCK_SALT: keccak256(stringToHex(profile.id)),
  };
  for (const [key, value] of Object.entries(profile.addresses ?? {})) env[key] = value;
  async function forge(name, source, sig = "run()", broadcast = true) {
    const log = resolve(path, `${name}.log`);
    const args = [
      "script",
      source,
      "--sig",
      sig,
      "--out",
      resolve(path, "forge/out"),
      "--cache-path",
      resolve(path, "forge/cache"),
      "--rpc-url",
      url,
      "--legacy",
      "--slow",
      "-vv",
    ];
    if (broadcast) args.push("--broadcast");
    await run("forge", args, { cwd: profile.protocolRepository, env, log, children });
    // Check broadcast receipts independently, not console success alone.
    const broadcastRoot = resolve(path, "forge/broadcast");
    function receipts(directory) {
      if (!existsSync(directory)) return;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = resolve(directory, entry.name);
        if (entry.isDirectory()) receipts(file);
        else if (entry.name.endsWith("-latest.json")) {
          const result = json(file);
          for (const receipt of result.receipts ?? []) {
            if (BigInt(receipt.status) !== 1n)
              throw new Error("Forge broadcast contains a failed receipt.");
            if (!profile.receipts.some((row) => row.hash === receipt.transactionHash))
              profile.receipts.push({
                hash: receipt.transactionHash,
                status: "success",
                blockNumber: String(BigInt(receipt.blockNumber)),
              });
          }
        }
      }
    }
    receipts(broadcastRoot);
    save(resolve(path, "profile.json"), profile);
    return readFileSync(log, "utf8");
  }
  await stage(profile, path, "initialize", async () => {
    if (BigInt(profile.snapshot.number) < BigInt(genesis.network.finalizeEndBlock))
      throw new Error("Snapshot predates Genesis finalization.");
    profile.identityMarker = {
      address: `0x${keccak256(stringToHex(profile.id)).slice(-40)}`,
      code: keccak256(stringToHex(`statics-fork-${profile.id}`)),
    };
    await rpc(url, "anvil_setCode", [profile.identityMarker.address, profile.identityMarker.code]);
    for (let i = 0; i < 20; i++) await rpc(url, "anvil_setCode", [account(i).address, "0x"]);
    await rpc(url, "anvil_impersonateAccount", [genesis.roles.governance]);
    await rpc(url, "anvil_setBalance", [
      genesis.roles.governance,
      `0x${parseEther("1000").toString(16)}`,
    ]);
  });
  await stage(profile, path, "phase-one", async () => {
    profile.phaseOneStartBlock = String((await client.getBlockNumber()) + 1n);
    const log = await forge(
      "deploy-phase-one",
      "script/DeployStaticsPhaseOne.s.sol:DeployStaticsPhaseOne"
    );
    profile.addresses = {};
    for (const name of [
      "STATICS_DIAMOND_ADDRESS",
      "STATICS_TIMELOCK_ADDRESS",
      "STATICS_LIQUIDITY_MANAGER_ADDRESS",
      "STATICS_SWAP_FEE_HOOK_ADDRESS",
      "STATICS_PERMISSIONED_SWAP_FEE_HOOK_ADDRESS",
      "STATICS_DEFAULT_VENUE_CONTROLLER_FACTORY",
    ])
      profile.addresses[name] = env[name] = label(log, name);
  });
  await stage(profile, path, "periphery", async () => {
    Object.assign(env, profile.addresses);
    const log = await forge(
      "deploy-periphery",
      "script/DeployStaticsPermissionedPeriphery.s.sol:DeployStaticsPermissionedPeriphery"
    );
    for (const name of [
      "STATICS_PERMISSIONED_ROUTER_ADDRESS",
      "STATICS_PERMISSIONED_POSITION_MANAGER_ADDRESS",
      "STATICS_PERMISSIONED_POSITION_CLAIMS_ADDRESS",
    ])
      profile.addresses[name] = env[name] = label(log, name);
  });
  await stage(profile, path, "liquidity-installation", async () => {
    Object.assign(env, profile.addresses);
    for (const [name, address] of Object.entries(profile.addresses))
      if (name.endsWith("_ADDRESS"))
        env[name.replace(/_ADDRESS$/, "_RUNTIME_CODE_HASH")] = keccak256(
          await client.getCode({ address })
        );
    const log = await forge(
      "prepare-liquidity",
      "script/ConfigureStaticsPhaseOneLiquidity.s.sol:ConfigureStaticsPhaseOneLiquidity",
      "runPrepare()",
      false
    );
    const target = label(log, "TIMELOCK_SCHEDULE_TARGET"),
      data = label(log, "TIMELOCK_SCHEDULE_CALLDATA"),
      delay = Number(label(log, "TIMELOCK_DELAY"));
    if (target.toLowerCase() !== env.STATICS_TIMELOCK_ADDRESS.toLowerCase())
      throw new Error("Unexpected timelock target.");
    const governance = createWalletClient({
      transport: http(url),
      account: genesis.roles.governance,
    });
    await confirmed({ client }, governance, { to: target, data }, profile, path);
    await rpc(url, "evm_increaseTime", [delay + 1]);
    await rpc(url, "evm_mine");
    await forge(
      "execute-liquidity",
      "script/ConfigureStaticsPhaseOneLiquidity.s.sol:ConfigureStaticsPhaseOneLiquidity",
      "runExecute()"
    );
  });
  await stage(profile, path, "seed", async () => {
    const diamond = env.STATICS_DIAMOND_ADDRESS,
      timelock = env.STATICS_TIMELOCK_ADDRESS;
    const launch = json(resolve(appRoot, "deployments/robinhood-genesis.json"));
    const currencies = [env.STAKING_TOKEN, env.WETH_ADDRESS].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    const poolKey = {
      currency0: currencies[0],
      currency1: currencies[1],
      fee: 3000,
      tickSpacing: 60,
      hooks: env.STATICS_SWAP_FEE_HOOK_ADDRESS,
    };
    const deadline = (await client.getBlock()).timestamp + 172800n;
    const data = encodeFunctionData({
      abi: parseAbi([
        "function createPool((address tokenA,address tokenB,uint24 lpFee,int24 tickSpacing,uint160 sqrtPriceX96,(uint16 inputFeeBps,uint16 outputFeeBps) feeConfig,address creator,bool restricted,uint256 nonce,uint256 deadline),bytes) returns (bytes32)",
      ]),
      functionName: "createPool",
      args: [
        {
          tokenA: env.STAKING_TOKEN,
          tokenB: env.WETH_ADDRESS,
          lpFee: 3000,
          tickSpacing: 60,
          sqrtPriceX96: 2n ** 96n,
          feeConfig: { inputFeeBps: 5, outputFeeBps: 5 },
          creator: account(6).address,
          restricted: false,
          nonce: 2n,
          deadline,
        },
        "0x",
      ],
    });
    const abi = parseAbi([
      "function getMinDelay() view returns (uint256)",
      "function schedule(address,uint256,bytes,bytes32,bytes32,uint256)",
      "function execute(address,uint256,bytes,bytes32,bytes32)",
    ]);
    const delay = await client.readContract({
      address: timelock,
      abi,
      functionName: "getMinDelay",
    });
    const salt = keccak256(stringToHex(`${profile.id}-pool`));
    const governance = createWalletClient({
      transport: http(url),
      account: genesis.roles.governance,
    });
    await confirmed(
      { client },
      governance,
      {
        to: timelock,
        data: encodeFunctionData({
          abi,
          functionName: "schedule",
          args: [diamond, 0n, data, zeroHash, salt, delay],
        }),
      },
      profile,
      path
    );
    await rpc(url, "evm_increaseTime", [Number(delay) + 1]);
    await rpc(url, "evm_mine");
    const poolReceipt = await confirmed(
      { client },
      wallet(5),
      {
        to: timelock,
        data: encodeFunctionData({
          abi,
          functionName: "execute",
          args: [diamond, 0n, data, zeroHash, salt],
        }),
      },
      profile,
      path
    );
    profile.pool = {
      poolKey,
      poolId: v4PoolId(poolKey),
      registrationBlock: String(poolReceipt.blockNumber),
    };
    const tokenAbi = parseAbi([
      "function approve(address,uint256) returns (bool)",
      "function deposit()",
    ]);
    for (const index of [6, 0, 7]) {
      const swap = buildV4ExactInputSingleSwap({
        router: launch.contracts.universalRouter.address,
        poolKey: launch.market.poolKey,
        zeroForOne:
          launch.market.poolKey.currency0.toLowerCase() === env.WETH_ADDRESS.toLowerCase(),
        amountIn: parseEther(index === 6 ? "2" : "1"),
        amountOutMinimum: 1n,
        deadline: (await client.getBlock()).timestamp + 3600n,
        settlement: { input: "native", output: "erc20", wrappedNative: env.WETH_ADDRESS },
      });
      await confirmed(
        { client },
        wallet(index),
        { to: swap.target, data: swap.calldata, value: swap.value },
        profile,
        path
      );
      await confirmed(
        { client },
        wallet(index),
        {
          to: env.WETH_ADDRESS,
          data: encodeFunctionData({ abi: tokenAbi, functionName: "deposit" }),
          value: parseEther(index === 6 ? "100" : "10"),
        },
        profile,
        path
      );
    }
    for (const currency of currencies)
      await confirmed(
        { client },
        wallet(6),
        {
          to: currency,
          data: encodeFunctionData({
            abi: tokenAbi,
            functionName: "approve",
            args: [diamond, maxUint256],
          }),
        },
        profile,
        path
      );
    const created = await confirmed(
      { client },
      wallet(6),
      {
        to: diamond,
        data: encodeFunctionData({
          abi: parseAbi(["function createPosition(address) returns (uint256)"]),
          functionName: "createPosition",
          args: [account(6).address],
        }),
        value: parseEther("0.001"),
      },
      profile,
      path
    );
    const events = parseEventLogs({
      abi: parseAbi([
        "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
      ]),
      logs: created.logs,
    });
    const mint = events.find(
      (row) =>
        row.address.toLowerCase() === diamond.toLowerCase() &&
        row.args.from === "0x0000000000000000000000000000000000000000"
    );
    if (!mint)
      throw new Error(
        "Create receipt did not contain PositionNFT ID; preserve it, never create a replacement automatically."
      );
    profile.positionId = String(mint.args.tokenId);
    await confirmed(
      { client },
      wallet(6),
      {
        to: diamond,
        data: encodeFunctionData({
          abi: parseAbi([
            "function provideLiquidity(uint256,(bytes32 poolId,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 amount0Max,uint256 amount1Max,uint256 deadline))",
          ]),
          functionName: "provideLiquidity",
          args: [
            mint.args.tokenId,
            {
              poolId: profile.pool.poolId,
              tickLower: -600,
              tickUpper: 600,
              liquidity: 10n ** 20n,
              amount0Max: 10n ** 20n,
              amount1Max: 10n ** 20n,
              deadline: (await client.getBlock()).timestamp + 3600n,
            },
          ],
        }),
      },
      profile,
      path
    );
  });
}
