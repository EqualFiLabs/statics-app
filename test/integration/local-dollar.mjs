import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  basketTokenAbi,
  buildDepositETHTransaction,
  buildDepositWETHCall,
  buildMintCall,
  buildRedeemCall,
  buildRecombineToETHCall,
  buildRecombineToWETHCall,
  staticsAbi,
  staticsDollarCoreAbi,
  staticsDollarRiskTokenAbi,
  staticsDollarTokenAbi,
  wethAbi,
} from "@statics-protocol/sdk";
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionResult,
  encodeFunctionData,
  http,
  parseEther,
  toHex,
} from "viem";
import { generateMnemonic, mnemonicToAccount } from "viem/accounts";
import { wordlist } from "@scure/bip39/wordlists/english";

import {
  defaultProtocolRoot,
  deployLocalDollar,
  seedLocalBasket,
} from "../../scripts/lib/local-dollar.mjs";

const siteRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const protocolRoot = defaultProtocolRoot(siteRoot);
const BPS = 10_000n;
const minimum = (amount) => (amount * 9_950n) / BPS;
const maximum = (amount) => (amount * 10_050n + BPS - 1n) / BPS;

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 18_545;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function waitForRpc(rpcUrl) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (response.ok) return;
    } catch {
      // Anvil is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("Anvil did not become ready.");
}

const port = await availablePort();
const rpcUrl = `http://127.0.0.1:${port}`;
const mnemonic = generateMnemonic(wordlist);
const account = mnemonicToAccount(mnemonic);
const derivedPrivateKey = account.getHdKey().privateKey;
if (!derivedPrivateKey) throw new Error("Could not derive the ephemeral Anvil account.");
const privateKey = toHex(derivedPrivateKey);
const anvil = spawn(
  "anvil",
  [
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--chain-id",
    "31337",
    "--mnemonic",
    mnemonic,
    "--balance",
    "1000",
    "--block-time",
    "1",
    "--silent",
  ],
  { stdio: "ignore" }
);

try {
  await waitForRpc(rpcUrl);
  const deployment = await deployLocalDollar({
    protocolRoot,
    rpcUrl,
    privateKey,
    quiet: true,
  });
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, transport: http(rpcUrl) });
  const fixture = await seedLocalBasket({ deployment, rpcUrl, privateKey });
  if (
    deployment.chainId !== 31_337 ||
    fixture.receipt.blockNumber < deployment.deploymentStartBlock
  ) {
    throw new Error("Local basket fixture is not bound to the verified deployment range.");
  }
  const creationEvents = await publicClient.getContractEvents({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    eventName: "BasketCreated",
    fromBlock: deployment.deploymentStartBlock,
    toBlock: "latest",
    strict: true,
  });
  if (!creationEvents.some((event) => event.args.basketId === fixture.basketId)) {
    throw new Error("Local basket fixture is not discoverable from its indexed creation event.");
  }

  const send = async (to, data, value = 0n) => {
    const simulation = await publicClient.call({ account: account.address, to, data, value });
    const hash = await walletClient.sendTransaction({ to, data, value });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`Local transaction ${hash} reverted.`);
    return { receipt, simulationData: simulation.data };
  };

  const assertAvailableRecombination = (functionName, simulationData) => {
    if (!simulationData) throw new Error(`${functionName} simulation returned no result.`);
    const [status, collateralOut] = decodeFunctionResult({
      abi: staticsAbi,
      functionName,
      data: simulationData,
    });
    if (status !== 0 || collateralOut === 0n) {
      throw new Error(
        `${functionName} simulation did not prove an available, nonzero collateral exit.`
      );
    }
  };

  const profile = await publicClient.readContract({
    address: deployment.contracts.core,
    abi: staticsDollarCoreAbi,
    functionName: "collateralProfile",
    args: [1n],
  });
  const amount = parseEther("0.01");

  const ethPreview = await publicClient.readContract({
    address: deployment.contracts.core,
    abi: staticsDollarCoreAbi,
    functionName: "previewDeposit",
    args: [1n, amount],
  });
  const ethDeposit = buildDepositETHTransaction(
    amount,
    account.address,
    account.address,
    minimum(ethPreview.staticsDollarMinted),
    minimum(ethPreview.sharesMinted)
  );
  await send(deployment.contracts.gateway, ethDeposit.data, ethDeposit.value);

  const firstDollarBalance = await publicClient.readContract({
    address: deployment.contracts.dollar,
    abi: staticsDollarTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  const firstRiskBalance = await publicClient.readContract({
    address: deployment.contracts.risk,
    abi: staticsDollarRiskTokenAbi,
    functionName: "balanceOf",
    args: [account.address, profile.activeSeriesId],
  });
  if (firstDollarBalance === 0n || firstRiskBalance === 0n) {
    throw new Error("ETH deposit did not mint real Dollar and Risk balances.");
  }

  await send(
    deployment.contracts.dollar,
    encodeFunctionData({
      abi: staticsDollarTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.gateway, firstDollarBalance],
    })
  );
  await send(
    deployment.contracts.risk,
    encodeFunctionData({
      abi: staticsDollarRiskTokenAbi,
      functionName: "setApprovalForAll",
      args: [deployment.contracts.gateway, true],
    })
  );
  const ethRecombinePreview = await publicClient.readContract({
    address: deployment.contracts.core,
    abi: staticsDollarCoreAbi,
    functionName: "previewRecombine",
    args: [profile.activeSeriesId, firstDollarBalance],
  });
  const ethRecombination = await send(
    deployment.contracts.gateway,
    buildRecombineToETHCall(
      profile.activeSeriesId,
      firstDollarBalance,
      maximum(ethRecombinePreview.sharesBurned),
      account.address,
      minimum(ethRecombinePreview.collateralOut)
    )
  );
  assertAvailableRecombination("recombineToETH", ethRecombination.simulationData);

  await send(
    deployment.contracts.weth,
    encodeFunctionData({ abi: wethAbi, functionName: "deposit" }),
    amount
  );
  await send(
    deployment.contracts.weth,
    encodeFunctionData({
      abi: wethAbi,
      functionName: "approve",
      args: [deployment.contracts.gateway, amount],
    })
  );
  const wethPreview = await publicClient.readContract({
    address: deployment.contracts.core,
    abi: staticsDollarCoreAbi,
    functionName: "previewDeposit",
    args: [1n, amount],
  });
  await send(
    deployment.contracts.gateway,
    buildDepositWETHCall(
      amount,
      account.address,
      account.address,
      minimum(wethPreview.staticsDollarMinted),
      minimum(wethPreview.sharesMinted)
    )
  );

  const secondDollarBalance = await publicClient.readContract({
    address: deployment.contracts.dollar,
    abi: staticsDollarTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  await send(
    deployment.contracts.dollar,
    encodeFunctionData({
      abi: staticsDollarTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.gateway, secondDollarBalance],
    })
  );
  const wethRecombinePreview = await publicClient.readContract({
    address: deployment.contracts.core,
    abi: staticsDollarCoreAbi,
    functionName: "previewRecombine",
    args: [profile.activeSeriesId, secondDollarBalance],
  });
  const wethRecombination = await send(
    deployment.contracts.gateway,
    buildRecombineToWETHCall(
      profile.activeSeriesId,
      secondDollarBalance,
      maximum(wethRecombinePreview.sharesBurned),
      account.address,
      minimum(wethRecombinePreview.collateralOut)
    )
  );
  assertAvailableRecombination("recombineToWETH", wethRecombination.simulationData);

  const endingDollar = await publicClient.readContract({
    address: deployment.contracts.dollar,
    abi: staticsDollarTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  const endingRisk = await publicClient.readContract({
    address: deployment.contracts.risk,
    abi: staticsDollarRiskTokenAbi,
    functionName: "balanceOf",
    args: [account.address, profile.activeSeriesId],
  });
  const endingWeth = await publicClient.readContract({
    address: deployment.contracts.weth,
    abi: wethAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (endingDollar !== 0n || endingRisk !== 0n || endingWeth === 0n) {
    throw new Error("Local Dollar lifecycle did not return to the expected balances.");
  }

  const basketDepositAmount = parseEther("0.01");
  const basketDepositPreview = await publicClient.readContract({
    address: deployment.contracts.core,
    abi: staticsDollarCoreAbi,
    functionName: "previewDeposit",
    args: [1n, basketDepositAmount],
  });
  await send(
    deployment.contracts.gateway,
    buildDepositETHTransaction(
      basketDepositAmount,
      account.address,
      account.address,
      minimum(basketDepositPreview.staticsDollarMinted),
      minimum(basketDepositPreview.sharesMinted)
    ).data,
    basketDepositAmount
  );
  const configuredBasket = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "basket",
    args: [fixture.basketId],
  });
  if (
    configuredBasket.assets.length !== 1 ||
    configuredBasket.assets[0].toLowerCase() !== deployment.contracts.dollar.toLowerCase()
  ) {
    throw new Error("Local basket fixture is not backed by the verified Statics Dollar token.");
  }
  const basketShares = parseEther("1");
  const mintQuote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteMint",
    args: [fixture.basketId, basketShares],
  });
  const mintMaximums = mintQuote.map(maximum);
  await send(
    deployment.contracts.dollar,
    encodeFunctionData({
      abi: staticsDollarTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, mintMaximums[0]],
    })
  );
  const exactAllowance = await publicClient.readContract({
    address: deployment.contracts.dollar,
    abi: staticsDollarTokenAbi,
    functionName: "allowance",
    args: [account.address, deployment.contracts.diamond],
  });
  if (exactAllowance !== mintMaximums[0]) {
    throw new Error("Local basket lifecycle did not establish the exact bounded allowance.");
  }
  const mintResult = await send(
    deployment.contracts.diamond,
    buildMintCall(fixture.basketId, basketShares, account.address, mintMaximums)
  );
  if (!mintResult.simulationData) throw new Error("Basket mint simulation returned no result.");
  const simulatedMintAmounts = decodeFunctionResult({
    abi: staticsAbi,
    functionName: "mint",
    data: mintResult.simulationData,
  });
  if (simulatedMintAmounts.length !== 1 || simulatedMintAmounts[0] === 0n) {
    throw new Error("Basket mint simulation did not prove a nonzero constituent transfer.");
  }
  const mintedBasketBalance = await publicClient.readContract({
    address: configuredBasket.token,
    abi: basketTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (mintedBasketBalance !== basketShares) {
    throw new Error("Confirmed basket mint did not produce the expected BasketToken balance.");
  }
  const redeemQuote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteRedeem",
    args: [fixture.basketId, mintedBasketBalance],
  });
  const redeemMinimums = redeemQuote.map(minimum);
  const redeemResult = await send(
    deployment.contracts.diamond,
    buildRedeemCall(fixture.basketId, mintedBasketBalance, account.address, redeemMinimums)
  );
  if (!redeemResult.simulationData) {
    throw new Error("Basket redemption simulation returned no result.");
  }
  const simulatedRedeemAmounts = decodeFunctionResult({
    abi: staticsAbi,
    functionName: "redeem",
    data: redeemResult.simulationData,
  });
  if (simulatedRedeemAmounts.length !== 1 || simulatedRedeemAmounts[0] === 0n) {
    throw new Error("Basket redemption simulation did not prove a nonzero constituent output.");
  }
  const [endingBasketBalance, endingBasketSupply, endingVaultBalance] = await Promise.all([
    publicClient.readContract({
      address: configuredBasket.token,
      abi: basketTokenAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.readContract({
      address: configuredBasket.token,
      abi: basketTokenAbi,
      functionName: "totalSupply",
    }),
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "vaultBalance",
      args: [fixture.basketId, deployment.contracts.dollar],
    }),
  ]);
  if (endingBasketBalance !== 0n || endingBasketSupply !== 0n || endingVaultBalance !== 0n) {
    throw new Error("Basket redemption did not clear the user shares, supply, and backing.");
  }

  console.log(
    "Local protocol integration passed: Dollar lifecycles plus bounded basket mint and redemption confirmed."
  );
} finally {
  anvil.kill("SIGTERM");
}
