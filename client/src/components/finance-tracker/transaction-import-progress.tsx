import { AlertCircle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { TransactionImportStage } from "@shared/transaction-import";

export type ImportProgressStage = TransactionImportStage | "failed";

const stages: TransactionImportStage[] = [
  "validation",
  "processing",
  "duplicates",
  "review",
  "finalization",
];

const stageLabels: Record<TransactionImportStage, string> = {
  validation: "Validate file",
  processing: "Process & categorize",
  duplicates: "Check duplicates",
  review: "Review rows",
  finalization: "Save & complete",
  complete: "Save & complete",
};

export function transactionImportStageLabel(stage: TransactionImportStage) {
  return stageLabels[stage];
}

export function TransactionImportProgress({
  current,
  failedAt,
}: {
  current: ImportProgressStage;
  failedAt?: TransactionImportStage;
}) {
  const visibleCurrent = current === "complete" ? "finalization" : current;
  const currentIndex = stages.indexOf(visibleCurrent as TransactionImportStage);
  const statusIndex = current === "failed"
    ? stages.indexOf(failedAt ?? "validation")
    : currentIndex;
  return (
    <nav aria-label="Import progress" className="w-full rounded-xl border border-border/80 bg-card px-3 py-4 sm:px-5">
      <ol className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-5">
        {stages.map((stage, index) => {
          const failed = current === "failed" && stage === failedAt;
          const complete = index < statusIndex || (current === "complete" && index === currentIndex);
          const active = current === stage || (current === "complete" && stage === "finalization");
          const isWorking = active && current !== "complete" && ["validation", "processing", "duplicates", "finalization"].includes(stage);
          const Icon = complete ? CheckCircle2 : failed ? AlertCircle : isWorking ? Loader2 : Circle;
          return (
            <li
              key={stage}
              aria-current={active ? "step" : undefined}
              className="relative flex min-w-0 flex-col items-center gap-1.5 text-center"
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={`absolute right-1/2 top-3.5 hidden h-px w-full -translate-y-1/2 sm:block ${complete || active ? "bg-primary/55" : "bg-border"}`}
                />
              )}
              <span className={`relative z-[1] grid h-7 w-7 place-items-center rounded-full border bg-card ${
                failed ? "border-destructive text-destructive"
                  : complete ? "border-primary bg-primary text-primary-foreground"
                    : active ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
              }`}>
                <Icon className={`h-3.5 w-3.5 ${isWorking ? "animate-spin" : ""}`} aria-hidden />
              </span>
              <span className={`text-[10px] leading-tight sm:text-[11px] ${active || complete || failed ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {stageLabels[stage]}
              </span>
              <span className="sr-only">{failed ? "Failed" : complete ? "Completed" : active ? "Current step" : "Upcoming"}</span>
            </li>
          );
        })}
      </ol>
      <p role="status" aria-live="polite" className="sr-only">
        {current === "failed"
          ? `Import failed during ${failedAt ? stageLabels[failedAt] : "the current step"}.`
          : current === "complete"
            ? "Import complete."
            : `${stageLabels[current]} in progress.`}
      </p>
    </nav>
  );
}
