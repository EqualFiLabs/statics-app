import { fireEvent, render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";
import { ReviewDrawer } from "@/components/rewards/ReviewDrawer";
describe("review drawer keyboard and dismissal", () => {
  it("focuses the dialog, traps Tab, and permits Escape only when idle", () => {
    const close = vi.fn();
    const { rerender, unmount } = render(
      <ReviewDrawer title="Claim review" onClose={close}>
        <button>Confirm</button>
        <button>Cancel</button>
      </ReviewDrawer>
    );
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    rerender(
      <ReviewDrawer title="Claim review" busy onClose={close}>
        <button>Stop</button>
      </ReviewDrawer>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    rerender(
      <ReviewDrawer title="Claim review" onClose={close}>
        <button>Confirm</button>
      </ReviewDrawer>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
  it("lets only the topmost of stacked dialogs handle Escape and Tab", () => {
    const closeOuter = vi.fn(),
      closeInner = vi.fn();
    const { rerender } = render(
      <ReviewDrawer title="Directory" variant="fullscreen" onClose={closeOuter}>
        <button>Allocate</button>
      </ReviewDrawer>
    );
    const opener = screen.getByRole("button", { name: "Allocate" });
    opener.focus();
    const stacked = (
      <>
        <ReviewDrawer title="Directory" variant="fullscreen" onClose={closeOuter}>
          <button>Allocate</button>
        </ReviewDrawer>
        <ReviewDrawer title="Adjust" variant="modal" onClose={closeInner}>
          <button>Add changes</button>
        </ReviewDrawer>
      </>
    );
    rerender(stacked);
    const outer = screen.getByRole("dialog", { name: "Directory" }),
      inner = screen.getByRole("dialog", { name: "Adjust" });
    expect(document.activeElement).toBe(inner);
    // The lower dialog's overlay is inert while another dialog sits over it.
    expect((outer.parentElement as HTMLElement).inert).toBe(true);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add changes" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
    rerender(
      <ReviewDrawer title="Directory" variant="fullscreen" onClose={closeOuter}>
        <button>Allocate</button>
      </ReviewDrawer>
    );
    expect((outer.parentElement as HTMLElement).inert).toBeFalsy();
    expect(document.activeElement).toBe(opener);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeOuter).toHaveBeenCalledTimes(1);
  });
  it("leaves a nested wallet portal interactive and lets its Escape handler run", () => {
    const portal = document.createElement("div");
    portal.id = "headlessui-portal-root";
    document.body.append(portal);
    const close = vi.fn(),
      walletEscape = vi.fn();
    const { unmount } = render(
      <ReviewDrawer title="Claim review" busy onClose={close}>
        <button>Stop</button>
      </ReviewDrawer>
    );
    expect(portal.inert).not.toBe(true);
    const wallet = document.createElement("div");
    wallet.id = "privy-dialog";
    const cancel = document.createElement("button");
    wallet.append(cancel);
    portal.append(wallet);
    window.addEventListener("keydown", walletEscape);
    cancel.focus();
    fireEvent.keyDown(cancel, { key: "Escape" });
    expect(walletEscape).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    fireEvent.keyDown(cancel, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    window.removeEventListener("keydown", walletEscape);
    unmount();
    portal.remove();
  });
});
