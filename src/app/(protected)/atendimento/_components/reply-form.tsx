"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

import { replySupportEmail } from "@/actions/reply-support-email";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { actionErrorMessage } from "@/lib/action-errors";

// The answer to a received e-mail. It goes out from the support address,
// in the same thread, with the original quoted below.
export function ReplyForm({
  id,
  to,
  from,
}: {
  id: string;
  to: string;
  from: string | null;
}) {
  const [message, setMessage] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const reply = useAction(replySupportEmail, {
    onSuccess: ({ data }) => {
      setSentTo(data?.sentTo ?? to);
      setMessage("");
    },
  });
  const error =
    reply.result.validationErrors?.message?._errors?.[0] ??
    (reply.result.serverError
      ? actionErrorMessage(
          { serverError: reply.result.serverError },
          "Não foi possível enviar a resposta. Tente de novo.",
        )
      : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Responder</CardTitle>
        <p className="text-muted-foreground text-sm break-all">
          Para {to}
          {from ? `, enviado como ${from}` : ""}. A mensagem original vai citada
          abaixo da resposta.
        </p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSentTo(null);
            reply.execute({ id, message });
          }}
          className="space-y-3"
        >
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={7}
            maxLength={10_000}
            placeholder="Escreva sua resposta…"
            aria-label="Resposta"
          />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {sentTo && (
            <p className="text-success-foreground flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Resposta enviada para {sentTo}.
            </p>
          )}
          <Button
            type="submit"
            disabled={reply.isPending || !message.trim()}
            className="w-full sm:w-auto"
          >
            {reply.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar resposta
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
