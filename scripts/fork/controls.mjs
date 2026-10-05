import { resolve } from "node:path";
import { encodeFunctionData, erc20Abi, parseAbi, parseEther } from "viem";
import { parseLaunchForkControl } from "../lib/launch-fork-control.mjs";
import { confirmed, transactionContext, checkpoint } from "./deploy.mjs";
import { json, rpc, urls, verifyAnvil, save } from "./profile.mjs";

export function controlCommand(action, args) {
  if (!["fund-wallet", "advance-time"].includes(action)) throw new Error("Unsupported mutation.");
  return parseLaunchForkControl(action, args);
}
export async function applyControl(command, profile, path) {
  await verifyAnvil(profile);
  const context = transactionContext(profile),
    { client, wallet, url } = context;
  if (command.action === "advance-time") {
    profile.controlMutation = { action: command.action, status: "started" };
    save(resolve(path, "profile.json"), profile);
    const before = await client.getBlock();
    await rpc(url, "evm_increaseTime", [command.seconds]);
    await rpc(url, "evm_mine");
    await checkpoint(profile, path);
    delete profile.controlMutation;
    save(resolve(path, "profile.json"), profile);
    return {
      seconds: command.seconds,
      before: String(before.timestamp),
      after: String((await client.getBlock()).timestamp),
    };
  }
  const launch = json(resolve(path, "cleanup-launch-manifest.json"));
  const amounts = Object.fromEntries(
    ["eth", "weth", "statics"].map((name) => [name, parseEther(command[name])])
  );
  const sender = wallet(0);
  if (command.wallet.toLowerCase() === sender.account.address.toLowerCase())
    throw new Error("Recipient must differ from the funding fixture account.");
  // Validate all available balances before any funding transaction; no silent reduction.
  const staticsBalance = await client.readContract({
    address: launch.contracts.statics.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [sender.account.address],
  });
  if (staticsBalance < amounts.statics)
    throw new Error("Seeded fixture STATICS is insufficient for the requested amount.");
  if (
    (await client.getBalance({ address: sender.account.address })) <
    amounts.eth + amounts.weth + parseEther("0.01")
  )
    throw new Error("Fixture ETH is insufficient including gas.");
  profile.controlMutation = { action: command.action, wallet: command.wallet, status: "started" };
  save(resolve(path, "profile.json"), profile);
  if (amounts.eth)
    await confirmed(context, sender, { to: command.wallet, value: amounts.eth }, profile, path);
  if (amounts.weth) {
    await confirmed(
      context,
      sender,
      {
        to: launch.contracts.weth.address,
        data: encodeFunctionData({
          abi: parseAbi(["function deposit()"]),
          functionName: "deposit",
        }),
        value: amounts.weth,
      },
      profile,
      path
    );
    await confirmed(
      context,
      sender,
      {
        to: launch.contracts.weth.address,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [command.wallet, amounts.weth],
        }),
      },
      profile,
      path
    );
  }
  if (amounts.statics)
    await confirmed(
      context,
      sender,
      {
        to: launch.contracts.statics.address,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [command.wallet, amounts.statics],
        }),
      },
      profile,
      path
    );
  return { wallet: command.wallet, eth: command.eth, weth: command.weth, statics: command.statics };
}
export async function lightweightStatus(profile) {
  const local = urls(profile);
  const result = {
    profile: profile.profile,
    status: profile.status,
    chainId: profile.chainId,
    snapshot: profile.snapshot,
    provenance: profile.provenance,
    urls: local,
    stages: profile.stages,
  };
  const health = await Promise.allSettled([
    verifyAnvil(profile),
    fetch(`${local.indexer}/status`, { signal: AbortSignal.timeout(3000) }).then((r) => r.json()),
    fetch(`${local.app}/app/swap`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok),
  ]);
  result.health = {
    anvil: health[0].status === "fulfilled",
    indexer: health[1].status === "fulfilled",
    app: health[2].status === "fulfilled" && health[2].value,
  };
  if (health[1].status === "fulfilled") result.indexerCheckpoint = health[1].value;
  return result;
}
