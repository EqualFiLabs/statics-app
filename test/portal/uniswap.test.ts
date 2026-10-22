import { afterEach, describe, expect, it, vi } from "vitest";

import { getDefaultEvmSwapTokens, normalizeUniswapTransaction } from "@/lib/portal/uniswap";
import {
  callUniswapApi,
  readUniswapIntegratorFee,
  resolveUniswapApiKey,
} from "@/lib/server/uniswap";

const wallet = "0x81709E16Bf99936891Cc720689f269103fabeD91";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Uniswap integration", () => {
  it("keeps API credentials and optional fee configuration server-side", async () => {
    await expect(
      resolveUniswapApiKey({ NEXT_PUBLIC_APP_ENV: "production", UNISWAP_API_KEY: "secret" })
    ).resolves.toBe("secret");
    await expect(resolveUniswapApiKey({ NEXT_PUBLIC_APP_ENV: "development" })).rejects.toThrow(
      "server environment"
    );
    expect(readUniswapIntegratorFee({})).toEqual({});
    expect(() => readUniswapIntegratorFee({ UNISWAP_INTEGRATOR_FEE_BIPS: "10" })).toThrow(
      /configured together/i
    );
    expect(
      readUniswapIntegratorFee({
        UNISWAP_INTEGRATOR_FEE_RECIPIENT: wallet,
        UNISWAP_INTEGRATOR_FEE_BIPS: "10",
      })
    ).toEqual({ integratorFee: { recipient: wallet, bips: 10 } });
  });

  it("lets Uniswap select the router version for quote, approval, and swap on supported chains", async () => {
    vi.stubEnv("UNISWAP_API_KEY", "test-key");
    const fetchApi = vi
      .fn()
      .mockImplementation(async () => new Response('{"requestId":"request"}'));
    vi.stubGlobal("fetch", fetchApi);

    for (const chainId of [4_663, 8_453, 324]) {
      for (const [pathname, body] of [
        ["/quote", { tokenInChainId: String(chainId) }],
        ["/check_approval", { chainId }],
        ["/swap", { quote: { tokenInChainId: String(chainId) } }],
      ] as const) {
        expect((await callUniswapApi(pathname, body)).ok).toBe(true);
        const [url, options] = fetchApi.mock.lastCall as [string, RequestInit];
        expect(url).toBe(`https://trade-api.gateway.uniswap.org/v1${pathname}`);
        const headers = new Headers(options.headers);
        expect(headers.has("x-universal-router-version")).toBe(false);
        expect(headers.get("x-permit2-disabled")).toBe("true");
      }
    }
  });

  it("validates returned transactions", () => {
    expect(getDefaultEvmSwapTokens(8_453).map((token) => token.symbol)).toEqual(["ETH", "USDC"]);
    expect(
      normalizeUniswapTransaction(
        { to: wallet, from: wallet, chainId: 8_453, data: "0x1234", value: "15" },
        { chainId: 8_453, wallet }
      )
    ).toEqual({ to: wallet, data: "0x1234", value: 15n });
    expect(() =>
      normalizeUniswapTransaction(
        { to: wallet, from: wallet, chainId: 1, data: "0x1234" },
        { chainId: 8_453, wallet }
      )
    ).toThrow(/different network/i);
  });
});
