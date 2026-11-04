import { Check } from "lucide-react";

import {
  STATUS_NAMES,
  type SupportStatus,
} from "@/lib/support/tickets-helpers";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<SupportStatus, string> = {
  received: "bg-info-muted text-info-foreground border-info-border",
  in_review: "bg-warning-muted text-warning-foreground border-warning-border",
  concluded: "bg-success-muted text-success-foreground border-transparent",
  archived: "bg-muted text-muted-foreground border-transparent",
};

export function StatusBadge({
  status,
  className,
}: {
  status: SupportStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_NAMES[status]}
    </span>
  );
}

// Recebido → Em análise → Concluído (or Arquivado), as in the ticket's
// lifecycle.
export function StatusSteps({ status }: { status: SupportStatus }) {
  const last = status === "archived" ? "archived" : "concluded";
  const steps: SupportStatus[] = ["received", "in_review", last];
  const current = steps.indexOf(status);
  return (
    <ol className="flex items-center gap-2 overflow-x-auto text-xs">
      {steps.map((step, index) => {
        const done = index < current || (index === current && index === 2);
        const active = index === current && !done;
        return (
          <li key={step} className="flex items-center gap-2">
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  "h-px w-6 sm:w-10",
                  index <= current ? "bg-foreground" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                done && "bg-foreground text-background border-foreground",
                active &&
                  "border-avelliq text-foreground ring-avelliq/20 ring-4",
                !done && !active && "text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}
            </span>
            <span
              className={cn(
                "whitespace-nowrap",
                index <= current
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
              )}
            >
              {STATUS_NAMES[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
