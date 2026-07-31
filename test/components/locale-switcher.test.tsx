import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen, waitFor } from "@/test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleSwitcher } from "@/components/common/LocaleSwitcher";
import english from "@/messages/en.json";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("LocaleSwitcher", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("persists a supported locale before refreshing the current route", async () => {
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    render(
      <NextIntlClientProvider locale="en" messages={english}>
        <LocaleSwitcher />
      </NextIntlClientProvider>
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Change language" }), {
      target: { value: "es" },
    });

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("/api/locale", {
        body: JSON.stringify({ locale: "es" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps a failed preference change retryable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 400 }));

    render(
      <NextIntlClientProvider locale="en" messages={english}>
        <LocaleSwitcher />
      </NextIntlClientProvider>
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zh-CN" } });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Language could not be changed. Try again."
    );
    expect(screen.getByRole("combobox")).toBeEnabled();
  });
});
