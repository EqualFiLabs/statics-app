import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  parseTransaction,
  parseEther,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { foundry } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import {
  encodeErc7821Batch,
  prepareErc7821Batch,
  prepareFresh7702Batch,
  submitErc7821Batch,
  submitPrivy7702Batch,
  type AtomicBatch,
} from "@/lib/genesis/atomic-batch";

const run = process.env.RUN_ATOMIC_CONFORMANCE === "1";
const conformance = run ? describe : describe.skip;
const probeAbi = parseAbi([
  "function record() payable",
  "function checkAllowance(address token,address owner,uint256 expected) view",
  "function fail() pure",
  "function lastCaller() view returns (address)",
  "function received() view returns (uint256)",
  "function calls() view returns (uint256)",
]);
const tokenAbi = parseAbi([
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
]);

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local port available.");
  await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
  return address.port;
}

async function artifact(name: string) {
  const path = resolve(process.cwd(), "test/conformance/out/AtomicBatchProbe.sol", `${name}.json`);
  const parsed = JSON.parse(await readFile(path, "utf8")) as {
    abi: readonly unknown[];
    bytecode: { object: Hex };
  };
  return parsed;
}

conformance("local EIP-7702 atomic batch conformance", () => {
  let anvil: ChildProcess;
  let rpcUrl: string;
  let publicClient: PublicClient;
  const account = privateKeyToAccount(generatePrivateKey());
  let delegate: Address;
  let probe: Address;
  let token: Address;
  let delegateCode: Hex;

  async function rpc(method: string, params: unknown[] = []) {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const body = (await response.json()) as { result?: unknown; error?: { message: string } };
    if (body.error) throw new Error(body.error.message);
    return body.result;
  }

  beforeAll(async () => {
    const port = await freePort();
    rpcUrl = `http://127.0.0.1:${port}`;
    anvil = spawn(
      "anvil",
      ["--host", "127.0.0.1", "--port", String(port), "--hardfork", "prague", "--silent"],
      {
        stdio: "ignore",
      }
    );
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        await rpc("eth_chainId");
        ready = true;
        break;
      } catch {
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
      }
    }
    if (!ready) throw new Error("Anvil did not start.");
    await rpc("anvil_setBalance", [account.address, "0x56bc75e2d63100000"]);
    publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain: foundry, transport: http(rpcUrl) });
    const deployments: Address[] = [];
    for (const name of ["AtomicBatchDelegate", "AtomicBatchProbe", "AtomicBatchToken"]) {
      const compiled = await artifact(name);
      const hash = await walletClient.deployContract({
        abi: compiled.abi,
        bytecode: compiled.bytecode.object,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) throw new Error(`${name} deployment failed.`);
      deployments.push(receipt.contractAddress);
    }
    [delegate, probe, token] = deployments;
    delegateCode = (await publicClient.getCode({ address: delegate }))!;
    await rpc("anvil_setCode", [account.address, `0xef0100${delegate.slice(2).toLowerCase()}`]);
  }, 30_000);

  afterAll(() => anvil?.kill());

  it("preserves the owner caller, passes value, and revokes approval", async () => {
    const batch: AtomicBatch = {
      calls: [
        {
          to: token,
          data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [probe, 7n] }),
          value: 0n,
        },
        {
          to: probe,
          data: encodeFunctionData({
            abi: probeAbi,
            functionName: "checkAllowance",
            args: [token, account.address, 7n],
          }),
          value: 0n,
        },
        {
          to: probe,
          data: encodeFunctionData({ abi: probeAbi, functionName: "record" }),
          value: parseEther("0.1"),
        },
        {
          to: token,
          data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [probe, 0n] }),
          value: 0n,
        },
      ],
      labels: ["approve", "check allowance", "record", "revoke"],
    };
    const prepared = await prepareErc7821Batch({
      publicClient,
      wallet: account.address,
      batch,
      allowedTargets: [token, probe],
      verifiedDelegateCodeHashes: [keccak256(delegateCode)],
    });
    await submitErc7821Batch({
      publicClient,
      wallet: account.address,
      chainId: 31337,
      prepared,
      sendTransaction: async (request) => {
        const walletClient = createWalletClient({
          account,
          chain: foundry,
          transport: http(rpcUrl),
        });
        return walletClient.sendTransaction({
          to: request.to,
          data: request.data,
          value: request.value,
          gas: request.gasLimit,
        });
      },
    });
    expect(
      await publicClient.readContract({ address: probe, abi: probeAbi, functionName: "lastCaller" })
    ).toBe(account.address);
    expect(
      await publicClient.readContract({ address: probe, abi: probeAbi, functionName: "received" })
    ).toBe(parseEther("0.1"));
    expect(
      await publicClient.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "allowance",
        args: [account.address, probe],
      })
    ).toBe(0n);
  }, 30_000);

  it("reverts all earlier child effects when a later child fails", async () => {
    const batch: AtomicBatch = {
      calls: [
        {
          to: token,
          data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [probe, 9n] }),
          value: 0n,
        },
        {
          to: probe,
          data: encodeFunctionData({ abi: probeAbi, functionName: "record" }),
          value: 0n,
        },
        { to: probe, data: encodeFunctionData({ abi: probeAbi, functionName: "fail" }), value: 0n },
      ],
      labels: ["approve", "record", "intentional failure"],
    };
    await expect(
      prepareErc7821Batch({
        publicClient,
        wallet: account.address,
        batch,
        allowedTargets: [token, probe],
        verifiedDelegateCodeHashes: [keccak256(delegateCode)],
      })
    ).rejects.toThrow("intentional failure");
    const walletClient = createWalletClient({ account, chain: foundry, transport: http(rpcUrl) });
    const hash = await walletClient.sendTransaction({
      to: account.address,
      data: encodeErc7821Batch(batch.calls),
      gas: 500_000n,
    });
    expect((await publicClient.waitForTransactionReceipt({ hash })).status).toBe("reverted");
    expect(
      await publicClient.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "allowance",
        args: [account.address, probe],
      })
    ).toBe(0n);
    expect(
      await publicClient.readContract({ address: probe, abi: probeAbi, functionName: "calls" })
    ).toBe(1n);
  }, 30_000);

  it("authorizes a fresh EOA and executes its first atomic batch in one type-4 transaction", async () => {
    const freshAccount = privateKeyToAccount(generatePrivateKey());
    await rpc("anvil_setBalance", [freshAccount.address, "0x56bc75e2d63100000"]);
    const batch: AtomicBatch = {
      calls: [
        {
          to: token,
          data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [probe, 11n] }),
          value: 0n,
        },
        {
          to: probe,
          data: encodeFunctionData({
            abi: probeAbi,
            functionName: "checkAllowance",
            args: [token, freshAccount.address, 11n],
          }),
          value: 0n,
        },
        {
          to: probe,
          data: encodeFunctionData({ abi: probeAbi, functionName: "record" }),
          value: parseEther("0.02"),
        },
        {
          to: token,
          data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [probe, 0n] }),
          value: 0n,
        },
      ],
      labels: ["approve", "check", "record", "revoke"],
    };
    const prepared = await prepareFresh7702Batch({
      publicClient,
      wallet: freshAccount.address,
      batch,
      allowedTargets: [token, probe],
      delegate,
      verifiedDelegateCodeHashes: [keccak256(delegateCode)],
    });
    const walletClient = createWalletClient({
      account: freshAccount,
      chain: foundry,
      transport: http(rpcUrl),
    });
    await submitPrivy7702Batch({
      publicClient,
      wallet: freshAccount.address,
      chainId: 31337,
      prepared,
      signAuthorization: async (input) =>
        freshAccount.signAuthorization({
          contractAddress: input.contractAddress,
          chainId: input.chainId,
          nonce: input.nonce,
        }),
      sendAuthorizedTransaction: (request) => walletClient.sendTransaction(request),
    });
    expect(
      await publicClient.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "allowance",
        args: [freshAccount.address, probe],
      })
    ).toBe(0n);
    expect(
      await publicClient.readContract({ address: probe, abi: probeAbi, functionName: "lastCaller" })
    ).toBe(freshAccount.address);
    expect(
      await publicClient.readContract({ address: probe, abi: probeAbi, functionName: "received" })
    ).toBe(parseEther("0.12"));
    expect(await publicClient.getCode({ address: freshAccount.address })).toBe(
      `0xef0100${delegate.slice(2).toLowerCase()}`
    );
  }, 30_000);

  it("activates a Privy-style EOA with a relayer, then batches from the same EOA", async () => {
    const owner = privateKeyToAccount(generatePrivateKey());
    const relayer = privateKeyToAccount(generatePrivateKey());
    await rpc("anvil_setBalance", [owner.address, "0x56bc75e2d63100000"]);
    await rpc("anvil_setBalance", [relayer.address, "0x56bc75e2d63100000"]);
    const authorization = await owner.signAuthorization({
      contractAddress: delegate,
      chainId: 31337,
      nonce: 0,
    });
    const relayClient = createWalletClient({
      account: relayer,
      chain: foundry,
      transport: http(rpcUrl),
    });
    const fees = await publicClient.estimateFeesPerGas();
    const signedActivation = await relayClient.signTransaction({
      type: "eip7702",
      chain: foundry,
      account: relayer,
      to: relayer.address,
      gas: 100_000n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      authorizationList: [authorization],
    });
    expect(parseTransaction(signedActivation).type).toBe("eip7702");
    const activationHash = await publicClient.sendRawTransaction({
      serializedTransaction: signedActivation,
    });
    expect((await publicClient.getTransaction({ hash: activationHash })).type).toBe("eip7702");
    expect((await publicClient.waitForTransactionReceipt({ hash: activationHash })).status).toBe(
      "success"
    );
    expect(await publicClient.getCode({ address: owner.address })).toBe(
      `0xef0100${delegate.slice(2).toLowerCase()}`
    );
    const batch: AtomicBatch = {
      calls: [
        {
          to: probe,
          data: encodeFunctionData({ abi: probeAbi, functionName: "record" }),
          value: 1n,
        },
      ],
      labels: ["record"],
    };
    const prepared = await prepareErc7821Batch({
      publicClient,
      wallet: owner.address,
      batch,
      allowedTargets: [probe],
      verifiedDelegateCodeHashes: [keccak256(delegateCode)],
    });
    const ownerClient = createWalletClient({
      account: owner,
      chain: foundry,
      transport: http(rpcUrl),
    });
    await submitErc7821Batch({
      publicClient,
      wallet: owner.address,
      chainId: 31337,
      prepared,
      batch,
      sendTransaction: (request) =>
        ownerClient.sendTransaction({
          to: request.to,
          data: request.data,
          value: request.value,
          gas: request.gasLimit,
        }),
    });
    expect(
      await publicClient.readContract({ address: probe, abi: probeAbi, functionName: "lastCaller" })
    ).toBe(owner.address);
    await expect(
      publicClient.call({ account: relayer.address, to: owner.address, value: 1n })
    ).rejects.toThrow();
    const revokeAuthorization = await owner.signAuthorization({
      contractAddress: zeroAddress,
      chainId: 31337,
      nonce: await publicClient.getTransactionCount({ address: owner.address }),
    });
    const signedRevocation = await relayClient.signTransaction({
      type: "eip7702",
      chain: foundry,
      account: relayer,
      to: relayer.address,
      gas: 100_000n,
      nonce: await publicClient.getTransactionCount({ address: relayer.address }),
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      authorizationList: [revokeAuthorization],
    });
    const revocationHash = await publicClient.sendRawTransaction({
      serializedTransaction: signedRevocation,
    });
    expect((await publicClient.waitForTransactionReceipt({ hash: revocationHash })).status).toBe(
      "success"
    );
    expect(await publicClient.getCode({ address: owner.address })).toBeUndefined();
    await expect(
      publicClient.call({ account: relayer.address, to: owner.address, value: 1n })
    ).resolves.toBeDefined();
  }, 30_000);

  it("rolls back approval changes in a failing first type-4 batch", async () => {
    const freshAccount = privateKeyToAccount(generatePrivateKey());
    await rpc("anvil_setBalance", [freshAccount.address, "0x56bc75e2d63100000"]);
    const walletClient = createWalletClient({
      account: freshAccount,
      chain: foundry,
      transport: http(rpcUrl),
    });
    const authorization = await freshAccount.signAuthorization({
      contractAddress: delegate,
      chainId: 31337,
      nonce: 1,
    });
    const failingCalls: AtomicBatch = {
      calls: [
        {
          to: token,
          data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [probe, 13n] }),
          value: 0n,
        },
        { to: probe, data: encodeFunctionData({ abi: probeAbi, functionName: "fail" }), value: 0n },
      ],
      labels: ["approve", "fail"],
    };
    const hash = await walletClient.sendTransaction({
      to: freshAccount.address,
      data: encodeErc7821Batch(failingCalls.calls),
      gas: 500_000n,
      authorizationList: [authorization],
    });
    expect((await publicClient.waitForTransactionReceipt({ hash })).status).toBe("reverted");
    expect(
      await publicClient.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "allowance",
        args: [freshAccount.address, probe],
      })
    ).toBe(0n);
    // EIP-7702 delegation is processed before call execution and may persist after a revert.
    expect(await publicClient.getCode({ address: freshAccount.address })).toBe(
      `0xef0100${delegate.slice(2).toLowerCase()}`
    );
  }, 30_000);
});
