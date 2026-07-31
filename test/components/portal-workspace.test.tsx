import { render, screen } from "@/test/render";
import { describe, expect, it } from "vitest";

import { PortalWorkspace } from "@/components/portal/PortalWorkspace";

describe("funding Portal", () => {
  it("keeps swaps and bridges in the Portal and routes Dollar to its own page", () => {
    render(<PortalWorkspace />);

    expect(screen.getByRole("tab", { name: "Swap" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bridge" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Dollar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Dollar →" })).toHaveAttribute(
      "href",
      "/app/dollar?profile=USDG"
    );
  });
});
