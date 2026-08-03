import { describe, expect, it } from "vitest";

import {
  PREVIEW_PROTOCOL_TIME,
  previewBasketDraft,
  previewLoanTimeline,
  previewLoans,
  validatePreviewBasketDraft,
} from "@/lib/preview/remaining-surfaces";

describe("remaining DApp preview fixtures", () => {
  it("derives active, grace, and recoverable loan timelines from protocol time", () => {
    expect(previewLoans.map((loan) => previewLoanTimeline(loan))).toEqual([
      "active",
      "grace",
      "recoverable",
    ]);
    expect(
      previewLoanTimeline(
        { maturity: PREVIEW_PROTOCOL_TIME, recoverableAt: PREVIEW_PROTOCOL_TIME + 3_600 },
        PREVIEW_PROTOCOL_TIME
      )
    ).toBe("active");
    expect(
      previewLoanTimeline(
        { maturity: PREVIEW_PROTOCOL_TIME - 1, recoverableAt: PREVIEW_PROTOCOL_TIME },
        PREVIEW_PROTOCOL_TIME
      )
    ).toBe("grace");
  });

  it("accepts the deterministic basket draft", () => {
    expect(validatePreviewBasketDraft(previewBasketDraft)).toEqual([]);
  });

  it("reports duplicate constituents, invalid amounts, and unsafe lending parameters", () => {
    const invalidDraft = {
      ...previewBasketDraft,
      assets: [previewBasketDraft.assets[0], { ...previewBasketDraft.assets[0], amount: "0" }],
      ltvBps: 9_501,
      loanDurationDays: 0,
    };

    expect(validatePreviewBasketDraft(invalidDraft)).toEqual(
      expect.arrayContaining([
        "Underlying addresses must be unique.",
        "Every underlying requires a positive bundle amount.",
        "Loan duration must be positive.",
        "LTV cannot exceed 95%.",
      ])
    );
  });
});
