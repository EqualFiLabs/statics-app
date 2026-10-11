type Counter = { windowStartedAt: number; count: number };

export const cspReportLimiterState = globalThis as typeof globalThis & {
  __staticsCspReportLimits?: Map<string, Counter>;
};

export function resetCspReportLimiterForTests(): void {
  cspReportLimiterState.__staticsCspReportLimits?.clear();
}
