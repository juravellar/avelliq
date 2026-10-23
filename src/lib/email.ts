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

const BRAND = "#0B68F7";
const INK = "#0E0A2F";
const MUTED = "#6B6B80";
const BORDER = "#E6E6EE";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const PRODUCTION_URL = "https://www.avelliq.com.br";

// Always from production: a preview deployment behind Vercel's login would
// show the logo as a broken image.
const LOGO_URL = `${PRODUCTION_URL}/apple-icon.png`;

// `||`, not `??`: an empty variable (as .env.example leaves it) means unset.
const appUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || PRODUCTION_URL).replace(/\/$/, "");

// Gmail and Apple Mail fill the inbox preview with whatever text follows the
// preview line; these invisible characters take that space instead.
const PREVIEW_PADDING = "&#847;&zwnj;&nbsp;".repeat(60);

// Email clients ignore <style> and modern CSS, so the layout is tables with
// inline styles. The header logo is a PNG (Gmail drops SVG) with the name
// beside it as text, so it still reads as Avelliq when images are blocked.
// Outlook on Windows ignores max-width, hence the fixed-width table only it
// sees (the [if mso] comments).
// `body` is trusted HTML: callers escape what came from users.
const emailLayout = ({
  preview,
  heading,
  body,
  action,
  footnote,
}: {
  // The line inboxes show after the subject.
  preview: string;
  heading?: string;
  body: string;
  action?: { label: string; url: string };
  footnote?: string;
}) => {
  const url = appUrl();
  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr>
<td style="border-radius:8px;background:${BRAND}"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(action.label)}</a></td>
</tr></table>
<p style="margin:20px 0 0;font-size:13px;line-height:20px;color:${MUTED}">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${escapeHtml(action.url)}" style="color:${BRAND};word-break:break-all">${escapeHtml(action.url)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#F4F5FA">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preview)}${PREVIEW_PADDING}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5FA">
<tr><td align="center" style="padding:32px 16px">
<!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px">
<a href="${url}" style="text-decoration:none"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle"><img src="${LOGO_URL}" width="32" height="32" alt="" style="display:block;border:0;border-radius:7px"></td>
<td style="vertical-align:middle;padding-left:10px;font-family:${FONT};font-size:20px;font-weight:700;letter-spacing:-0.2px;color:${INK}">Avelliq</td>
</tr></table></a>
</td></tr>
<tr><td style="background:#ffffff;border:1px solid ${BORDER};border-top:4px solid ${BRAND};border-radius:12px;padding:36px 36px 32px;font-family:${FONT};font-size:15px;line-height:24px;color:${INK}">
${heading ? `<h1 style="margin:0 0 16px;font-size:22px;line-height:30px;font-weight:700;color:${INK}">${escapeHtml(heading)}</h1>` : ""}${body}${button}${footnote ? note(footnote) : ""}
</td></tr>
<tr><td style="padding:24px 4px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED}">
Avelliq · Agendamento para clínicas<br>
<a href="${url}" style="color:${MUTED}">${escapeHtml(url.replace(/^https?:\/\//, ""))}</a>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
};

const paragraph = (html: string) => `<p style="margin:0 0 14px">${html}</p>`;

const note = (html: string) =>
  `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${BORDER};font-size:13px;line-height:20px;color:${MUTED}">${html}</p>`;

export async function sendEmail({
  from = process.env.EMAIL_FROM,
  replyTo,
  ...message
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  // Defaults to EMAIL_FROM (the no-reply address).
  from?: string;
  // Where "Reply" goes, e.g. the person who wrote to support.
  replyTo?: string;
  // Threading headers of a reply (In-Reply-To, References).
  headers?: Record<string, string>;
}) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
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
  html: emailLayout({
    preview: "Falta só um passo para ativar sua conta.",
    heading: "Confirme seu email",
    body: paragraph(
      "Boas-vindas ao Avelliq! Para ativar sua conta, confirme que este email é seu.",
    ),
    action: { label: "Confirmar meu email", url },
    footnote: "Se você não criou uma conta no Avelliq, ignore este email.",
  }),
});

export const resetPasswordEmail = (url: string) => ({
  subject: "Redefinir sua senha no Avelliq",
  text: `Recebemos um pedido para redefinir a senha da sua conta no Avelliq. Para criar uma nova senha, abra este link (vale por 1 hora):\n\n${url}\n\nSe você não pediu, ignore este email: sua senha continua a mesma.`,
  html: emailLayout({
    preview: "O link para criar uma nova senha vale por 1 hora.",
    heading: "Redefinir sua senha",
    body: paragraph(
      "Recebemos um pedido para redefinir a senha da sua conta no Avelliq. Para criar uma nova senha, use o botão abaixo. O link vale por <strong>1 hora</strong>.",
    ),
    action: { label: "Criar uma nova senha", url },
    footnote:
      "Se você não pediu, ignore este email: sua senha continua a mesma.",
  }),
});

// An answer from the support inbox: the text typed, then the original quoted.
export const supportReplyEmail = (answer: string, quoted: string) => {
  const text = `${answer.trim()}${quoted}`;
  return {
    text,
    html: emailLayout({
      preview: answer.trim().replace(/\s+/g, " ").slice(0, 100),
      body: `<p style="margin:0;white-space:pre-wrap">${escapeHtml(answer.trim())}</p>${
        quoted
          ? `<blockquote style="margin:24px 0 0;padding:4px 0 4px 14px;border-left:3px solid ${BORDER};font-size:13px;line-height:20px;color:${MUTED};white-space:pre-wrap">${escapeHtml(quoted.trim())}</blockquote>`
          : ""
      }`,
      footnote: "Para continuar a conversa, é só responder este email.",
    }),
  };
};

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
    html: emailLayout({
      preview: summary,
      heading: `Nova mensagem: ${request.topic}`,
      body: `<p style="margin:0;white-space:pre-wrap">${escapeHtml(request.message)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#F4F5FA;border-radius:8px">
<tr><td style="padding:14px 16px;font-size:13px;line-height:21px;color:${MUTED}">${details.map(escapeHtml).join("<br>")}</td></tr>
</table>`,
      footnote: "Responder este email responde a pessoa diretamente.",
    }),
  };
};
