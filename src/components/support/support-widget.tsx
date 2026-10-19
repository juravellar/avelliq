"use client";

import { MessageCircle, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useId, useState } from "react";

import type { SupportPanelProps } from "./support-panel";

// The answers and the matcher are only downloaded on the first click, not
// on every page that shows the button.
const SupportPanel = dynamic(() => import("./support-panel"), { ssr: false });

// Avelliq's help button. Always in Avelliq's colors, whatever the clinic's
// brand.
export function SupportWidget(props: SupportPanelProps) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {started && (
        <SupportPanel id={panelId} open={open} onClose={close} {...props} />
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
        className="bg-avelliq text-avelliq-foreground flex h-12 items-center gap-2 rounded-full px-4 font-medium shadow-lg transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-xl active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <MessageCircle className="h-5 w-5" aria-hidden />
        )}
        <span className="hidden text-sm sm:inline">Ajuda</span>
      </button>
    </div>
  );
}
