import { useState } from "react";
import { fireEvent, render, screen, within } from "@/test/render";
import { describe, expect, it, vi } from "vitest";

import { RewardAssetPicker } from "@/components/rewards/RewardAssetPicker";
import { StakeMaturity } from "@/components/rewards/StakeMaturity";
import { RewardSelectionEditor } from "@/components/positions/RewardSelectionEditor";
import type { StakingSnapshot } from "@/lib/positions/staking";

const token = (symbol: string, last: string) => ({
  address: `0x${"0".repeat(39)}${last}` as `0x${string}`,
  name: symbol,
  symbol,
  decimals: 18,
  metadataAvailable: true,
});

const weth = token("WETH", "1");
const wbtc = token("WBTC", "2");
const usdc = token("USDC", "3");

const now = BigInt(Math.floor(Date.parse("2026-07-26T09:00:00Z") / 1_000));
const laterToday = BigInt(Math.floor(Date.parse("2026-07-26T15:00:00Z") / 1_000));

function snapshot(overrides: Partial<StakingSnapshot> = {}): StakingSnapshot {
  return { stakedBalance: 0n, selections: [], earning: [], maturing: [], ...overrides };
}

const selection = (t: ReturnType<typeof token>, pending: bigint, eligibleAt: bigint) => ({
  token: t,
  selected: true,
  actualEligibleStake: 0n,
  actualPendingStake: pending,
  effectiveEligibleWeight: 0n,
  effectivePendingWeight: pending,
  eligibleAt,
});

describe("stake maturity", () => {
  it("states the amount warming up and when it starts, never as a shortfall", () => {
    render(
      <StakeMaturity
        snapshot={snapshot({
          stakedBalance: 100n * 10n ** 18n,
          selections: [selection(wbtc, 40n * 10n ** 18n, laterToday)],
          maturing: [selection(wbtc, 40n * 10n ** 18n, laterToday)],
        })}
        stakingToken={weth}
        now={now}
      />
    );

    const text = screen.getByText(/starts earning/).textContent ?? "";
    expect(text).toContain("40 WETH");
    expect(text).toContain("WBTC");
    // The guard: nothing may frame this as a fraction of the total.
    expect(text).not.toMatch(/\bof 100\b/);
    expect(text).not.toMatch(/eligible/i);
  });

  it("collapses assets sharing a maturity into one sentence", () => {
    render(
      <StakeMaturity
        snapshot={snapshot({
          maturing: [
            selection(wbtc, 40n * 10n ** 18n, laterToday),
            selection(usdc, 40n * 10n ** 18n, laterToday),
          ],
        })}
        stakingToken={weth}
        now={now}
      />
    );

    const lines = screen.getAllByText(/starts earning/);
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toContain("WBTC, USDC");
    // Not 80: the same stake is recorded against each asset.
    expect(lines[0].textContent).toContain("40 WETH");
  });

  it("confirms everything is earning once nothing is pending", () => {
    render(
      <StakeMaturity
        snapshot={snapshot({
          earning: [
            {
              ...selection(wbtc, 0n, 0n),
              actualEligibleStake: 100n,
              effectiveEligibleWeight: 100n,
            },
          ],
        })}
        stakingToken={weth}
        now={now}
      />
    );

    expect(screen.getByText("All of your stake is earning.")).toBeInTheDocument();
  });

  it("stays silent when there is no stake at all", () => {
    const { container } = render(
      <StakeMaturity snapshot={snapshot()} stakingToken={weth} now={now} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing before the snapshot arrives", () => {
    const { container } = render(
      <StakeMaturity snapshot={undefined} stakingToken={weth} now={now} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("reward asset picker", () => {
  const many = Array.from({ length: 12 }, (_, index) => ({
    token: token(`TK${index}`, `${index}`),
    sources: ["MAJ underlying"],
  }));

  it("asks what you want to earn rather than labelling a field", () => {
    render(<RewardAssetPicker candidates={many} selected={[]} maximum={64n} onToggle={vi.fn()} />);
    expect(screen.getByText(/what do you want to earn/i)).toBeInTheDocument();
  });

  it("warns that a later selection does not backfill, before anything is picked", () => {
    render(<RewardAssetPicker candidates={many} selected={[]} maximum={64n} onToggle={vi.fn()} />);
    expect(
      screen.getByText(/does not earn you a share of fees collected before then/i)
    ).toBeInTheDocument();
  });

  it("shows a short list and hides the rest behind a disclosure", () => {
    render(<RewardAssetPicker candidates={many} selected={[]} maximum={64n} onToggle={vi.fn()} />);

    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Show all 12 assets" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
  });

  it("surfaces proven payers in the short list ahead of the rest", () => {
    const candidates = [
      ...Array.from({ length: 8 }, (_, index) => ({
        token: token(`FILL${index}`, `a${index}`),
        sources: ["MAJ underlying"],
      })),
      { token: wbtc, sources: ["Fee history"] },
    ];
    render(
      <RewardAssetPicker candidates={candidates} selected={[]} maximum={64n} onToggle={vi.fn()} />
    );

    // WBTC is last in the input and would be hidden without the ranking.
    expect(screen.getByText("WBTC")).toBeInTheDocument();
  });

  it("offers no disclosure when everything already fits", () => {
    render(
      <RewardAssetPicker
        candidates={many.slice(0, 4)}
        selected={[]}
        maximum={64n}
        onToggle={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /show all/i })).not.toBeInTheDocument();
  });

  it("reports the running count against the cap", () => {
    render(
      <RewardAssetPicker
        candidates={many}
        selected={[many[0].token.address, many[1].token.address]}
        maximum={64n}
        onToggle={vi.fn()}
      />
    );
    expect(screen.getByText("2 of 64 chosen")).toBeInTheDocument();
  });

  it("reports each toggle to the caller", () => {
    const onToggle = vi.fn();
    render(<RewardAssetPicker candidates={many} selected={[]} maximum={64n} onToggle={onToggle} />);

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});

describe("position reward selection editor", () => {
  function DraftEditor({ onSave }: { onSave: () => void }) {
    const [selected, setSelected] = useState<readonly `0x${string}`[]>([]);
    return (
      <RewardSelectionEditor
        candidates={[{ token: wbtc, sources: ["Fee history"] }]}
        confirmed={[]}
        selected={selected}
        rewards={[]}
        maximum={64n}
        chainId={46_630}
        changeCount={selected.length}
        disabled={false}
        saving={false}
        onToggle={(asset) =>
          setSelected((current) =>
            current.includes(asset) ? current.filter((item) => item !== asset) : [...current, asset]
          )
        }
        onSave={onSave}
      />
    );
  }

  it("highlights card choices locally and waits for the explicit batch save", () => {
    const onSave = vi.fn();
    render(<DraftEditor onSave={onSave} />);

    const card = screen.getByText("WBTC").closest("article");
    expect(card).not.toHaveClass("is-selected");
    expect(screen.getByRole("button", { name: "Save 0 reward changes" })).toBeDisabled();

    fireEvent.click(within(card!).getByRole("button", { name: "Select reward" }));

    expect(card).toHaveClass("is-selected", "is-changed");
    expect(screen.getByText("Will be selected")).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save 1 reward change" }));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
