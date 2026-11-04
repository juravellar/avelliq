"use client";

import { MessageCircle, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

import type { SupportPanelProps } from "./support-panel";

// The answers and the matcher are only downloaded on the first click, not
// on every page that shows the button.
const SupportPanel = dynamic(() => import("./support-panel"), { ssr: false });

// Avelliq's help button. Always in Avelliq's colors, whatever the clinic's
// brand.
export function SupportWidget(props: SupportPanelProps) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [linkedTicket, setLinkedTicket] = useState<string | null>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);

  // The e-mails' "Ver conversa no Avelliq" opens /painel?atendimento=<id>:
  // the panel opens on that conversation and the address loses the id.
  useEffect(() => {
    const url = new URL(window.location.href);
    const ticketId = url.searchParams.get("atendimento");
    if (!ticketId || !props.user) {
      return;
    }
    setLinkedTicket(ticketId);
    setStarted(true);
    setOpen(true);
    url.searchParams.delete("atendimento");
    window.history.replaceState(null, "", url);
  }, [props.user]);

  // On phones the open panel covers the page: the page behind stays still
  // instead of scrolling along with the chat.
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 639px)").matches) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {started && (
        <SupportPanel
          id={panelId}
          open={open}
          onClose={close}
          initialTicketId={linkedTicket}
          {...props}
        />
      )}
      <button
        type="button"
        onClick={() => {
          setStarted(true);
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        aria-controls={started ? panelId : undefined}
        aria-label={open ? "Fechar ajuda" : "Abrir ajuda"}
        // Open, it turns neutral (it closes, unlike the blue "Enviar" above
        // it) and, on phones, gives way to the panel's own close button.
        className={cn(
          "relative flex h-12 items-center gap-2 rounded-full px-4 font-medium shadow-lg transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-xl active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          open
            ? "bg-muted text-foreground border max-sm:hidden"
            : "bg-avelliq text-avelliq-foreground",
        )}
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <MessageCircle className="h-5 w-5" aria-hidden />
        )}
        <span className="hidden text-sm sm:inline">Ajuda</span>
        {!open && (props.unreadTickets ?? 0) > 0 && (
          <span
            className="bg-destructive absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white"
            aria-label={`${props.unreadTickets} resposta(s) nova(s) da equipe`}
          >
            {props.unreadTickets}
          </span>
        )}
      </button>
    </div>
  );
}
