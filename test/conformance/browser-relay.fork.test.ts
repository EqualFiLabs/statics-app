import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import {
  activateCaliburWithBrowserRelay,
  quoteBrowserCaliburRelay,
  quoteBrowserCaliburRevocation,
  revokeCaliburWithBrowserRelay,
} from "@/lib/genesis/browser-calibur-relay";
import { ROBINHOOD_CALIBUR } from "@/lib/genesis/calibur";
import { robinhoodMainnet } from "@/lib/wallet-config";

const run = process.env.RUN_BROWSER_RELAY_FORK === "1";
const suite = run ? describe : describe.skip;

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local port available.");
  await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
  return address.port;
}

suite("browser funded Calibur activation on a Robinhood fork", () => {
  let anvil: ChildProcess;
  let rpcUrl: string;
  const owner = privateKeyToAccount(generatePrivateKey());

  beforeAll(async () => {
    const upstream = process.env.STATICS_ROBINHOOD_MAINNET_RPC_URL;
    if (!upstream) throw new Error("STATICS_ROBINHOOD_MAINNET_RPC_URL is required.");
    const port = await freePort();
    rpcUrl = `http://127.0.0.1:${port}`;
    anvil = spawn(
      "anvil",
      [
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--chain-id",
        "4663",
        "--hardfork",
        "prague",
        "--block-base-fee-per-gas",
        "10000000",
        "--gas-price",
        "10000000",
        "--disable-min-priority-fee",
        "--fork-url",
        upstream,
        "--silent",
      ],
      { stdio: "ignore" }
    );
    const client = createPublicClient({ chain: robinhoodMainnet, transport: http(rpcUrl) });
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        if ((await client.getChainId()) === 4663) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((resolveWait) => setTimeout(resolveWait, 250));
      }
    }
    if (!ready) throw new Error("Robinhood fork did not start.");
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "anvil_setBalance",
        params: [owner.address, `0x${parseEther("0.01").toString(16)}`],
      }),
    });
    const body = (await response.json()) as { error?: { message: string } };
    if (body.error) throw new Error(body.error.message);
    window.sessionStorage.clear();
  }, 60_000);

  afterAll(() => anvil?.kill());

  it("activates and removes Calibur from the original EOA through the funded relay", async () => {
    const publicClient = createPublicClient({ chain: robinhoodMainnet, transport: http(rpcUrl) });
    const ownerClient = createWalletClient({
      account: owner,
      chain: robinhoodMainnet,
      transport: http(rpcUrl),
    });
    const quote = await quoteBrowserCaliburRelay(publicClient, owner.address);
    expect(quote.fundingAmount).toBeGreaterThan(quote.maximumActivationFee);

    const outcome = await activateCaliburWithBrowserRelay({
      publicClient,
      wallet: owner.address,
      relayRpcUrl: rpcUrl,
      sendFunding: (to, value) => ownerClient.sendTransaction({ to, value }),
      signAuthorization: (input) => ownerClient.signAuthorization(input),
    });
    expect(outcome.relayer).toBe(quote.relayer);
    expect(outcome.refundHash).toMatch(/^0x[0-9a-f]{64}$/);
    const activation = await publicClient.getTransaction({ hash: outcome.activationHash });
    expect(activation.type).toBe("eip7702");
    expect((await publicClient.getCode({ address: owner.address }))?.toLowerCase()).toBe(
      `0xef0100${ROBINHOOD_CALIBUR.slice(2).toLowerCase()}`
    );
    expect(
      (await publicClient.waitForTransactionReceipt({ hash: outcome.activationHash })).status
    ).toBe("success");
    expect(await publicClient.getBalance({ address: owner.address })).toBeGreaterThan(0n);

    const review = await quoteBrowserCaliburRevocation(publicClient, owner.address);
    expect(review.delegate).toBe(ROBINHOOD_CALIBUR);
    const removal = await revokeCaliburWithBrowserRelay({
      publicClient,
      wallet: owner.address,
      review,
      relayRpcUrl: rpcUrl,
      sendFunding: (to, value) => ownerClient.sendTransaction({ to, value }),
      signAuthorization: (input) => ownerClient.signAuthorization(input),
    });
    expect(removal.relayer).toBe(quote.relayer);
    expect(removal.revocationHash).toMatch(/^0x[0-9a-f]{64}$/);
    const revocation = await publicClient.getTransaction({ hash: removal.revocationHash });
    expect(revocation.type).toBe("eip7702");
    expect(revocation.authorizationList?.[0]?.address).toBe(
      "0x0000000000000000000000000000000000000000"
    );
    expect((await publicClient.getCode({ address: owner.address })) ?? "0x").toBe("0x");
    await expect(quoteBrowserCaliburRevocation(publicClient, owner.address)).rejects.toThrow(
      "not delegated"
    );
    expect(removal.refundHash).toMatch(/^0x[0-9a-f]{64}$/);
  }, 60_000);
});
