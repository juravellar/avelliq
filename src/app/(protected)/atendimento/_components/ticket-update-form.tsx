"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

import { updateSupportTicket } from "@/actions/update-support-ticket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { actionErrorMessage } from "@/lib/action-errors";
import {
  isFinalStatus,
  STATUS_NAMES,
  SUPPORT_STATUSES,
  type SupportStatus,
} from "@/lib/support/tickets-helpers";

// The team's update: a message to the customer, a new status, or both.
// Concluding or archiving requires a message, which tells the customer how
// to disagree.
export function TicketUpdateForm({
  ticketId,
  status,
  to,
  from,
  canEmail,
}: {
  ticketId: string;
  status: SupportStatus;
  to: string;
  from: string | null;
  canEmail: boolean;
}) {
  const router = useRouter();
  // A first answer usually starts the analysis.
  const [next, setNext] = useState<SupportStatus>(
    status === "received" ? "in_review" : status,
  );
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const update = useAction(updateSupportTicket, {
    onSuccess: ({ data }) => {
      setDone(
        data?.sentTo
          ? `Mensagem enviada para ${data.sentTo}.`
          : "Status atualizado.",
      );
      setMessage("");
      router.refresh();
    },
  });
  const error =
    update.result.validationErrors?.message?._errors?.[0] ??
    (update.result.serverError
      ? actionErrorMessage(
          { serverError: update.result.serverError },
          "Não foi possível atualizar o atendimento. Tente de novo.",
        )
      : null);
  const finalizing = isFinalStatus(next);
  const blocked =
    update.isPending ||
    (finalizing && canEmail && !message.trim()) ||
    (!message.trim() && next === status);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Atualizar atendimento</CardTitle>
        <p className="text-muted-foreground text-sm">
          {canEmail ? (
            <>
              A mensagem vai para <span className="break-all">{to}</span>
              {from ? `, enviada como ${from}` : ""}, com o protocolo. Ao
              concluir ou arquivar, a mensagem é obrigatória e o cliente recebe
              o aviso de que, para contestar, deve abrir um novo atendimento
              informando o protocolo.
            </>
          ) : (
            "Este atendimento veio de um endereço do próprio Avelliq: dá para mudar o status, mas não há para quem enviar mensagem."
          )}
        </p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setDone(null);
            update.execute({ ticketId, status: next, message });
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <label htmlFor="ticket-status" className="text-sm font-medium">
              Status
            </label>
            <Select
              value={next}
              onValueChange={(value) => setNext(value as SupportStatus)}
            >
              <SelectTrigger id="ticket-status" className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORT_STATUSES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {STATUS_NAMES[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canEmail && (
            <div className="space-y-1.5">
              <label htmlFor="ticket-message" className="text-sm font-medium">
                Mensagem para o cliente
                {finalizing && <span className="text-destructive"> *</span>}
              </label>
              <Textarea
                id="ticket-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={7}
                maxLength={10_000}
                placeholder={
                  finalizing
                    ? "Explique a conclusão para o cliente…"
                    : "Escreva sua resposta (opcional se só mudar o status)…"
                }
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {done && (
            <p className="text-success-foreground flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {done}
            </p>
          )}
          <Button type="submit" disabled={blocked} className="w-full sm:w-auto">
            {update.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {message.trim() ? "Enviar e atualizar" : "Atualizar status"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
