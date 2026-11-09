// What to tell the team when the inbox isn't configured. Tickets already
// stored, and the help form's, are still listed below it.
export function InboxProblem() {
  return (
    <div className="border-warning-border bg-warning-muted text-warning-foreground rounded-lg border p-4 text-sm">
      A caixa de entrada não está configurada, então só as mensagens do
      formulário de ajuda aparecem aqui. Para trazer os e-mails recebidos, crie
      uma chave <strong>Full access</strong> no Resend e coloque em{" "}
      <code>RESEND_RECEIVING_API_KEY</code> na Vercel.
    </div>
  );
}
