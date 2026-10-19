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
  from = process.env.EMAIL_FROM,
  ...message
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  // Defaults to EMAIL_FROM (the no-reply address).
  from?: string;
  // Threading headers of a reply (In-Reply-To, References).
  headers?: Record<string, string>;
}) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, ...message }),
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

// An answer from the support inbox: the text typed, then the original quoted.
export const supportReplyEmail = (answer: string, quoted: string) => {
  const text = `${answer.trim()}${quoted}`;
  return {
    text,
    html: `<p style="white-space:pre-wrap">${escapeHtml(answer.trim())}</p>${
      quoted
        ? `<blockquote style="margin:16px 0 0;padding-left:12px;border-left:3px solid #ccc;color:#555;white-space:pre-wrap">${escapeHtml(quoted.trim())}</blockquote>`
        : ""
    }`,
  };
};
