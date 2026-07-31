import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BasketStatus,
  basketTokenAbi,
  buildActivateCanonicalPoolCall,
  buildActivateLiquidityPositionCall,
  buildApproveV4PositionCall,
  buildBorrowCall,
  buildBorrowAndProvideLiquidityCall,
  buildCheckpointCanonicalPoolCall,
  buildClaimLiquidityRewardsCall,
  buildClaimRewardsCall,
  buildClosePositionCall,
  buildCreateAndStakeCall,
  buildCreateBasketTransaction,
  buildCreatePositionCall,
  buildDepositBasketCollateralCall,
  buildDepositETHTransaction,
  buildDepositWETHCall,
  buildIncreaseStakedLiquidityCall,
  buildMintCall,
  buildMintBasketCollateralCall,
  buildMintPeggedCall,
  buildMintV4PositionCall,
  buildOptInRewardAssetsCall,
  buildOptOutRewardAssetsCall,
  buildPermit2ApproveCall,
  buildExtendCall,
  buildRecoverCall,
  buildRepayCall,
  buildRedeemCall,
  buildRedeemBasketCollateralCall,
  buildRedeemPeggedCall,
  buildRecombineToETHCall,
  buildRecombineToWETHCall,
  buildUnstakeCall,
  buildStakeLiquidityPositionCall,
  buildUnstakeLiquidityPositionCall,
  buildWithdrawBasketCollateralCall,
  staticsAbi,
  staticsDollarCoreAbi,
  staticsDollarRiskTokenAbi,
  staticsDollarTokenAbi,
  maximumLiquidityForAmounts,
  permit2AllowanceAbi,
  quoteBorrowAndProvideLiquidity,
  v4PositionManagerReadAbi,
  v4StateViewReadAbi,
  wethAbi,
} from "@statics-protocol/sdk";
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionResult,
  encodeFunctionData,
  http,
  parseEventLogs,
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
const fullRange = (spacing) => [
  Math.ceil(-887_272 / spacing) * spacing,
  Math.floor(887_272 / spacing) * spacing,
];
const Q96 = 1n << 96n;
const mockOracleAbi = [
  {
    type: "function",
    name: "setUpdatedAt",
    stateMutability: "nonpayable",
    inputs: [{ name: "updatedAt_", type: "uint256" }],
    outputs: [],
  },
];

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
const recoveryAccount = mnemonicToAccount(mnemonic, { addressIndex: 1 });
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
  const recoveryWalletClient = createWalletClient({
    account: recoveryAccount,
    transport: http(rpcUrl),
  });
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
  const positionCreationFee = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "positionCreationFee",
  });

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
  const [launchBasketSupply, launchVaultBalance] = await Promise.all([
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
  if (
    endingBasketBalance !== 0n ||
    endingBasketSupply !== launchBasketSupply ||
    endingVaultBalance !== launchVaultBalance
  ) {
    throw new Error("Basket redemption did not restore the canonical launch baseline.");
  }

  const createPositionResult = await send(
    deployment.contracts.diamond,
    buildCreatePositionCall(account.address),
    positionCreationFee
  );
  if (!createPositionResult.simulationData) {
    throw new Error("Position creation simulation returned no token ID.");
  }
  const collateralPositionId = decodeFunctionResult({
    abi: staticsAbi,
    functionName: "createPosition",
    data: createPositionResult.simulationData,
  });
  const positionOwner = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "ownerOf",
    args: [collateralPositionId],
  });
  if (positionOwner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("Confirmed PositionNFT creation did not assign the requested owner.");
  }

  const collateralShares = parseEther("0.25");
  const collateralMintQuote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteMint",
    args: [fixture.basketId, collateralShares],
  });
  const collateralMaximums = collateralMintQuote.map(maximum);
  await send(
    deployment.contracts.dollar,
    encodeFunctionData({
      abi: staticsDollarTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, collateralMaximums[0]],
    })
  );
  await send(
    deployment.contracts.diamond,
    buildMintCall(fixture.basketId, collateralShares, account.address, collateralMaximums)
  );
  await send(
    configuredBasket.token,
    encodeFunctionData({
      abi: basketTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, collateralShares],
    })
  );
  const basketAllowance = await publicClient.readContract({
    address: configuredBasket.token,
    abi: basketTokenAbi,
    functionName: "allowance",
    args: [account.address, deployment.contracts.diamond],
  });
  if (basketAllowance !== collateralShares) {
    throw new Error("Basket collateral deposit did not use an exact BasketToken allowance.");
  }
  const collateralDeposit = await send(
    deployment.contracts.diamond,
    buildDepositBasketCollateralCall(collateralPositionId, fixture.basketId, collateralShares)
  );
  const depositedCollateral = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "basketCollateralPosition",
    args: [collateralPositionId, fixture.basketId],
  });
  if (
    depositedCollateral.depositedShares !== collateralShares ||
    depositedCollateral.lockedShares !== 0n
  ) {
    throw new Error("BasketToken deposit did not create the expected unlocked position leg.");
  }
  if (depositedCollateral.withdrawableAfterBlock !== collateralDeposit.receipt.blockNumber + 1n) {
    throw new Error("Basket collateral did not enforce the documented next-block exit.");
  }
  await publicClient.request({ method: "evm_mine" });
  await send(
    deployment.contracts.diamond,
    buildWithdrawBasketCollateralCall(
      collateralPositionId,
      fixture.basketId,
      collateralShares,
      account.address
    )
  );

  const directShares = parseEther("0.25");
  const directQuote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteMint",
    args: [fixture.basketId, directShares],
  });
  const directMaximums = directQuote.map(maximum);
  await send(
    deployment.contracts.dollar,
    encodeFunctionData({
      abi: staticsDollarTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, directMaximums[0]],
    })
  );
  const directMint = await send(
    deployment.contracts.diamond,
    buildMintBasketCollateralCall(
      collateralPositionId,
      fixture.basketId,
      directShares,
      directMaximums
    )
  );
  if (!directMint.simulationData) {
    throw new Error("Direct collateral mint simulation returned no constituent amounts.");
  }
  const simulatedDirectInputs = decodeFunctionResult({
    abi: staticsAbi,
    functionName: "mintBasketCollateral",
    data: directMint.simulationData,
  });
  if (simulatedDirectInputs.length !== 1 || simulatedDirectInputs[0] === 0n) {
    throw new Error("Direct collateral mint did not prove a bounded constituent transfer.");
  }
  const directRedeemQuote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteRedeem",
    args: [fixture.basketId, directShares],
  });
  await publicClient.request({ method: "evm_mine" });
  const directRedeem = await send(
    deployment.contracts.diamond,
    buildRedeemBasketCollateralCall(
      collateralPositionId,
      fixture.basketId,
      directShares,
      account.address,
      directRedeemQuote.map(minimum)
    )
  );
  if (!directRedeem.simulationData) {
    throw new Error("Direct collateral redemption simulation returned no outputs.");
  }
  const clearedCollateral = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "basketCollateralPosition",
    args: [collateralPositionId, fixture.basketId],
  });
  if (clearedCollateral.depositedShares !== 0n || clearedCollateral.lockedShares !== 0n) {
    throw new Error("Collateral withdrawal and redemption did not clear the position leg.");
  }
  const collateralLegCount = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "activeLegCount",
    args: [collateralPositionId],
  });
  if (collateralLegCount !== 0n) {
    throw new Error("Cleared basket collateral left an unexpected active position leg.");
  }
  await send(deployment.contracts.diamond, buildClosePositionCall(collateralPositionId));
  const closedOwner = await publicClient
    .readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "ownerOf",
      args: [collateralPositionId],
    })
    .catch(() => null);
  if (closedOwner !== null) {
    throw new Error("Closing an empty PositionNFT did not burn its ownership record.");
  }

  const createLoanPosition = await send(
    deployment.contracts.diamond,
    buildCreatePositionCall(account.address),
    positionCreationFee
  );
  if (!createLoanPosition.simulationData) {
    throw new Error("Loan PositionNFT creation simulation returned no token ID.");
  }
  const loanPositionId = decodeFunctionResult({
    abi: staticsAbi,
    functionName: "createPosition",
    data: createLoanPosition.simulationData,
  });
  const loanDepositShares = parseEther("0.2");
  const loanDepositQuote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteMint",
    args: [fixture.basketId, loanDepositShares],
  });
  const loanDepositMaximums = loanDepositQuote.map(maximum);
  await send(
    deployment.contracts.dollar,
    encodeFunctionData({
      abi: staticsDollarTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, loanDepositMaximums[0]],
    })
  );
  await send(
    deployment.contracts.diamond,
    buildMintBasketCollateralCall(
      loanPositionId,
      fixture.basketId,
      loanDepositShares,
      loanDepositMaximums
    )
  );

  const borrowShares = parseEther("0.08");
  const borrowQuote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteBorrow",
    args: [fixture.basketId, borrowShares],
  });
  const principalBalanceBefore = await publicClient.readContract({
    address: deployment.contracts.dollar,
    abi: staticsDollarTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  const firstBorrow = await send(
    deployment.contracts.diamond,
    buildBorrowCall(loanPositionId, fixture.basketId, borrowShares, account.address)
  );
  if (!firstBorrow.simulationData) {
    throw new Error("Loan origination simulation returned no loan result.");
  }
  const [firstLoanId, simulatedPrincipals] = decodeFunctionResult({
    abi: staticsAbi,
    functionName: "borrow",
    data: firstBorrow.simulationData,
  });
  if (
    simulatedPrincipals.length !== borrowQuote.principals.length ||
    simulatedPrincipals.some((amount, index) => amount !== borrowQuote.principals[index])
  ) {
    throw new Error("Loan origination simulation did not match the authoritative borrow quote.");
  }
  const originatedEvents = parseEventLogs({
    abi: staticsAbi,
    eventName: "LoanOriginated",
    logs: firstBorrow.receipt.logs,
    strict: true,
  });
  if (
    !originatedEvents.some(
      (event) =>
        event.args.loanId === firstLoanId &&
        event.args.positionId === loanPositionId &&
        event.args.basketId === fixture.basketId
    )
  ) {
    throw new Error("Confirmed loan origination did not emit its indexed lifecycle event.");
  }
  const [firstLoan, firstBorrowCollateral, principalBalanceAfter] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "loan",
      args: [firstLoanId],
    }),
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "basketCollateralPosition",
      args: [loanPositionId, fixture.basketId],
    }),
    publicClient.readContract({
      address: deployment.contracts.dollar,
      abi: staticsDollarTokenAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);
  if (
    firstLoan.collateralShares !== borrowQuote.collateralShares ||
    firstBorrowCollateral.lockedShares !== borrowQuote.collateralShares ||
    principalBalanceAfter !== principalBalanceBefore + borrowQuote.principals[0]
  ) {
    throw new Error("Confirmed loan state, locked collateral, or principal receipt was incorrect.");
  }

  const extensionQuote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteExtension",
    args: [firstLoanId],
  });
  if (extensionQuote[1].length !== 1 || extensionQuote[1][0] === 0n) {
    throw new Error("Local extension quote did not return one nonzero exact fee.");
  }
  await send(
    deployment.contracts.dollar,
    encodeFunctionData({
      abi: staticsDollarTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, extensionQuote[1][0]],
    })
  );
  const extensionAllowance = await publicClient.readContract({
    address: deployment.contracts.dollar,
    abi: staticsDollarTokenAbi,
    functionName: "allowance",
    args: [account.address, deployment.contracts.diamond],
  });
  if (extensionAllowance !== extensionQuote[1][0]) {
    throw new Error("Loan extension did not establish the exact quoted fee allowance.");
  }
  const extensionResult = await send(
    deployment.contracts.diamond,
    buildExtendCall(firstLoanId, extensionQuote[1])
  );
  const extendedEvents = parseEventLogs({
    abi: staticsAbi,
    eventName: "LoanExtended",
    logs: extensionResult.receipt.logs,
    strict: true,
  });
  const extendedLoan = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "loan",
    args: [firstLoanId],
  });
  if (
    extendedEvents.length !== 1 ||
    extendedLoan.maturity !== firstLoan.maturity + configuredBasket.loanDuration ||
    extendedLoan.principals.some((principal, index) => principal !== firstLoan.principals[index])
  ) {
    throw new Error("Loan extension did not preserve principals and add one configured duration.");
  }

  await send(
    deployment.contracts.dollar,
    encodeFunctionData({
      abi: staticsDollarTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, extendedLoan.principals[0]],
    })
  );
  const repayAllowance = await publicClient.readContract({
    address: deployment.contracts.dollar,
    abi: staticsDollarTokenAbi,
    functionName: "allowance",
    args: [account.address, deployment.contracts.diamond],
  });
  if (repayAllowance !== extendedLoan.principals[0]) {
    throw new Error("Loan repayment did not establish the exact principal allowance.");
  }
  const repayResult = await send(deployment.contracts.diamond, buildRepayCall(firstLoanId));
  const repaidEvents = parseEventLogs({
    abi: staticsAbi,
    eventName: "LoanRepaid",
    logs: repayResult.receipt.logs,
    strict: true,
  });
  const repaidLoan = await publicClient
    .readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "loan",
      args: [firstLoanId],
    })
    .then(() => true)
    .catch(() => false);
  const repaidCollateral = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "basketCollateralPosition",
    args: [loanPositionId, fixture.basketId],
  });
  if (
    repaidLoan ||
    repaidEvents.length !== 1 ||
    repaidCollateral.lockedShares !== 0n ||
    repaidCollateral.depositedShares !== loanDepositShares - borrowQuote.feeShares
  ) {
    throw new Error("Confirmed repayment did not delete the loan and unlock its collateral.");
  }

  const recoveryBorrowQuote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteBorrow",
    args: [fixture.basketId, borrowShares],
  });
  const secondBorrow = await send(
    deployment.contracts.diamond,
    buildBorrowCall(loanPositionId, fixture.basketId, borrowShares, account.address)
  );
  if (!secondBorrow.simulationData) {
    throw new Error("Recovery-loan simulation returned no loan result.");
  }
  const [secondLoanId] = decodeFunctionResult({
    abi: staticsAbi,
    functionName: "borrow",
    data: secondBorrow.simulationData,
  });
  const secondLoan = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "loan",
    args: [secondLoanId],
  });
  await publicClient.request({
    method: "evm_setNextBlockTimestamp",
    params: [Number(secondLoan.maturity) + 3_601],
  });
  await publicClient.request({ method: "evm_mine" });
  const recoveryQuote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteRecovery",
    args: [secondLoanId],
  });
  const [callerBalanceBefore, treasuryBefore, recoveryCollateralBefore] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.dollar,
      abi: staticsDollarTokenAbi,
      functionName: "balanceOf",
      args: [recoveryAccount.address],
    }),
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "treasuryAccrued",
      args: [deployment.contracts.dollar],
    }),
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "basketCollateralPosition",
      args: [loanPositionId, fixture.basketId],
    }),
  ]);
  const recoveryData = buildRecoverCall(secondLoanId);
  await publicClient.call({
    account: recoveryAccount.address,
    to: deployment.contracts.diamond,
    data: recoveryData,
  });
  const recoveryHash = await recoveryWalletClient.sendTransaction({
    to: deployment.contracts.diamond,
    data: recoveryData,
  });
  const recoveryReceipt = await publicClient.waitForTransactionReceipt({ hash: recoveryHash });
  if (recoveryReceipt.status !== "success") {
    throw new Error(`Permissionless local recovery ${recoveryHash} reverted.`);
  }
  const recoveredEvents = parseEventLogs({
    abi: staticsAbi,
    eventName: "LoanRecovered",
    logs: recoveryReceipt.logs,
    strict: true,
  });
  const recoveredLoan = await publicClient
    .readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "loan",
      args: [secondLoanId],
    })
    .then(() => true)
    .catch(() => false);
  const [callerBalanceAfter, treasuryAfter, recoveryCollateralAfter, outstandingAfter] =
    await Promise.all([
      publicClient.readContract({
        address: deployment.contracts.dollar,
        abi: staticsDollarTokenAbi,
        functionName: "balanceOf",
        args: [recoveryAccount.address],
      }),
      publicClient.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "treasuryAccrued",
        args: [deployment.contracts.dollar],
      }),
      publicClient.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "basketCollateralPosition",
        args: [loanPositionId, fixture.basketId],
      }),
      publicClient.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "outstandingPrincipal",
        args: [fixture.basketId, deployment.contracts.dollar],
      }),
    ]);
  if (
    recoveredLoan ||
    recoveredEvents.length !== 1 ||
    recoveredEvents[0].args.caller.toLowerCase() !== recoveryAccount.address.toLowerCase() ||
    callerBalanceAfter !== callerBalanceBefore + recoveryQuote.callerAmounts[0] ||
    treasuryAfter !== treasuryBefore + recoveryQuote.protocolAmounts[0] ||
    outstandingAfter !== 0n ||
    recoveryCollateralAfter.lockedShares !==
      recoveryCollateralBefore.lockedShares - recoveryBorrowQuote.collateralShares ||
    recoveryCollateralAfter.depositedShares !==
      recoveryCollateralBefore.depositedShares - recoveryQuote.burnShares
  ) {
    throw new Error(
      "Permissionless recovery did not delete the loan and distribute its bounded penalty."
    );
  }

  await publicClient.request({ method: "evm_increaseTime", params: [3_600] });
  await publicClient.request({ method: "evm_mine" });
  await send(
    deployment.contracts.diamond,
    buildCheckpointCanonicalPoolCall(fixture.basketId, deployment.contracts.dollar)
  );
  await send(
    deployment.contracts.diamond,
    buildActivateCanonicalPoolCall(fixture.basketId, deployment.contracts.dollar)
  );
  const canonicalPool = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "canonicalPool",
    args: [fixture.basketId, deployment.contracts.dollar],
  });
  if (canonicalPool.status !== 2) {
    throw new Error("Local canonical pool did not complete its real warmup and activation.");
  }
  const poolKey = {
    currency0: canonicalPool.currency0,
    currency1: canonicalPool.currency1,
    fee: canonicalPool.lpFee,
    tickSpacing: canonicalPool.tickSpacing,
    hooks: canonicalPool.hook,
  };
  const slot0 = await publicClient.readContract({
    address: deployment.liquidity.contracts.stateView,
    abi: v4StateViewReadAbi,
    functionName: "getSlot0",
    args: [canonicalPool.poolId],
  });
  const lpBasketShares = parseEther("0.02");
  const lpBasketQuote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteMint",
    args: [fixture.basketId, lpBasketShares],
  });
  await send(
    deployment.contracts.dollar,
    encodeFunctionData({
      abi: staticsDollarTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, maximum(lpBasketQuote[0])],
    })
  );
  await send(
    deployment.contracts.diamond,
    buildMintCall(fixture.basketId, lpBasketShares, account.address, lpBasketQuote.map(maximum))
  );
  const poolTokens = [
    canonicalPool.currency0.toLowerCase() === configuredBasket.token.toLowerCase()
      ? configuredBasket.token
      : deployment.contracts.dollar,
    canonicalPool.currency1.toLowerCase() === configuredBasket.token.toLowerCase()
      ? configuredBasket.token
      : deployment.contracts.dollar,
  ];
  const walletLpMaximums = [parseEther("0.005"), parseEther("0.005")];
  const [lpTickLower, lpTickUpper] = fullRange(canonicalPool.tickSpacing);
  const walletLpLiquidity =
    (maximumLiquidityForAmounts(
      slot0[0],
      lpTickLower,
      lpTickUpper,
      walletLpMaximums[0],
      walletLpMaximums[1]
    ) *
      9_950n) /
    BPS;
  const permitExpiration = Number((await publicClient.getBlock()).timestamp) + 3_600;
  for (let index = 0; index < poolTokens.length; index += 1) {
    await send(
      poolTokens[index],
      encodeFunctionData({
        abi: basketTokenAbi,
        functionName: "approve",
        args: [deployment.liquidity.contracts.permit2, walletLpMaximums[index]],
      })
    );
    await send(
      deployment.liquidity.contracts.permit2,
      buildPermit2ApproveCall(
        poolTokens[index],
        deployment.liquidity.contracts.positionManager,
        walletLpMaximums[index],
        permitExpiration
      )
    );
    const permitAllowance = await publicClient.readContract({
      address: deployment.liquidity.contracts.permit2,
      abi: permit2AllowanceAbi,
      functionName: "allowance",
      args: [account.address, poolTokens[index], deployment.liquidity.contracts.positionManager],
    });
    if (permitAllowance[0] !== walletLpMaximums[index] || permitAllowance[1] !== permitExpiration) {
      throw new Error("Local LP creation did not establish its bounded Permit2 allowance.");
    }
  }
  const walletLpTokenId = await publicClient.readContract({
    address: deployment.liquidity.contracts.positionManager,
    abi: v4PositionManagerReadAbi,
    functionName: "nextTokenId",
  });
  await send(
    deployment.liquidity.contracts.positionManager,
    buildMintV4PositionCall({
      poolKey,
      tickLower: lpTickLower,
      tickUpper: lpTickUpper,
      liquidity: walletLpLiquidity,
      amount0Max: walletLpMaximums[0],
      amount1Max: walletLpMaximums[1],
      recipient: account.address,
      deadline: BigInt(permitExpiration),
    })
  );
  const [walletLpOwner, walletLpAmount] = await Promise.all([
    publicClient.readContract({
      address: deployment.liquidity.contracts.positionManager,
      abi: v4PositionManagerReadAbi,
      functionName: "ownerOf",
      args: [walletLpTokenId],
    }),
    publicClient.readContract({
      address: deployment.liquidity.contracts.positionManager,
      abi: v4PositionManagerReadAbi,
      functionName: "getPositionLiquidity",
      args: [walletLpTokenId],
    }),
  ]);
  if (
    walletLpOwner.toLowerCase() !== account.address.toLowerCase() ||
    walletLpAmount !== walletLpLiquidity
  ) {
    throw new Error("Wallet-funded PositionManager NFT did not match its reviewed liquidity.");
  }

  await send(
    deployment.liquidity.contracts.positionManager,
    buildApproveV4PositionCall(deployment.contracts.diamond, walletLpTokenId)
  );
  await send(
    deployment.contracts.diamond,
    buildStakeLiquidityPositionCall(loanPositionId, walletLpTokenId)
  );
  await publicClient.request({ method: "evm_mine" });
  await send(deployment.contracts.diamond, buildActivateLiquidityPositionCall(walletLpTokenId));
  const increaseMaximums = [parseEther("0.002"), parseEther("0.002")];
  const increaseLiquidity =
    (maximumLiquidityForAmounts(
      slot0[0],
      lpTickLower,
      lpTickUpper,
      increaseMaximums[0],
      increaseMaximums[1]
    ) *
      9_950n) /
    BPS;
  for (let index = 0; index < poolTokens.length; index += 1) {
    await send(
      poolTokens[index],
      encodeFunctionData({
        abi: basketTokenAbi,
        functionName: "approve",
        args: [deployment.contracts.diamond, increaseMaximums[index]],
      })
    );
  }
  const increaseResult = await send(
    deployment.contracts.diamond,
    buildIncreaseStakedLiquidityCall(
      loanPositionId,
      walletLpTokenId,
      {
        liquidityDelta: increaseLiquidity,
        amount0Max: increaseMaximums[0],
        amount1Max: increaseMaximums[1],
        deadline: BigInt(permitExpiration),
      },
      account.address
    )
  );
  const increasedEvents = parseEventLogs({
    abi: staticsAbi,
    eventName: "StakedLiquidityIncreased",
    logs: increaseResult.receipt.logs,
    strict: true,
  });
  const increasedLiquidity = await publicClient.readContract({
    address: deployment.liquidity.contracts.positionManager,
    abi: v4PositionManagerReadAbi,
    functionName: "getPositionLiquidity",
    args: [walletLpTokenId],
  });
  if (
    increasedEvents.length !== 1 ||
    increasedLiquidity !== walletLpLiquidity + increaseLiquidity
  ) {
    throw new Error("Staked LP NFT increase did not update its real PositionManager liquidity.");
  }
  // Local-only v4-core harness: production users swap through a venue router, but the
  // rehearsal needs one real PoolManager swap to prove fee accrual without external state.
  const swapArtifact = JSON.parse(
    readFileSync(resolve(protocolRoot, "out/PoolSwapTest.sol/PoolSwapTest.json"), "utf8")
  );
  const swapRouterHash = await walletClient.deployContract({
    abi: swapArtifact.abi,
    bytecode: swapArtifact.bytecode.object,
    args: [deployment.liquidity.contracts.poolManager],
  });
  const swapRouterReceipt = await publicClient.waitForTransactionReceipt({
    hash: swapRouterHash,
  });
  if (swapRouterReceipt.status !== "success" || !swapRouterReceipt.contractAddress) {
    throw new Error("Ephemeral v4 swap rehearsal router did not deploy.");
  }
  const swapAmount = parseEther("0.000001");
  await send(
    poolTokens[0],
    encodeFunctionData({
      abi: basketTokenAbi,
      functionName: "approve",
      args: [swapRouterReceipt.contractAddress, swapAmount],
    })
  );
  await send(
    swapRouterReceipt.contractAddress,
    encodeFunctionData({
      abi: swapArtifact.abi,
      functionName: "swap",
      args: [
        poolKey,
        {
          zeroForOne: true,
          amountSpecified: -swapAmount,
          sqrtPriceLimitX96: 4_295_128_740n,
        },
        { takeClaims: false, settleUsingBurn: false },
        "0x",
      ],
    })
  );
  const pendingLpRewards = await publicClient.readContract({
    account: account.address,
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "pendingLiquidityRewards",
    args: [loanPositionId, walletLpTokenId],
  });
  if (pendingLpRewards[1] === 0n && pendingLpRewards[3] === 0n) {
    throw new Error("A real canonical swap did not accrue LP NFT rewards.");
  }
  const lpRewardBalancesBefore = await Promise.all([
    publicClient.readContract({
      address: pendingLpRewards[0],
      abi: basketTokenAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.readContract({
      address: pendingLpRewards[2],
      abi: basketTokenAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);
  const lpClaimResult = await send(
    deployment.contracts.diamond,
    buildClaimLiquidityRewardsCall(
      loanPositionId,
      walletLpTokenId,
      account.address,
      pendingLpRewards[1],
      pendingLpRewards[3]
    )
  );
  const lpClaimEvents = parseEventLogs({
    abi: staticsAbi,
    eventName: "LiquidityRewardClaimed",
    logs: lpClaimResult.receipt.logs,
    strict: true,
  });
  const [pendingLpRewardsAfter, lpRewardBalancesAfter] = await Promise.all([
    publicClient.readContract({
      account: account.address,
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "pendingLiquidityRewards",
      args: [loanPositionId, walletLpTokenId],
    }),
    Promise.all([
      publicClient.readContract({
        address: pendingLpRewards[0],
        abi: basketTokenAbi,
        functionName: "balanceOf",
        args: [account.address],
      }),
      publicClient.readContract({
        address: pendingLpRewards[2],
        abi: basketTokenAbi,
        functionName: "balanceOf",
        args: [account.address],
      }),
    ]),
  ]);
  if (
    lpClaimEvents.length === 0 ||
    pendingLpRewardsAfter[1] !== 0n ||
    pendingLpRewardsAfter[3] !== 0n ||
    lpRewardBalancesAfter[0] - lpRewardBalancesBefore[0] < pendingLpRewards[1] ||
    lpRewardBalancesAfter[1] - lpRewardBalancesBefore[1] < pendingLpRewards[3]
  ) {
    throw new Error("LP reward claim did not clear and transfer its reviewed outputs.");
  }
  await send(
    deployment.contracts.diamond,
    buildUnstakeLiquidityPositionCall(loanPositionId, walletLpTokenId, account.address)
  );
  const returnedLpOwner = await publicClient.readContract({
    address: deployment.liquidity.contracts.positionManager,
    abi: v4PositionManagerReadAbi,
    functionName: "ownerOf",
    args: [walletLpTokenId],
  });
  if (returnedLpOwner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("Unstaking did not return the LP NFT to its wallet owner.");
  }

  const combinedShares = parseEther("0.04");
  const combinedLiquidity =
    (maximumLiquidityForAmounts(
      slot0[0],
      lpTickLower,
      lpTickUpper,
      parseEther("0.002"),
      parseEther("0.002")
    ) *
      9_500n) /
    BPS;
  const combinedBasketSupply = await publicClient.readContract({
    address: configuredBasket.token,
    abi: basketTokenAbi,
    functionName: "totalSupply",
  });
  const combinedSnapshot = {
    basketId: fixture.basketId,
    basketToken: configuredBasket.token,
    status: BasketStatus.Active,
    totalSupply: combinedBasketSupply,
    mintFeeTiers: configuredBasket.mintFeeTiers,
    redemptionFeeTiers: configuredBasket.redemptionFeeTiers,
    originationFeeBps: BigInt(configuredBasket.originationFeeBps),
    extensionFeeBps: BigInt(configuredBasket.extensionFeeBps),
    recoveryPenaltyBps: BigInt(configuredBasket.recoveryPenaltyBps),
    ltvBps: BigInt(configuredBasket.ltvBps),
    constituents: [
      {
        asset: deployment.contracts.dollar,
        bundleAmount: configuredBasket.bundleAmounts[0],
        vaultBalance: await publicClient.readContract({
          address: deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "vaultBalance",
          args: [fixture.basketId, deployment.contracts.dollar],
        }),
      },
    ],
  };
  const combinedDeadline = BigInt(permitExpiration);
  const combinedQuote = quoteBorrowAndProvideLiquidity(
    combinedSnapshot,
    combinedShares,
    [
      {
        asset: deployment.contracts.dollar,
        currency0: canonicalPool.currency0,
        currency1: canonicalPool.currency1,
        sqrtPriceX96: slot0[0],
        tickLower: lpTickLower,
        tickUpper: lpTickUpper,
        liquidity: combinedLiquidity,
        deadline: combinedDeadline,
      },
    ],
    50n
  );
  const combinedResult = await send(
    deployment.contracts.diamond,
    buildBorrowAndProvideLiquidityCall(
      loanPositionId,
      fixture.basketId,
      combinedShares,
      combinedQuote.pools,
      account.address
    )
  );
  if (!combinedResult.simulationData) {
    throw new Error("Borrow-to-liquidity simulation returned no result.");
  }
  const [combinedLoanId, combinedTokenIds] = decodeFunctionResult({
    abi: staticsAbi,
    functionName: "borrowAndProvideLiquidity",
    data: combinedResult.simulationData,
  });
  const [combinedLoan, combinedLpOwner] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "loan",
      args: [combinedLoanId],
    }),
    publicClient.readContract({
      address: deployment.liquidity.contracts.positionManager,
      abi: v4PositionManagerReadAbi,
      functionName: "ownerOf",
      args: [combinedTokenIds[0]],
    }),
  ]);
  if (
    combinedTokenIds.length !== 1 ||
    combinedLoan.collateralShares !== combinedQuote.borrow.collateralShares ||
    combinedLpOwner.toLowerCase() !== account.address.toLowerCase()
  ) {
    throw new Error(
      "Atomic borrow-to-liquidity did not create its verified loan and wallet LP NFT."
    );
  }
  await send(
    deployment.contracts.dollar,
    encodeFunctionData({
      abi: staticsDollarTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, combinedLoan.principals[0]],
    })
  );
  await send(deployment.contracts.diamond, buildRepayCall(combinedLoanId));

  const wethBasketId = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "basketCount",
  });
  const currentCreationFee = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "creationFee",
  });
  const wethLaunchMaximum = parseEther("10");
  const wethBeforeLaunch = await publicClient.readContract({
    address: deployment.contracts.weth,
    abi: wethAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (wethBeforeLaunch < wethLaunchMaximum) {
    await send(
      deployment.contracts.weth,
      encodeFunctionData({ abi: wethAbi, functionName: "deposit" }),
      wethLaunchMaximum - wethBeforeLaunch
    );
  }
  await send(
    deployment.contracts.weth,
    encodeFunctionData({
      abi: wethAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, wethLaunchMaximum],
    })
  );
  const wethBasketCreation = buildCreateBasketTransaction(
    {
      name: "Local Wrapped Ether Reserve",
      symbol: "lwETH",
      assets: [deployment.contracts.weth],
      bundleAmounts: [parseEther("1")],
      mintFeeTiers: [{ minActionShares: 0n, feeShares: parseEther("0.001") }],
      redemptionFeeTiers: [{ minActionShares: 0n, feeShares: parseEther("0.001") }],
      flashFeeBps: 5,
      originationFeeBps: 100,
      extensionFeeBps: 25,
      ltvBps: 7_500,
      recoveryPenaltyBps: 500,
      loanDuration: 30 * 24 * 60 * 60,
    },
    [{ sqrtPriceAssetPerBasketX96: Q96, pairedAssetAmount: parseEther("1") }],
    [wethLaunchMaximum],
    (await publicClient.getBlock()).timestamp + 3_600n,
    currentCreationFee
  );
  const wethBasketCreationResult = await send(
    deployment.contracts.diamond,
    wethBasketCreation.data,
    wethBasketCreation.value
  );
  const wethBasketEvents = parseEventLogs({
    abi: staticsAbi,
    eventName: "BasketCreated",
    logs: wethBasketCreationResult.receipt.logs,
    strict: true,
  });
  const wethBasketEvent = wethBasketEvents.find((event) => event.args.basketId === wethBasketId);
  if (!wethBasketEvent) {
    throw new Error("Permissionless WETH basket creation did not emit its registry event.");
  }
  const configuredWethBasket = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "basket",
    args: [wethBasketId],
  });
  if (
    configuredWethBasket.assets.length !== 1 ||
    configuredWethBasket.assets[0].toLowerCase() !== deployment.contracts.weth.toLowerCase() ||
    configuredWethBasket.token.toLowerCase() !== wethBasketEvent.args.token.toLowerCase()
  ) {
    throw new Error("Confirmed permissionless WETH basket state does not match its review.");
  }

  const stakingToken = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "stakingToken",
  });
  if (stakingToken.toLowerCase() !== deployment.contracts.weth.toLowerCase()) {
    throw new Error("Local reward fixture did not expose verified WETH as its staking token.");
  }
  const stakeAmount = parseEther("1");
  const wethBeforeStake = await publicClient.readContract({
    address: deployment.contracts.weth,
    abi: wethAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (wethBeforeStake < stakeAmount) {
    await send(
      deployment.contracts.weth,
      encodeFunctionData({ abi: wethAbi, functionName: "deposit" }),
      stakeAmount - wethBeforeStake
    );
  }
  await send(
    deployment.contracts.weth,
    encodeFunctionData({
      abi: wethAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, stakeAmount],
    })
  );
  const stakeAllowance = await publicClient.readContract({
    address: deployment.contracts.weth,
    abi: wethAbi,
    functionName: "allowance",
    args: [account.address, deployment.contracts.diamond],
  });
  if (stakeAllowance !== stakeAmount) {
    throw new Error("Global staking did not establish the exact WETH allowance.");
  }
  const createStakeResult = await send(
    deployment.contracts.diamond,
    buildCreateAndStakeCall(stakeAmount, account.address, [
      deployment.contracts.dollar,
      deployment.contracts.weth,
    ]),
    positionCreationFee
  );
  if (!createStakeResult.simulationData) {
    throw new Error("Create-and-stake simulation returned no PositionNFT ID.");
  }
  const stakingPositionId = decodeFunctionResult({
    abi: staticsAbi,
    functionName: "createAndStake",
    data: createStakeResult.simulationData,
  });
  const initialSelections = await publicClient.readContract({
    account: account.address,
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "positionRewardAssets",
    args: [stakingPositionId],
  });
  if (
    initialSelections.length !== 2 ||
    initialSelections[0].toLowerCase() !== deployment.contracts.dollar.toLowerCase() ||
    initialSelections[1].toLowerCase() !== deployment.contracts.weth.toLowerCase()
  ) {
    throw new Error("Atomic create-and-stake did not persist both selected reward assets.");
  }
  const activationSelections = await Promise.all(
    initialSelections.map((asset) =>
      publicClient.readContract({
        account: account.address,
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "rewardSelection",
        args: [stakingPositionId, asset],
      })
    )
  );
  const activationTimestamp = activationSelections.reduce(
    (latest, selection) => (selection.eligibleAt > latest ? selection.eligibleAt : latest),
    0
  );
  await publicClient.request({
    method: "evm_setNextBlockTimestamp",
    params: [activationTimestamp + 1],
  });
  await publicClient.request({ method: "evm_mine" });

  const mintForReward = async (shares) => {
    const quote = await publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "quoteMint",
      args: [fixture.basketId, shares],
    });
    const maximums = quote.map(maximum);
    await send(
      deployment.contracts.dollar,
      encodeFunctionData({
        abi: staticsDollarTokenAbi,
        functionName: "approve",
        args: [deployment.contracts.diamond, maximums[0]],
      })
    );
    await send(
      deployment.contracts.diamond,
      buildMintCall(fixture.basketId, shares, account.address, maximums)
    );
  };

  await mintForReward(parseEther("0.1"));
  const wethRewardShares = parseEther("0.1");
  const wethRewardQuote = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteMint",
    args: [wethBasketId, wethRewardShares],
  });
  const wethRewardMaximums = wethRewardQuote.map(maximum);
  const wethRewardBalance = await publicClient.readContract({
    address: deployment.contracts.weth,
    abi: wethAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (wethRewardBalance < wethRewardMaximums[0]) {
    await send(
      deployment.contracts.weth,
      encodeFunctionData({ abi: wethAbi, functionName: "deposit" }),
      wethRewardMaximums[0] - wethRewardBalance
    );
  }
  await send(
    deployment.contracts.weth,
    encodeFunctionData({
      abi: wethAbi,
      functionName: "approve",
      args: [deployment.contracts.diamond, wethRewardMaximums[0]],
    })
  );
  await send(
    deployment.contracts.diamond,
    buildMintCall(wethBasketId, wethRewardShares, account.address, wethRewardMaximums)
  );

  const selectedRewards = [deployment.contracts.dollar, deployment.contracts.weth];
  const pendingBothAssets = await publicClient.readContract({
    account: account.address,
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "pendingRewards",
    args: [stakingPositionId, selectedRewards],
  });
  if (pendingBothAssets.some((pending) => pending === 0n)) {
    throw new Error("Fee-bearing mints did not accrue both selected reward assets.");
  }
  const selectedReward = [deployment.contracts.dollar];
  const pendingBeforeOptOut = await publicClient.readContract({
    account: account.address,
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "pendingRewards",
    args: [stakingPositionId, selectedReward],
  });
  if (pendingBeforeOptOut[0] === 0n) {
    throw new Error("A confirmed fee-bearing basket mint did not accrue selected Dollar rewards.");
  }
  await send(
    deployment.contracts.diamond,
    buildOptOutRewardAssetsCall(stakingPositionId, selectedReward)
  );
  const pendingAfterOptOut = await publicClient.readContract({
    account: account.address,
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "pendingRewards",
    args: [stakingPositionId, selectedReward],
  });
  if (pendingAfterOptOut[0] !== pendingBeforeOptOut[0]) {
    throw new Error("Reward opt-out did not preserve already earned Dollar rewards.");
  }
  await mintForReward(parseEther("0.1"));
  const pendingAfterFutureFee = await publicClient.readContract({
    account: account.address,
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "pendingRewards",
    args: [stakingPositionId, selectedReward],
  });
  if (pendingAfterFutureFee[0] !== pendingAfterOptOut[0]) {
    throw new Error("An opted-out PositionNFT continued accruing future Dollar rewards.");
  }
  await send(
    deployment.contracts.diamond,
    buildOptInRewardAssetsCall(stakingPositionId, selectedReward)
  );
  const claimMinimums = await publicClient.readContract({
    account: account.address,
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "pendingRewards",
    args: [stakingPositionId, selectedRewards],
  });
  const rewardBalancesBefore = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.dollar,
      abi: staticsDollarTokenAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.readContract({
      address: deployment.contracts.weth,
      abi: wethAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);
  const claimResult = await send(
    deployment.contracts.diamond,
    buildClaimRewardsCall(stakingPositionId, selectedRewards, account.address, claimMinimums)
  );
  if (!claimResult.simulationData) {
    throw new Error("Multi-asset reward claim simulation returned no outputs.");
  }
  const simulatedClaim = decodeFunctionResult({
    abi: staticsAbi,
    functionName: "claimRewards",
    data: claimResult.simulationData,
  });
  const claimedEvents = parseEventLogs({
    abi: staticsAbi,
    eventName: "RewardClaimed",
    logs: claimResult.receipt.logs,
    strict: true,
  }).filter((event) => event.args.positionId === stakingPositionId);
  const [pendingAfterClaim, rewardBalancesAfter] = await Promise.all([
    publicClient.readContract({
      account: account.address,
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "pendingRewards",
      args: [stakingPositionId, selectedRewards],
    }),
    Promise.all([
      publicClient.readContract({
        address: deployment.contracts.dollar,
        abi: staticsDollarTokenAbi,
        functionName: "balanceOf",
        args: [account.address],
      }),
      publicClient.readContract({
        address: deployment.contracts.weth,
        abi: wethAbi,
        functionName: "balanceOf",
        args: [account.address],
      }),
    ]),
  ]);
  if (
    simulatedClaim.some((claimed, index) => claimed < claimMinimums[index]) ||
    claimedEvents.length !== 2 ||
    pendingAfterClaim.some((pending) => pending !== 0n) ||
    rewardBalancesAfter.some(
      (balance, index) => balance - rewardBalancesBefore[index] < claimMinimums[index]
    )
  ) {
    throw new Error("Multi-asset reward claim did not clear and transfer both reviewed assets.");
  }
  const restakedPosition = await publicClient.readContract({
    account: account.address,
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "stakePosition",
    args: [stakingPositionId],
  });
  const latestBlock = await publicClient.getBlock({ blockTag: "latest" });
  if (restakedPosition.unstakeAvailableAt <= latestBlock.timestamp) {
    throw new Error("Reward opt-in did not restart the authoritative onchain cooldown.");
  }
  await publicClient.request({ method: "evm_increaseTime", params: [86_400] });
  await publicClient.request({ method: "evm_mine" });
  await send(
    deployment.contracts.diamond,
    buildUnstakeCall(stakingPositionId, stakeAmount, account.address)
  );
  const [endingStake, endingSelections, endingStakeBalance] = await Promise.all([
    publicClient.readContract({
      account: account.address,
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "stakePosition",
      args: [stakingPositionId],
    }),
    publicClient.readContract({
      account: account.address,
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "positionRewardAssets",
      args: [stakingPositionId],
    }),
    publicClient.readContract({
      address: deployment.contracts.weth,
      abi: wethAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);
  if (
    endingStake.stakedBalance !== 0n ||
    endingSelections.length !== 0 ||
    endingStakeBalance < stakeAmount
  ) {
    throw new Error("Full unstake did not return WETH and clear active reward selections.");
  }
  const stakingLegCount = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "activeLegCount",
    args: [stakingPositionId],
  });
  if (stakingLegCount !== 0n) {
    throw new Error("Claimed rewards and full unstake did not clear the PositionNFT active leg.");
  }
  await send(deployment.contracts.diamond, buildClosePositionCall(stakingPositionId));
  const closedStakingOwner = await publicClient
    .readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "ownerOf",
      args: [stakingPositionId],
    })
    .catch(() => null);
  if (closedStakingOwner !== null) {
    throw new Error("Claimed and unstaked PositionNFT did not close cleanly.");
  }

  const currentBlock = await publicClient.getBlock();
  for (const oracle of [deployment.contracts.oracle, deployment.pegged.oracle]) {
    await send(
      oracle,
      encodeFunctionData({
        abi: mockOracleAbi,
        functionName: "setUpdatedAt",
        args: [currentBlock.timestamp],
      })
    );
  }

  const peggedProfileId = BigInt(deployment.pegged.profileId);
  const peggedAmount = parseEther("10");
  const peggedMintPreview = await publicClient.readContract({
    address: deployment.contracts.gateway,
    abi: staticsAbi,
    functionName: "previewPeggedMint",
    args: [peggedProfileId, peggedAmount],
  });
  await send(
    deployment.pegged.collateral,
    encodeFunctionData({
      abi: basketTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.gateway, maximum(peggedMintPreview.totalCollateralIn)],
    })
  );
  const dollarBeforePeggedMint = await publicClient.readContract({
    address: deployment.contracts.dollar,
    abi: staticsDollarTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  await send(
    deployment.contracts.gateway,
    buildMintPeggedCall(
      peggedProfileId,
      peggedAmount,
      maximum(peggedMintPreview.totalCollateralIn),
      account.address
    )
  );
  const dollarAfterPeggedMint = await publicClient.readContract({
    address: deployment.contracts.dollar,
    abi: staticsDollarTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (dollarAfterPeggedMint < dollarBeforePeggedMint + peggedAmount) {
    throw new Error("Local pegged mint did not increase the Statics Dollar balance.");
  }

  const peggedRedemptionAmount = parseEther("4");
  const peggedRedemptionPreview = await publicClient.readContract({
    address: deployment.contracts.gateway,
    abi: staticsAbi,
    functionName: "previewPeggedRedemption",
    args: [peggedProfileId, peggedRedemptionAmount],
  });
  await send(
    deployment.contracts.dollar,
    encodeFunctionData({
      abi: staticsDollarTokenAbi,
      functionName: "approve",
      args: [deployment.contracts.gateway, peggedRedemptionAmount],
    })
  );
  const collateralBeforeRedemption = await publicClient.readContract({
    address: deployment.pegged.collateral,
    abi: basketTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  const peggedRedemption = await send(
    deployment.contracts.gateway,
    buildRedeemPeggedCall(
      peggedProfileId,
      peggedRedemptionAmount,
      minimum(peggedRedemptionPreview.collateralOut),
      account.address
    )
  );
  assertAvailableRecombination("redeemPegged", peggedRedemption.simulationData);
  const collateralAfterRedemption = await publicClient.readContract({
    address: deployment.pegged.collateral,
    abi: basketTokenAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (collateralAfterRedemption <= collateralBeforeRedemption) {
    throw new Error("Local pegged redemption did not increase the USDG balance.");
  }

  console.log(
    "Local protocol integration passed: Dollar, pegged USDG mint and redemption, basket creation, collateral, lending, multi-asset rewards, canonical LP NFT lifecycle, LP claims, and borrow-to-liquidity confirmed."
  );
} finally {
  anvil.kill("SIGTERM");
}
