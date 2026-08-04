export type ProtocolActionStepStatus = "pending" | "active" | "confirmed" | "skipped" | "failed";

export type ProtocolActionStep = Readonly<{
  id: string;
  label: string;
  isSatisfied?: () => Promise<boolean>;
  run: () => Promise<void>;
}>;

export type ProtocolActionProgress = Readonly<{
  current: number;
  total: number;
  stepId: string;
  label: string;
  status: ProtocolActionStepStatus;
}>;

export async function executeProtocolActionPlan(
  steps: readonly ProtocolActionStep[],
  onProgress?: (progress: ProtocolActionProgress) => void
): Promise<void> {
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!;
    const progress = (status: ProtocolActionStepStatus) =>
      onProgress?.({
        current: index + 1,
        total: steps.length,
        stepId: step.id,
        label: step.label,
        status,
      });

    if (step.isSatisfied && (await step.isSatisfied())) {
      progress("skipped");
      continue;
    }

    progress("active");
    try {
      await step.run();
      progress("confirmed");
    } catch (error) {
      progress("failed");
      throw error;
    }
  }
}

export function protocolActionProgressLabel(
  progress: ProtocolActionProgress | null
): string | null {
  if (!progress) return null;
  if (progress.status === "failed") {
    return `Stopped at ${progress.current} of ${progress.total}: ${progress.label}`;
  }
  return `${progress.current} of ${progress.total} — ${progress.label}`;
}
