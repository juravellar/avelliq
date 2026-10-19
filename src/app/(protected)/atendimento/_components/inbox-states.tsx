import { InboxError } from "@/lib/support/inbox";
import { safeEmailHtml } from "@/lib/support/inbox-helpers";

// What to tell the admin when the inbox can't be read.
export function InboxProblem({ error }: { error?: unknown }) {
  const unauthorized = error instanceof InboxError && error.keyProblem;
  return (
    <div className="border-warning-border bg-warning-muted text-warning-foreground rounded-lg border p-4 text-sm">
      {!error ? (
        <>
          A caixa de entrada não está configurada. Crie uma chave{" "}
          <strong>Full access</strong> no Resend e coloque em{" "}
          <code>RESEND_RECEIVING_API_KEY</code> na Vercel.
        </>
      ) : unauthorized ? (
        <>
          O Resend recusou a chave <code>RESEND_RECEIVING_API_KEY</code>.
          Confira o valor e se ela tem permissão <strong>Full access</strong>{" "}
          (chaves só de envio não leem a caixa de entrada).
        </>
      ) : (
        <>
          Não foi possível carregar os e-mails agora. Tente de novo em alguns
          instantes.
        </>
      )}
    </div>
  );
}

// A received e-mail's body. Plain text when there is one; otherwise the
// HTML in a sandboxed frame: no scripts, no remote images, links without
// their address, and any leftover link aimed at a new window, which the
// sandbox blocks. An e-mail can neither run code in the app nor tell its
// sender it was opened.
export function EmailBody({
  text,
  html,
}: {
  text: string | null;
  html: string | null;
}) {
  if (text?.trim()) {
    return (
      <pre className="font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">
        {text.trim()}
      </pre>
    );
  }
  if (html?.trim()) {
    const document = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><base target="_blank"><style>body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111;margin:12px;word-break:break-word}</style></head><body>${safeEmailHtml(html)}</body></html>`;
    return (
      <iframe
        title="Conteúdo do e-mail"
        sandbox=""
        srcDoc={document}
        className="h-[420px] w-full rounded-md border bg-white"
      />
    );
  }
  return <p className="text-muted-foreground text-sm">E-mail sem conteúdo.</p>;
}
