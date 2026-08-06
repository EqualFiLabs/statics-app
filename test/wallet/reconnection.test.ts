import { describe, expect, it, vi } from "vitest";

import { recoverPrivyWallet } from "@/lib/wallet/reconnection";

describe("Privy wallet recovery", () => {
  it("reactivates an existing embedded wallet without ending the Privy session", async () => {
    const embeddedWallet = { address: "0xembedded" };
    const activateEmbedded = vi.fn().mockResolvedValue(undefined);
    const logout = vi.fn().mockResolvedValue(undefined);
    const selectEmbedded = vi.fn();
    const restoreLocalConnection = vi.fn();
    const waitForEmbeddedWallet = vi.fn();
    const openEmailLogin = vi.fn();

    await expect(
      recoverPrivyWallet({
        embeddedWallet,
        authenticated: true,
        activateEmbedded,
        logout,
        selectEmbedded,
        restoreLocalConnection,
        waitForEmbeddedWallet,
        openEmailLogin,
      })
    ).resolves.toBe("activated-embedded");

    expect(activateEmbedded).toHaveBeenCalledWith(embeddedWallet);
    expect(logout).not.toHaveBeenCalled();
    expect(selectEmbedded).toHaveBeenCalledWith(embeddedWallet);
    expect(restoreLocalConnection).toHaveBeenCalledOnce();
    expect(waitForEmbeddedWallet).not.toHaveBeenCalled();
    expect(openEmailLogin).not.toHaveBeenCalled();
  });

  it("replaces an external-only Privy session with email login", async () => {
    const order: string[] = [];
    const logout = vi.fn(async () => void order.push("logout"));
    const waitForEmbeddedWallet = vi.fn(() => void order.push("wait"));
    const openEmailLogin = vi.fn(() => void order.push("login"));

    await expect(
      recoverPrivyWallet({
        embeddedWallet: undefined,
        authenticated: true,
        activateEmbedded: vi.fn(),
        logout,
        selectEmbedded: vi.fn(),
        restoreLocalConnection: vi.fn(),
        waitForEmbeddedWallet,
        openEmailLogin,
      })
    ).resolves.toBe("opened-email-login");

    expect(order).toEqual(["logout", "wait", "login"]);
  });

  it("opens email login directly when the Privy session has already ended", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const waitForEmbeddedWallet = vi.fn();
    const openEmailLogin = vi.fn();

    await recoverPrivyWallet({
      embeddedWallet: undefined,
      authenticated: false,
      activateEmbedded: vi.fn(),
      logout,
      selectEmbedded: vi.fn(),
      restoreLocalConnection: vi.fn(),
      waitForEmbeddedWallet,
      openEmailLogin,
    });

    expect(logout).not.toHaveBeenCalled();
    expect(waitForEmbeddedWallet).toHaveBeenCalledBefore(openEmailLogin);
  });
});
