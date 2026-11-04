import Link from "next/link";

import { BLOCKED_COPY, type CreateGate } from "@/lib/create-gate";
import { cn } from "@/lib/utils";

export function CreateGateHint({ gate }: { gate: CreateGate }) {
  if (!gate.usageText && !gate.blockedReason) {
    return null;
  }
  return (
    <p
      className={cn(
        "text-right text-xs",
        gate.blockedReason
          ? "text-warning-foreground"
          : "text-muted-foreground",
      )}
    >
      {gate.blockedReason ? `${gate.blockedReason} ` : null}
      {gate.usageText}
      {gate.blockedKind ? (
        <>
          {" · "}
          <Link
            href={BLOCKED_COPY[gate.blockedKind].href}
            className="font-medium underline"
          >
            {BLOCKED_COPY[gate.blockedKind].action}
          </Link>
        </>
      ) : null}
    </p>
  );
}
