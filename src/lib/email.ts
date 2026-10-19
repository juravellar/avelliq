const RESEND_API_URL = "https://api.resend.com/emails";

// Email is optional: without a provider the app works as before, only
// without email verification.
export const isEmailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export async function sendEmail({
  replyTo,
  ...message
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  // Where "Reply" goes, e.g. the person who wrote to support.
  replyTo?: string;
}) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      ...message,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // The recipient is personal data; the status is enough to investigate.
    throw new Error(`Email provider responded ${response.status}`);
  }
}

export const verificationEmail = (url: string) => ({
  subject: "Confirme seu email no Avelliq",
  text: `Para ativar sua conta no Avelliq, abra este link:\n\n${url}\n\nSe você não criou uma conta, ignore este email.`,
  html: `<p>Para ativar sua conta no Avelliq, clique no link abaixo:</p>
<p><a href="${escapeHtml(url)}">Confirmar meu email</a></p>
<p>Se você não criou uma conta, ignore este email.</p>`,
});

export const resetPasswordEmail = (url: string) => ({
  subject: "Redefinir sua senha no Avelliq",
  text: `Recebemos um pedido para redefinir a senha da sua conta no Avelliq. Para criar uma nova senha, abra este link (vale por 1 hora):\n\n${url}\n\nSe você não pediu, ignore este email: sua senha continua a mesma.`,
  html: `<p>Recebemos um pedido para redefinir a senha da sua conta no Avelliq.</p>
<p><a href="${escapeHtml(url)}">Criar uma nova senha</a> (o link vale por 1 hora)</p>
<p>Se você não pediu, ignore este email: sua senha continua a mesma.</p>`,
});

export interface SupportRequestEmail {
  topic: string;
  message: string;
  name: string;
  email: string;
  // Account context, when the person was signed in.
  account?: { clinic: string | null; plan: string; userId: string };
  page: string | null;
}

// A message from the "Falar com a equipe" form. Replying answers the person.
export const supportRequestEmail = (request: SupportRequestEmail) => {
  const summary = request.message.replace(/\s+/g, " ").slice(0, 60);
  const details = [
    `Nome: ${request.name}`,
    `E-mail: ${request.email}`,
    request.account
      ? `Conta: ${request.account.userId} · Plano: ${request.account.plan} · Clínica: ${request.account.clinic ?? "nenhuma"}`
      : "Conta: não estava logado",
    request.page ? `Página: ${request.page}` : null,
  ].filter(Boolean) as string[];
  return {
    subject: `[Avelliq · ${request.topic}] ${summary}`,
    text: `${details.join("\n")}\n\n${request.message}`,
    html: `<p>${details.map(escapeHtml).join("<br>")}</p>
<p style="white-space:pre-wrap">${escapeHtml(request.message)}</p>`,
  };
};
