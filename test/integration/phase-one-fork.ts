import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  http,
  erc20Abi,
  encodeFunctionData,
  getAddress,
  maxUint256,
  parseAbi,
  parseEther,
  parseEventLogs,
  zeroAddress,
  type Hex,
  type Address,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import {
  buildV4ExactInputSingleSwap,
  staticsGenesisAbi,
  staticsGenesisVaultAbi,
  genesisActivationRegistryAbi,
  genesisLaunchDistributorAbi,
  buildBuyGenesisTransaction,
  buildRedeemGenesisCall,
  buildRegisterGenesisCall,
  buildActivateGenesisCall,
  buildClaimAllGenesisLaunchRewardsCall,
} from "@statics-protocol/sdk";
import {
  staticsAbi,
  staticsRangeGaugeAbi,
  v4StateViewReadAbi,
  v4PositionManagerReadAbi,
  buildMintV4PositionCall,
} from "@statics-protocol/sdk/phase-one";
import {
  staticsGenesisCreditAbi,
  buildOpenGenesisCreditTransaction,
  buildRepayGenesisCreditCall,
  buildRecoverGenesisCreditCall,
} from "@statics-protocol/sdk/genesis-credit";
import { parsePhaseOneDeploymentManifest } from "@/lib/deployments/phase-one-manifest";
import { parseLaunchDeploymentManifest } from "@/lib/deployments/launch-manifest";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import { selectSwapRoute, quoteDirectSwap } from "@/lib/trade/swap-routing";
import {
  buildCreatePositionNftTransaction,
  buildProvidePublicLiquidityTransaction,
  buildPublicLiquidityChangeTransaction,
  quotePublicLiquidity,
  quoteWithdrawalAmounts,
  usableTickBounds,
  publicLiquidityDeadline,
  readPublicManagedLiquidityPosition,
  inspectAttachableV4Position,
  buildAttachPublicLiquidityTransactions,
} from "@/lib/phase-one/liquidity";
import { buildPositionStakingTransaction, readPositionStakingState } from "@/lib/phase-one/staking";
import { listedPublicPool } from "@/lib/phase-one/pools";

// Explicit opt-in: this suite mutates only an already-running local Anvil fork.
const root = process.env.STATICS_FORK_ROOT;
if (!root) throw new Error("STATICS_FORK_ROOT must contain the existing local fork manifests.");
const phaseOne = parsePhaseOneDeploymentManifest(
  JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8")),
  "development-fixture"
);
const launch = parseLaunchDeploymentManifest(
  JSON.parse(readFileSync(resolve(root, "cleanup-launch-manifest.json"), "utf8")),
  "development-fixture"
);
const transport = http("http://127.0.0.1:8663");
const client = createPublicClient({ chain: anvil, transport });
const account = mnemonicToAccount("test test test test test test test test test test test junk");
const wallet = createWalletClient({ chain: anvil, transport, account });
const pool = listedPublicPool(phaseOne.supportedPools.find((entry) => entry.enabled)!);
const option = {
  networkId: "anvil" as const,
  descriptor: phaseOne.descriptor,
  phaseOne,
  launch,
  protocol: null,
};
const eth = {
  address: zeroAddress,
  decimals: 18,
  kind: "native" as const,
  name: "Ether",
  symbol: "ETH",
};
const statics = {
  ...eth,
  address: launch.contracts.statics,
  kind: "erc20" as const,
  symbol: "STATICS",
};
const read = <T>(
  address: Address,
  abi: readonly unknown[],
  functionName: string,
  args: readonly unknown[] = []
) =>
  client.readContract({ address, abi, functionName, args } as Parameters<
    typeof client.readContract
  >[0]) as Promise<T>;
async function send(to: Address, data: Hex, value = 0n) {
  await client.call({ account, to, data, value });
  const gas = await client.estimateGas({ account, to, data, value });
  const hash = await wallet.sendTransaction({ to, data, value, gas: gas + gas / 5n });
  const receipt = await client.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe("success");
  return receipt;
}
async function approve(token: Address, spender: Address) {
  await send(
    token,
    encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, maxUint256] })
  );
}
async function configureLocalFixture(sender: Address, data: Hex) {
  // This client is fixed to loopback Anvil and its chain is checked before the suite runs.
  await client.request({ method: "anvil_impersonateAccount" as never, params: [sender] as never });
  await client.request({
    method: "anvil_setBalance" as never,
    params: [sender, "0x56bc75e2d63100000"] as never,
  });
  try {
    const hash = await wallet.sendTransaction({
      account: sender,
      to: phaseOne.contracts.diamond,
      data,
    });
    expect((await client.waitForTransactionReceipt({ hash })).status).toBe("success");
  } finally {
    await client.request({
      method: "anvil_stopImpersonatingAccount" as never,
      params: [sender] as never,
    });
  }
}
async function createPosition() {
  const transaction = await buildCreatePositionNftTransaction({
    publicClient: client,
    deployment: phaseOne,
    receiver: account.address,
  });
  const receipt = await send(transaction.target, transaction.calldata, transaction.value);
  const event = parseEventLogs({
    abi: staticsAbi,
    logs: receipt.logs,
    eventName: "PositionCreated",
  }).find((entry) => getAddress(entry.address) === phaseOne.contracts.diamond);
  expect(event).toBeDefined();
  return event!.args.positionId;
}
beforeAll(async () => {
  expect(await client.getChainId()).toBe(31337);
  expect(phaseOne.descriptor.chainId).toBe(31337);
  expect(launch.descriptor.chainId).toBe(31337);
  expect(phaseOne.descriptor.deploymentId).toContain("local");
  await client.request({
    method: "anvil_setBalance" as never,
    params: [account.address, "0x3635c9adc5dea00000"] as never,
  });
  // Repeated rehearsals consume activation fees. Replenish through the real Genesis swap path.
  const balance = await read<bigint>(phaseOne.contracts.statics, erc20Abi, "balanceOf", [
    account.address,
  ]);
  if (balance < parseEther("100000")) {
    const route = selectSwapRoute(option, 31337, eth, statics);
    if (route.kind !== "direct") throw new Error("Expected configured Genesis funding route.");
    const amountIn = parseEther("1");
    const quoted = await quoteDirectSwap(client, route, amountIn, account.address);
    const tx = buildV4ExactInputSingleSwap({
      router: route.router,
      poolKey: route.poolKey,
      zeroForOne: route.zeroForOne,
      amountIn,
      amountOutMinimum: (quoted * 99n) / 100n,
      deadline: await publicLiquidityDeadline(client),
      settlement: route.settlement,
    });
    await send(tx.target, tx.calldata, tx.value);
  }
});

it("executes Genesis and Phase 1 native input/output swaps using the configured pool routes", async () => {
  for (const active of [option, { ...option, launch: null }]) {
    const route = selectSwapRoute(active, 31337, eth, statics);
    if (route.kind !== "direct") throw new Error("Expected configured direct pool.");
    const amountIn = parseEther("0.00001");
    const amountOut = await quoteDirectSwap(client, route, amountIn, account.address);
    const tx = buildV4ExactInputSingleSwap({
      router: route.router,
      poolKey: route.poolKey,
      zeroForOne: route.zeroForOne,
      amountIn,
      amountOutMinimum: (amountOut * 99n) / 100n,
      deadline: await publicLiquidityDeadline(client),
      settlement: route.settlement,
    });
    await send(tx.target, tx.calldata, tx.value);
    const reverse = selectSwapRoute(active, 31337, statics, eth);
    if (reverse.kind !== "direct") throw new Error("Expected native output route.");
    await approve(statics.address, reverse.permit2);
    await send(
      reverse.permit2,
      encodeFunctionData({
        abi: parseAbi([
          "function approve(address token,address spender,uint160 amount,uint48 expiration)",
        ]),
        functionName: "approve",
        args: [
          statics.address,
          reverse.router,
          (1n << 160n) - 1n,
          Number((await publicLiquidityDeadline(client)) + 3600n),
        ],
      })
    );
    const reverseOut = await quoteDirectSwap(client, reverse, amountOut, account.address);
    const sell = buildV4ExactInputSingleSwap({
      router: reverse.router,
      poolKey: reverse.poolKey,
      zeroForOne: reverse.zeroForOne,
      amountIn: amountOut,
      amountOutMinimum: (reverseOut * 99n) / 100n,
      deadline: await publicLiquidityDeadline(client),
      settlement: reverse.settlement,
    });
    await send(sell.target, sell.calldata, sell.value);
  }
});

it("creates, stakes, selects rewards, and fully unstakes an owned Phase 1 PositionNFT", async () => {
  const id = await createPosition();
  await approve(phaseOne.contracts.statics, phaseOne.contracts.diamond);
  for (const action of [
    { kind: "stake" as const, amount: parseEther("100") },
    { kind: "opt-in" as const, assets: [phaseOne.contracts.statics, phaseOne.contracts.weth] },
    { kind: "opt-out" as const, assets: [phaseOne.contracts.weth] },
    { kind: "unstake" as const, amount: parseEther("100"), receiver: account.address },
  ]) {
    const tx = buildPositionStakingTransaction({ deployment: phaseOne, positionId: id, action });
    await send(tx.target, tx.calldata);
  }
  const state = await readPositionStakingState({
    publicClient: client,
    deployment: phaseOne,
    positionId: id,
    account: account.address,
  });
  expect(state.stakedBalance).toBe(0n);
  expect(state.pendingRewards.every((amount) => amount === 0n)).toBe(true);
});

it("provides, increases, decreases, collects, rebalances, exits and reuses a managed leg", async () => {
  const id = await createPosition();
  await send(
    phaseOne.contracts.weth,
    encodeFunctionData({ abi: parseAbi(["function deposit() payable"]), functionName: "deposit" }),
    parseEther("0.1")
  );
  await approve(pool.token0.address, phaseOne.contracts.diamond);
  await approve(pool.token1.address, phaseOne.contracts.diamond);
  const [lower, upper] = usableTickBounds(pool.poolKey.tickSpacing);
  const price = await read<readonly [bigint, number]>(
    phaseOne.contracts.stateView,
    v4StateViewReadAbi,
    "getSlot0",
    [pool.poolId]
  );
  const quote = quotePublicLiquidity({
    sqrtPriceX96: price[0],
    currentTick: price[1],
    tickSpacing: pool.poolKey.tickSpacing,
    tickLower: lower,
    tickUpper: upper,
    amount0Maximum: parseEther("0.005"),
    amount1Maximum: parseEther("500"),
  });
  const provide = async () => {
    const tx = buildProvidePublicLiquidityTransaction({
      deployment: phaseOne,
      pool,
      positionId: id,
      quote,
      deadline: await publicLiquidityDeadline(client),
    });
    await send(tx.target, tx.calldata);
  };
  await provide();
  const increase = buildPublicLiquidityChangeTransaction({
    deployment: phaseOne,
    pool,
    positionId: id,
    deadline: await publicLiquidityDeadline(client),
    change: {
      kind: "increase",
      liquidity: quote.liquidity / 10n,
      amount0Maximum: quote.maximumAmount0,
      amount1Maximum: quote.maximumAmount1,
    },
  });
  await send(increase.target, increase.calldata);
  for (const change of [
    {
      kind: "decrease" as const,
      liquidity: quote.liquidity / 10n,
      amount0Minimum: 0n,
      amount1Minimum: 0n,
    },
    { kind: "collect" as const, amount0Minimum: 0n, amount1Minimum: 0n },
  ]) {
    const tx = buildPublicLiquidityChangeTransaction({
      deployment: phaseOne,
      pool,
      positionId: id,
      deadline: await publicLiquidityDeadline(client),
      change,
    });
    await send(tx.target, tx.calldata);
  }
  const principal = quoteWithdrawalAmounts(price[0], lower, upper, quote.liquidity);
  const replacement = quotePublicLiquidity({
    sqrtPriceX96: price[0],
    currentTick: price[1],
    tickSpacing: pool.poolKey.tickSpacing,
    tickLower: lower,
    tickUpper: upper,
    amount0Maximum: principal.amount0,
    amount1Maximum: principal.amount1,
  });
  const rebalance = buildPublicLiquidityChangeTransaction({
    deployment: phaseOne,
    pool,
    positionId: id,
    deadline: await publicLiquidityDeadline(client),
    change: {
      kind: "rebalance",
      tickLower: lower,
      tickUpper: upper,
      liquidity: replacement.liquidity,
      amount0Maximum: 0n,
      amount1Maximum: 0n,
      amount0Minimum: (principal.amount0 * 99n) / 100n,
      amount1Minimum: (principal.amount1 * 99n) / 100n,
    },
  });
  await send(rebalance.target, rebalance.calldata);
  const exit = buildPublicLiquidityChangeTransaction({
    deployment: phaseOne,
    pool,
    positionId: id,
    deadline: await publicLiquidityDeadline(client),
    change: { kind: "exit", amount0Minimum: 0n, amount1Minimum: 0n },
  });
  await send(exit.target, exit.calldata);
  const exited = await readPublicManagedLiquidityPosition({
    publicClient: client,
    deployment: phaseOne,
    positionId: id,
    poolId: pool.poolId,
  });
  expect(exited.leg.liquidity).toBe(0n);
  for (let slot = 0; slot < exited.rewards.slotCount; slot++) {
    if (exited.rewards.amounts[slot] > 0n || exited.leg.rewardRemainderRay[slot] > 0n)
      await send(
        phaseOne.contracts.diamond,
        encodeFunctionData({
          abi: staticsRangeGaugeAbi,
          functionName: "forfeitLpReward",
          args: [id, pool.poolId, slot],
        })
      );
  }
  await provide();
  expect(
    (
      await readPublicManagedLiquidityPosition({
        publicClient: client,
        deployment: phaseOne,
        positionId: id,
        poolId: pool.poolId,
      })
    ).leg.liquidity
  ).toBeGreaterThan(0n);
  console.log(`Managed PositionNFT ${id}: reused pool ${pool.poolId}`);
});

it("attaches an owned PositionManager NFT to a discovered Phase 1 PositionNFT", async () => {
  const id = await createPosition();
  const [tickLower, tickUpper] = usableTickBounds(pool.poolKey.tickSpacing);
  const [sqrtPriceX96, currentTick] = await read<readonly [bigint, number]>(
    phaseOne.contracts.stateView,
    v4StateViewReadAbi,
    "getSlot0",
    [pool.poolId]
  );
  const quote = quotePublicLiquidity({
    sqrtPriceX96,
    currentTick,
    tickSpacing: pool.poolKey.tickSpacing,
    tickLower,
    tickUpper,
    amount0Maximum: parseEther("0.001"),
    amount1Maximum: parseEther("100"),
  });
  for (const token of [pool.poolKey.currency0, pool.poolKey.currency1]) {
    await approve(token, phaseOne.contracts.permit2);
    await send(
      phaseOne.contracts.permit2,
      encodeFunctionData({
        abi: parseAbi([
          "function approve(address token,address spender,uint160 amount,uint48 expiration)",
        ]),
        functionName: "approve",
        args: [
          token,
          phaseOne.contracts.positionManager,
          (1n << 160n) - 1n,
          Number(await publicLiquidityDeadline(client)),
        ],
      })
    );
  }
  const tokenId = await read<bigint>(
    phaseOne.contracts.positionManager,
    v4PositionManagerReadAbi,
    "nextTokenId"
  );
  await send(
    phaseOne.contracts.positionManager,
    buildMintV4PositionCall({
      poolKey: pool.poolKey,
      tickLower,
      tickUpper,
      liquidity: quote.liquidity,
      amount0Max: quote.maximumAmount0,
      amount1Max: quote.maximumAmount1,
      recipient: account.address,
      deadline: await publicLiquidityDeadline(client),
    })
  );
  const position = await inspectAttachableV4Position({
    publicClient: client,
    deployment: phaseOne,
    pool,
    owner: account.address,
    tokenId,
  });
  expect(position.compatible).toBe(true);
  for (const transaction of buildAttachPublicLiquidityTransactions({
    deployment: phaseOne,
    pool,
    positionId: id,
    position,
  })) {
    await send(transaction.target, transaction.calldata);
  }
  const managed = await readPublicManagedLiquidityPosition({
    publicClient: client,
    deployment: phaseOne,
    positionId: id,
    poolId: pool.poolId,
  });
  expect(managed.leg.liquidity).toBe(quote.liquidity);
  expect(
    await read<Address>(phaseOne.contracts.positionManager, v4PositionManagerReadAbi, "ownerOf", [
      tokenId,
    ])
  ).toBe(phaseOne.contracts.liquidityManager);
});

it("preserves Operator acquisition, activation, rewards, redemption and closed-epoch credit gating", async () => {
  let id = BigInt(process.env.STATICS_FORK_OPERATOR_ID ?? "1");
  const resume = Boolean(process.env.STATICS_FORK_OPERATOR_ID);
  for (; id <= 5555n; id++) {
    if (
      resume ||
      (await read<boolean>(launch.contracts.vault, staticsGenesisVaultAbi, "isVaultInventory", [
        id,
      ]))
    )
      break;
  }
  expect(id).toBeLessThanOrEqual(5555n);
  const quote = await read<{ requiredNative: bigint; epochActive: boolean }>(
    launch.contracts.vault,
    currentGenesisVaultAbi,
    "quoteGenesisPurchase"
  );
  if (!resume) {
    await approve(launch.contracts.statics, launch.contracts.vault);
    const buy = buildBuyGenesisTransaction(id, account.address, quote.requiredNative);
    await send(launch.contracts.vault, buy.data, buy.value);
  }
  expect(await read<Address>(launch.contracts.genesis, staticsGenesisAbi, "ownerOf", [id])).toBe(
    account.address
  );
  if (
    !(await read<boolean>(
      launch.contracts.launchDistributor,
      genesisLaunchDistributorAbi,
      "registered",
      [id]
    ))
  )
    await send(launch.contracts.launchDistributor, buildRegisterGenesisCall(id));
  await approve(launch.contracts.statics, launch.contracts.activationRegistry);
  await send(launch.contracts.activationRegistry, buildActivateGenesisCall(id, 1));
  expect(
    await read<number>(
      launch.contracts.activationRegistry,
      genesisActivationRegistryAbi,
      "tierOf",
      [id]
    )
  ).toBe(1);
  await send(
    launch.contracts.launchDistributor,
    buildClaimAllGenesisLaunchRewardsCall([id], account.address)
  );
  expect(
    await read<boolean>(
      launch.contracts.launchDistributor,
      genesisLaunchDistributorAbi,
      "registered",
      [id]
    )
  ).toBe(true);
  if (!quote.epochActive) {
    const credit = buildOpenGenesisCreditTransaction(id, parseEther("1"), 0n);
    await expect(
      client.call({ account, to: launch.contracts.vault, data: credit.data, value: credit.value })
    ).rejects.toThrow();
    expect(
      await read<boolean>(launch.contracts.vault, staticsGenesisCreditAbi, "creditActive", [id])
    ).toBe(false);
  }
  await send(
    launch.contracts.genesis,
    encodeFunctionData({
      abi: staticsGenesisAbi,
      functionName: "approve",
      args: [launch.contracts.vault, id],
    })
  );
  await send(launch.contracts.vault, buildRedeemGenesisCall(id, account.address));
  expect(await read<Address>(launch.contracts.genesis, staticsGenesisAbi, "ownerOf", [id])).toBe(
    launch.contracts.vault
  );
  console.log(
    `Operator #${id}: acquired, activated, reward claim confirmed, redeemed; epoch ${quote.epochActive ? "active" : "closed"}`
  );
});

it("repays an existing forked Operator credit and executes permissionless recovery after its grace period", async () => {
  let id = 1n;
  let state;
  for (; id <= 100n; id++) {
    const credit = await read<{ principal: bigint; recoverableAt: number; active: boolean }>(
      launch.contracts.vault,
      staticsGenesisCreditAbi,
      "credit",
      [id]
    );
    if (credit.active && credit.principal > parseEther("1")) {
      state = credit;
      break;
    }
  }
  expect(state).toBeDefined();
  await approve(launch.contracts.statics, launch.contracts.vault);
  await send(launch.contracts.vault, buildRepayGenesisCreditCall(id, parseEther("1")));
  const repaid = await read<{ principal: bigint; recoverableAt: number }>(
    launch.contracts.vault,
    staticsGenesisCreditAbi,
    "credit",
    [id]
  );
  expect(repaid.principal).toBe(state!.principal - parseEther("1"));
  const now = (await client.getBlock({ blockTag: "pending" })).timestamp;
  const delay = BigInt(repaid.recoverableAt) + 1n - now;
  if (delay > 0n) {
    await client.request({ method: "evm_increaseTime" as never, params: [Number(delay)] as never });
    await client.request({ method: "evm_mine" as never });
  }
  await send(launch.contracts.vault, buildRecoverGenesisCreditCall(id));
  expect(
    await read<boolean>(launch.contracts.vault, staticsGenesisCreditAbi, "creditActive", [id])
  ).toBe(false);
  expect(await read<Address>(launch.contracts.genesis, staticsGenesisAbi, "ownerOf", [id])).toBe(
    launch.contracts.vault
  );
});

it("claims funded global, LP and allocator rewards and preserves the global portfolio after opt-out and unstaking", async () => {
  const id = await createPosition();
  await approve(phaseOne.contracts.statics, phaseOne.contracts.diamond);
  for (const action of [
    { kind: "stake" as const, amount: parseEther("100") },
    { kind: "opt-in" as const, assets: [phaseOne.contracts.weth] },
  ]) {
    const tx = buildPositionStakingTransaction({ deployment: phaseOne, positionId: id, action });
    await send(tx.target, tx.calldata);
  }
  // Let this fixture's stake ingress cooldown and reward-selection maturity expire.
  await client.request({ method: "evm_increaseTime" as never, params: [25 * 3600] as never });
  await client.request({ method: "evm_mine" as never });
  const incentivesAbi = parseAbi([
    "function setGaugeAllocations(uint256 positionId,bytes32[] poolIds,uint256[] amounts)",
    "function claimGaugeAllocatorRewards(uint256 positionId,bytes32 poolId,uint8[] slots,uint256[] minimumAmounts,address receiver) returns (uint256[])",
    "function previewGaugeAllocatorRewards(uint256 positionId,bytes32 poolId,uint8[] slots) view returns ((uint8 slot,address asset,uint256 allocation,uint256 amount)[])",
  ]);
  await send(
    phaseOne.contracts.diamond,
    encodeFunctionData({
      abi: incentivesAbi,
      functionName: "setGaugeAllocations",
      args: [id, [pool.poolId], [parseEther("100")]],
    })
  );
  const config = await read<{ slotCount: number; assets: readonly Address[] }>(
    phaseOne.contracts.diamond,
    staticsRangeGaugeAbi,
    "poolRewardConfig",
    [pool.poolId]
  );
  let slot = config.assets.findIndex(
    (asset) => asset.toLowerCase() === phaseOne.contracts.weth.toLowerCase()
  );
  const creator = await read<Address>(
    phaseOne.contracts.diamond,
    staticsAbi,
    "protocolPoolCreator",
    [pool.poolId]
  );
  if (slot < 0) {
    // Governance impersonation is restricted to this local Anvil fixture; no key is used.
    const owner = await read<Address>(
      phaseOne.contracts.diamond,
      parseAbi(["function owner() view returns (address)"]),
      "owner"
    );
    await configureLocalFixture(
      owner,
      encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "setGaugeRewardAssetAllowed",
        args: [phaseOne.contracts.weth, true],
      })
    );
    slot = config.slotCount;
    await configureLocalFixture(
      creator,
      encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "appendPoolRewardAsset",
        args: [pool.poolId, phaseOne.contracts.weth],
      })
    );
  }
  await configureLocalFixture(
    creator,
    encodeFunctionData({
      abi: staticsRangeGaugeAbi,
      functionName: "setPoolRewardAllocatorShare",
      args: [pool.poolId, slot, 2500],
    })
  );
  await approve(phaseOne.contracts.weth, phaseOne.contracts.diamond);
  const [lower, upper] = usableTickBounds(pool.poolKey.tickSpacing);
  const price = await read<readonly [bigint, number]>(
    phaseOne.contracts.stateView,
    v4StateViewReadAbi,
    "getSlot0",
    [pool.poolId]
  );
  const liquidity = quotePublicLiquidity({
    sqrtPriceX96: price[0],
    currentTick: price[1],
    tickSpacing: pool.poolKey.tickSpacing,
    tickLower: lower,
    tickUpper: upper,
    amount0Maximum: parseEther("0.005"),
    amount1Maximum: parseEther("500"),
  });
  const provide = buildProvidePublicLiquidityTransaction({
    deployment: phaseOne,
    pool,
    positionId: id,
    quote: liquidity,
    deadline: await publicLiquidityDeadline(client),
  });
  await send(provide.target, provide.calldata);
  await send(
    phaseOne.contracts.diamond,
    encodeFunctionData({
      abi: staticsRangeGaugeAbi,
      functionName: "fundPoolReward",
      args: [pool.poolId, slot, parseEther("0.001"), 0, 2500],
    })
  );
  await client.request({ method: "evm_increaseTime" as never, params: [25 * 3600] as never });
  await client.request({ method: "evm_mine" as never });
  const route = selectSwapRoute({ ...option, launch: null }, 31337, eth, statics);
  if (route.kind !== "direct") throw new Error("Expected Phase 1 route.");
  const amountIn = parseEther("0.0001");
  const quoted = await quoteDirectSwap(client, route, amountIn, account.address);
  const swap = buildV4ExactInputSingleSwap({
    router: route.router,
    poolKey: route.poolKey,
    zeroForOne: route.zeroForOne,
    amountIn,
    amountOutMinimum: (quoted * 99n) / 100n,
    deadline: await publicLiquidityDeadline(client),
    settlement: route.settlement,
  });
  await send(swap.target, swap.calldata, swap.value);
  const lp = await readPublicManagedLiquidityPosition({
    publicClient: client,
    deployment: phaseOne,
    positionId: id,
    poolId: pool.poolId,
  });
  expect(lp.rewards.amounts[slot]).toBeGreaterThan(0n);
  await send(
    phaseOne.contracts.diamond,
    encodeFunctionData({
      abi: staticsRangeGaugeAbi,
      functionName: "claimLpRewards",
      args: [id, pool.poolId, [slot], [(lp.rewards.amounts[slot] * 99n) / 100n], account.address],
    })
  );
  const allocator = await read<readonly { amount: bigint }[]>(
    phaseOne.contracts.diamond,
    incentivesAbi,
    "previewGaugeAllocatorRewards",
    [id, pool.poolId, [slot]]
  );
  expect(allocator[0].amount).toBeGreaterThan(0n);
  await send(
    phaseOne.contracts.diamond,
    encodeFunctionData({
      abi: incentivesAbi,
      functionName: "claimGaugeAllocatorRewards",
      args: [id, pool.poolId, [slot], [(allocator[0].amount * 99n) / 100n], account.address],
    })
  );
  const optOut = buildPositionStakingTransaction({
    deployment: phaseOne,
    positionId: id,
    action: { kind: "opt-out", assets: [phaseOne.contracts.weth] },
  });
  await send(optOut.target, optOut.calldata);
  // Allocation locks stake; remove this fixture's allocation before full withdrawal.
  await send(
    phaseOne.contracts.diamond,
    encodeFunctionData({
      abi: incentivesAbi,
      functionName: "setGaugeAllocations",
      args: [id, [], []],
    })
  );
  const unstake = buildPositionStakingTransaction({
    deployment: phaseOne,
    positionId: id,
    action: { kind: "unstake", amount: parseEther("100"), receiver: account.address },
  });
  await send(unstake.target, unstake.calldata);
  const state = await readPositionStakingState({
    publicClient: client,
    deployment: phaseOne,
    positionId: id,
    account: account.address,
  });
  expect(state.selectedAssets).toEqual([]);
  expect(state.stakedBalance).toBe(0n);
  expect(state.claimAssets.map((asset) => getAddress(asset))).toContain(phaseOne.contracts.weth);
  expect(state.pendingRewards[0]).toBeGreaterThan(0n);
  const claim = buildPositionStakingTransaction({
    deployment: phaseOne,
    positionId: id,
    action: {
      kind: "claim",
      assets: state.claimAssets,
      minimumAmounts: state.pendingRewards.map((amount) => (amount * 99n) / 100n),
      receiver: account.address,
    },
  });
  await send(claim.target, claim.calldata);
});
