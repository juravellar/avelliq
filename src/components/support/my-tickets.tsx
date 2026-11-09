"use client";

import { ChevronRight, Inbox, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useRef, useState } from "react";

import {
  getMyTicket,
  listMyTickets,
  replyMyTicket,
} from "@/actions/my-support-tickets";
import { CLINIC_TIMEZONE } from "@/helpers/time";
import { actionErrorMessage } from "@/lib/action-errors";
import {
  isFinalStatus,
  splitQuotedReply,
  STATUS_NAMES,
} from "@/lib/support/tickets-helpers";
import { cn } from "@/lib/utils";

import { StatusBadge } from "./status-badge";

const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIMEZONE,
  }).format(new Date(iso));

function Problem({ error }: { error?: string }) {
  return (
    <p role="alert" className="text-destructive px-4 py-4 text-sm">
      {actionErrorMessage(
        { serverError: error },
        "Não foi possível carregar seus atendimentos. Tente de novo.",
      )}
    </p>
  );
}

// The signed-in person's tickets, newest activity first.
export function MyTicketList({
  onOpen,
}: {
  onOpen: (ticketId: string) => void;
}) {
  const list = useAction(listMyTickets);
  useEffect(() => {
    list.execute();
    // Loads once per opening of the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (list.result.serverError) {
    return <Problem error={list.result.serverError} />;
  }
  if (!list.result.data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (list.result.data.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm">
        <Inbox className="h-7 w-7" aria-hidden />
        Você ainda não abriu nenhum atendimento.
      </div>
    );
  }
  return (
    <ul className="flex-1 divide-y overflow-y-auto overscroll-contain">
      {list.result.data.map((ticket) => (
        <li key={ticket.id}>
          <button
            type="button"
            onClick={() => onOpen(ticket.id)}
            className="hover:bg-accent flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs font-semibold">
                  {ticket.protocol}
                </span>
                <StatusBadge status={ticket.status} />
                {ticket.unread && (
                  <span className="bg-avelliq text-avelliq-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                    Nova resposta
                  </span>
                )}
              </div>
              <p className="truncate text-sm">{ticket.subject}</p>
              <p className="text-muted-foreground text-xs">
                {when(ticket.lastMessageAt)}
              </p>
            </div>
            <ChevronRight
              className="text-muted-foreground h-4 w-4 shrink-0"
              aria-hidden
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

// One ticket's conversation, with a box to answer while it is open. A
// finalized ticket offers a new one that quotes its protocol.
export function MyTicket({
  ticketId,
  onDisagree,
}: {
  ticketId: string;
  onDisagree: (protocol: string) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const load = useAction(getMyTicket, {
    // The help button's "new answer" badge comes from the server.
    onSuccess: () => router.refresh(),
  });
  const reply = useAction(replyMyTicket, {
    onSuccess: () => setDraft(""),
  });
  useEffect(() => {
    load.execute({ ticketId });
    // Loads once per ticket opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const ticket = reply.result.data ?? load.result.data;
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [ticket]);

  if (load.result.serverError) {
    return <Problem error={load.result.serverError} />;
  }
  if (!ticket) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }
  const final = isFinalStatus(ticket.status);
  const replyError =
    reply.result.validationErrors?.message?._errors?.[0] ??
    (reply.result.serverError
      ? actionErrorMessage(
          { serverError: reply.result.serverError },
          "Não foi possível enviar. Tente de novo.",
        )
      : null);

  return (
    <>
      <div className="border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold">
            {ticket.protocol}
          </span>
          <StatusBadge status={ticket.status} />
        </div>
        <p className="text-muted-foreground truncate text-xs">
          {ticket.subject}
        </p>
      </div>
      <div
        ref={listRef}
        aria-live="polite"
        className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {ticket.messages.map((message) => (
          <div key={message.id} className="space-y-1">
            {message.body && (
              <div
                className={cn(
                  "flex",
                  message.fromTeam ? "justify-start" : "justify-end",
                )}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-line",
                    message.fromTeam
                      ? "bg-avelliq-muted text-foreground rounded-bl-md"
                      : "bg-avelliq text-avelliq-foreground rounded-br-md",
                  )}
                >
                  {message.fromTeam && (
                    <p className="mb-0.5 text-xs font-semibold">
                      Equipe Avelliq
                    </p>
                  )}
                  {splitQuotedReply(message.body).reply}
                  <p
                    className={cn(
                      "mt-1 text-right text-[10px]",
                      message.fromTeam ? "text-muted-foreground" : "opacity-80",
                    )}
                  >
                    {when(message.createdAt)}
                  </p>
                </div>
              </div>
            )}
            {message.statusChange && (
              <p className="text-muted-foreground text-center text-[11px]">
                Status: {STATUS_NAMES[message.statusChange]}
              </p>
            )}
          </div>
        ))}
      </div>
      {final ? (
        <div className="space-y-2 border-t px-4 py-3 text-xs">
          <p className="text-muted-foreground">
            Este atendimento foi {STATUS_NAMES[ticket.status].toLowerCase()}. Se
            não concordar com a resposta, abra um novo atendimento informando o
            protocolo {ticket.protocol}.
          </p>
          <button
            type="button"
            onClick={() => onDisagree(ticket.protocol)}
            className="border-avelliq hover:bg-avelliq-muted w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
          >
            Abrir novo atendimento
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            reply.execute({ ticketId: ticket.id, message: draft });
          }}
          className="space-y-1.5 border-t px-3 pt-3 pb-2"
        >
          {replyError && (
            <p role="alert" className="text-destructive text-xs">
              {replyError}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Responda à equipe…"
              aria-label="Sua resposta"
              className="border-input bg-background focus-visible:border-avelliq focus-visible:ring-avelliq/30 min-w-0 flex-1 resize-none rounded-2xl border px-3.5 py-2 text-sm outline-none focus-visible:ring-[3px]"
            />
            <button
              type="submit"
              disabled={draft.trim().length < 2 || reply.isPending}
              aria-label="Enviar resposta"
              className="bg-avelliq text-avelliq-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-[opacity,transform] active:scale-95 disabled:opacity-40"
            >
              {reply.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-muted-foreground text-center text-[11px]">
            A equipe também responde por e-mail.
          </p>
        </form>
      )}
    </>
  );
}
