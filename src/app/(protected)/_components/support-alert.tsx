"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { getSupportAlert } from "@/actions/support-alert";

const POLL_MS = 60 * 1000;

const AwaitingContext = createContext(0);

// Tickets waiting for the team, for the header alert and the sidebar badge.
// Polled every minute while the tab is visible, so a new message shows up
// without reloading the page.
export function SupportAlertProvider({
  enabled,
  initial,
  children,
}: {
  enabled: boolean;
  initial: number;
  children: ReactNode;
}) {
  const [awaiting, setAwaiting] = useState(initial);
  const poll = useAction(getSupportAlert, {
    onSuccess: ({ data }) => data && setAwaiting(data.awaiting),
  });
  const { execute } = poll;

  useEffect(() => setAwaiting(initial), [initial]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const tick = () => {
      if (document.visibilityState === "visible") {
        execute();
      }
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, execute]);

  return (
    <AwaitingContext.Provider value={enabled ? awaiting : 0}>
      {children}
    </AwaitingContext.Provider>
  );
}

export const useAwaitingTickets = () => useContext(AwaitingContext);

// Always in the header, so it shows with the sidebar closed and on phones.
export function SupportAlert() {
  const awaiting = useAwaitingTickets();
  if (awaiting === 0) {
    return null;
  }
  const label =
    awaiting === 1
      ? "1 atendimento aguardando a equipe"
      : `${awaiting} atendimentos aguardando a equipe`;
  return (
    <Link
      href="/atendimento?status=awaiting"
      prefetch={false}
      aria-label={label}
      title={label}
      className="bg-avelliq text-avelliq-foreground ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm transition-opacity hover:opacity-90"
    >
      <span className="relative flex">
        <Bell className="h-4 w-4" aria-hidden />
        <span className="bg-destructive absolute -top-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full motion-reduce:animate-none" />
      </span>
      {awaiting}
      <span className="hidden sm:inline">
        {awaiting === 1 ? "nova no Atendimento" : "novas no Atendimento"}
      </span>
    </Link>
  );
}
