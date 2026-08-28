import { describe, expect, it } from "vitest";

import {
  getAddressExplorerUrl,
  getAddressExplorerUrlForChain,
  getTransactionExplorerUrl,
  readWalletEnvironment,
} from "@/lib/wallet-config";

describe("wallet environment", () => {
  it("uses same-origin Robinhood read proxies in local development", () => {
    const environment = readWalletEnvironment({});

    expect(environment.appEnvironment).toBe("development");
    expect(environment.network).toBe("robinhood-testnet");
    expect(environment.defaultChain.id).toBe(46_630);
    expect(environment.configured).toBe(false);
    expect(environment.defaultChain.rpcUrls.default.http).toEqual(["/api/rpc/46630"]);
    expect(environment.supportedChains.map((chain) => chain.id)).toEqual([46_630, 4_663, 31_337]);
  });

  it("accepts Anvil only for local development", () => {
    const environment = readWalletEnvironment({ NEXT_PUBLIC_APP_NETWORK: "anvil" });
    expect(environment.defaultChain.id).toBe(31_337);
    expect(environment.supportedChains.map((chain) => chain.id)).toEqual([31_337, 4_663, 46_630]);
    expect(() =>
      readWalletEnvironment({
        NEXT_PUBLIC_APP_ENV: "staging",
        NEXT_PUBLIC_APP_NETWORK: "anvil",
      })
    ).toThrow("Local chains are only available");
  });

  it("keeps local Anvil distinct from both public Robinhood networks", () => {
    const environment = readWalletEnvironment({
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_APP_NETWORK: "anvil",
      NEXT_PUBLIC_ANVIL_RPC_URL: "http://127.0.0.1:8546",
    });

    expect(environment.defaultChain.id).toBe(31_337);
    expect(environment.defaultChain.name).toBe("Local Anvil");
    expect(environment.defaultChain.blockExplorers).toBeUndefined();
    expect(environment.defaultChain.rpcUrls.default.http).toEqual(["http://127.0.0.1:8546/"]);
    expect(environment.supportedChains.map((chain) => chain.id)).toEqual([31_337, 4_663, 46_630]);
  });

  it("uses the configured Anvil RPC even when a public network starts selected", () => {
    const environment = readWalletEnvironment({
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_APP_NETWORK: "robinhood-testnet",
      NEXT_PUBLIC_ANVIL_RPC_URL: "http://127.0.0.1:8546",
    });

    expect(
      environment.supportedChains.find((chain) => chain.id === 31_337)?.rpcUrls.default.http
    ).toEqual(["http://127.0.0.1:8546/"]);
  });

  it("rejects a non-loopback or non-development Anvil RPC", () => {
    expect(() =>
      readWalletEnvironment({
        NEXT_PUBLIC_APP_ENV: "development",
        NEXT_PUBLIC_APP_NETWORK: "anvil",
        NEXT_PUBLIC_ANVIL_RPC_URL: "https://rpc.mainnet.chain.robinhood.com",
      })
    ).toThrow("loopback-only");
    expect(() =>
      readWalletEnvironment({
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_APP_NETWORK: "anvil",
        NEXT_PUBLIC_ANVIL_RPC_URL: "http://127.0.0.1:8546",
      })
    ).toThrow("Local chains are only available");
  });

  it("accepts Robinhood mainnet without exposing an upstream RPC", () => {
    const environment = readWalletEnvironment({
      NEXT_PUBLIC_APP_ENV: "production",
      NEXT_PUBLIC_APP_NETWORK: "robinhood",
      NEXT_PUBLIC_PRIVY_APP_ID: "app-id",
    });

    expect(environment.defaultChain.id).toBe(4_663);
    expect(environment.supportedChains.map((chain) => chain.id)).toEqual([4_663, 46_630]);
  });

  it("fails closed outside development when Privy is absent", () => {
    expect(() => readWalletEnvironment({ NEXT_PUBLIC_APP_ENV: "production" })).toThrow(
      "NEXT_PUBLIC_PRIVY_APP_ID is required"
    );
    expect(
      readWalletEnvironment({
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_PRIVY_APP_ID: "app-id",
      }).defaultChain.rpcUrls.default.http
    ).toEqual(["/api/rpc/46630"]);
  });

  it("rejects credential-bearing public RPC URLs", () => {
    expect(() =>
      readWalletEnvironment({
        NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL: "https://user:secret@rpc.example",
      })
    ).toThrow("server-only");
  });

  it("rejects the shared Robinhood RPC as a production critical endpoint", () => {
    expect(() =>
      readWalletEnvironment({
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_APP_NETWORK: "robinhood",
        NEXT_PUBLIC_PRIVY_APP_ID: "app-id",
        NEXT_PUBLIC_ROBINHOOD_RPC_URL: "https://rpc.mainnet.chain.robinhood.com",
      })
    ).toThrow("server-only");
  });

  it("creates an address-specific Robinhood explorer link", () => {
    const environment = readWalletEnvironment({});
    expect(getAddressExplorerUrl(environment.defaultChain, "0x1234")).toBe(
      "https://explorer.testnet.chain.robinhood.com/address/0x1234"
    );
  });

  it("creates transaction links only for chains with a configured explorer", () => {
    expect(getTransactionExplorerUrl(46_630, "0x1234")).toBe(
      "https://explorer.testnet.chain.robinhood.com/tx/0x1234"
    );
    expect(getTransactionExplorerUrl(31_337, "0x1234")).toBeNull();
    expect(getTransactionExplorerUrl(4_663, "0x1234")).toBe(
      "https://robinhoodchain.blockscout.com/tx/0x1234"
    );
    expect(getAddressExplorerUrlForChain(46_630, "0x1234")).toBe(
      "https://explorer.testnet.chain.robinhood.com/address/0x1234"
    );
    expect(getAddressExplorerUrlForChain(31_337, "0x1234")).toBeNull();
  });
});
