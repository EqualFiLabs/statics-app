import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [file] : [];
  });
}

describe("Phase 1 wallet boundary", () => {
  it("does not install or import wallet runtime packages", () => {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const dependencies = Object.keys(packageJson.dependencies ?? {});
    expect(dependencies).not.toContain("@privy-io/react-auth");
    expect(dependencies).not.toContain("@privy-io/wagmi");
    expect(dependencies).not.toContain("wagmi");
    expect(dependencies).not.toContain("viem");

    const source = ["app", "components", "lib"]
      .flatMap((directory) => sourceFiles(directory))
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
    expect(source).not.toMatch(/from ["'](?:@privy-io\/|wagmi|viem)/);
  });
});
