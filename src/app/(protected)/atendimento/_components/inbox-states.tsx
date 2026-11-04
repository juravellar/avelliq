import { InboxError } from "@/lib/support/inbox";

// What to tell the team when new e-mails can't be brought in. Tickets
// already stored, and the help form's, are still listed below it.
export function InboxProblem({ error }: { error?: unknown }) {
  const unauthorized = error instanceof InboxError && error.keyProblem;
  return (
    <div className="border-warning-border bg-warning-muted text-warning-foreground rounded-lg border p-4 text-sm">
      {!error ? (
        <>
          A caixa de entrada não está configurada, então só as mensagens do
          formulário de ajuda aparecem aqui. Para trazer os e-mails recebidos,
          crie uma chave <strong>Full access</strong> no Resend e coloque em{" "}
          <code>RESEND_RECEIVING_API_KEY</code> na Vercel.
        </>
      ) : unauthorized ? (
        <>
          O Resend recusou a chave <code>RESEND_RECEIVING_API_KEY</code>, então
          os e-mails novos não foram trazidos. Confira o valor e se ela tem
          permissão <strong>Full access</strong> (chaves só de envio não leem a
          caixa de entrada).
        </>
      ) : (
        <>
          Não foi possível trazer os e-mails novos agora. A lista mostra o que
          já foi importado; tente de novo em alguns instantes.
        </>
      )}
    </div>
  );
}
