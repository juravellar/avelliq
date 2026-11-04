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
const PAGE = "#EEF1F8";
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
// Outlook on Windows ignores max-width and rounded links, hence the
// fixed-width table and the VML button only it sees (the [if mso] comments).
// `body` and `afterAction` are trusted HTML: callers escape what came from
// users.
const emailLayout = ({
  preview,
  heading,
  badge,
  body,
  action,
  afterAction,
  footnote,
}: {
  // The line inboxes show after the subject.
  preview: string;
  heading?: string;
  // A short label on the right of the header, like the ticket's protocol.
  badge?: string;
  body: string;
  action?: { label: string; url: string };
  // Below the button, like the quoted earlier e-mail.
  afterAction?: string;
  footnote?: string;
}) => {
  const url = appUrl();
  const href = action ? escapeHtml(action.url) : "";
  const label = action ? `${escapeHtml(action.label)} &rarr;` : "";
  const button = action
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0"><tr><td align="center">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:54px;v-text-anchor:middle;width:440px" arcsize="18%" stroke="f" fillcolor="${BRAND}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:17px;font-weight:bold">${label}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${href}" style="display:block;padding:17px 24px;background:${BRAND};border-radius:10px;font-family:${FONT};font-size:17px;line-height:20px;font-weight:700;color:#ffffff;text-align:center;text-decoration:none">${label}</a><!--<![endif]-->
</td></tr></table>
<p style="margin:14px 0 0;font-size:12px;line-height:18px;color:${MUTED};text-align:center">Se o botão não funcionar, copie e cole no navegador:<br><a href="${href}" style="color:${BRAND};word-break:break-all">${href}</a></p>`
    : "";
  return `<!doctype html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:${PAGE}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preview)}${PREVIEW_PADDING}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}">
<tr><td align="center" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:16px;overflow:hidden">
<tr><td style="background:${BRAND};padding:20px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle"><a href="${url}" style="text-decoration:none"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle"><img src="${LOGO_URL}" width="34" height="34" alt="" style="display:block;border:2px solid #ffffff;border-radius:9px"></td>
<td style="vertical-align:middle;padding-left:10px;font-family:${FONT};font-size:20px;font-weight:700;letter-spacing:-0.2px;color:#ffffff">Avelliq</td>
</tr></table></a></td>
${badge ? `<td align="right" style="vertical-align:middle"><span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#ffffff;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.3px;color:${BRAND};white-space:nowrap">${escapeHtml(badge)}</span></td>` : ""}
</tr></table>
</td></tr>
<tr><td style="padding:32px 32px 28px;font-family:${FONT};font-size:15px;line-height:24px;color:${INK}">
${heading ? `<h1 style="margin:0 0 16px;font-size:24px;line-height:32px;font-weight:700;color:${INK}">${escapeHtml(heading)}</h1>` : ""}${body}${button}${afterAction ?? ""}${footnote ? note(footnote) : ""}
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td align="center" style="padding:22px 12px 0;font-family:${FONT};font-size:12px;line-height:19px;color:${MUTED}">
<strong style="color:${INK}">Avelliq</strong> · Agendamento para clínicas<br>
<a href="${url}" style="color:${MUTED};text-decoration:underline">${escapeHtml(url.replace(/^https?:\/\//, ""))}</a>
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

const protocolBox = (protocol: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:${PAGE};border-radius:10px">
<tr><td style="padding:16px 18px;font-size:13px;line-height:20px;color:${MUTED}">Protocolo<br><strong style="font-size:20px;line-height:30px;letter-spacing:0.5px;color:${INK}">${escapeHtml(protocol)}</strong></td></tr>
</table>`;

const whereToWrite = () =>
  process.env.SUPPORT_EMAIL
    ? `pelo botão Ajuda do Avelliq ou escrevendo para ${process.env.SUPPORT_EMAIL}`
    : "pelo botão Ajuda do Avelliq";

// A ticket that is over. Disagreeing means a new ticket that quotes this one.
const finalNotice = (protocol: string, statusName: string) =>
  `Este atendimento foi ${statusName}. Guarde o protocolo ${protocol}. Se não concordar com a resposta, abra um novo atendimento ${whereToWrite()} e informe este protocolo.`;

const TICKET_BUTTON = "Ver conversa no Avelliq";

// Sent when a ticket is opened, so the customer has its protocol. With an
// Avelliq account, a button opens the conversation in the help panel.
export const ticketReceivedEmail = (protocol: string, ticketUrl?: string) => {
  const kept = `Seu protocolo é ${protocol}. Guarde este número: ele identifica o seu atendimento.`;
  const more =
    "Para acrescentar informações, é só responder este e-mail. Não aceitamos anexos.";
  return {
    text: `Recebemos sua mensagem e já abrimos um atendimento.\n\n${kept}\n\n${more}${ticketUrl ? `\n\nAcompanhe no Avelliq: ${ticketUrl}` : ""}\n\nEste é um aviso automático.`,
    html: emailLayout({
      preview: `Seu protocolo é ${protocol}.`,
      heading: "Recebemos sua mensagem",
      body: `${paragraph("Já abrimos um atendimento e nossa equipe vai responder por aqui.")}${protocolBox(protocol)}${paragraph("Guarde este número: ele identifica o seu atendimento.")}${paragraph(escapeHtml(more))}`,
      action: ticketUrl ? { label: TICKET_BUTTON, url: ticketUrl } : undefined,
      footnote: "Este é um aviso automático.",
    }),
  };
};

// The team's answer to a ticket: the text typed, the protocol and, when the
// ticket is over, how to disagree; then the customer's message quoted.
// The link that opens a ticket in the customer's help panel.
export const ticketUrlFor = (ticketId: string) =>
  `${appUrl()}/painel?atendimento=${encodeURIComponent(ticketId)}`;

export const supportReplyEmail = ({
  answer,
  quoted,
  protocol,
  finalStatusName,
  ticketUrl,
}: {
  answer: string;
  quoted: string;
  protocol: string;
  // "concluído" or "arquivado" when this answer ends the ticket.
  finalStatusName?: string;
  // Only for customers with an Avelliq account: opens the conversation.
  ticketUrl?: string;
}) => {
  const notice = finalStatusName
    ? finalNotice(protocol, finalStatusName)
    : null;
  return {
    text: `${answer.trim()}\n\nProtocolo: ${protocol}${notice ? `\n\n${notice}` : ""}${ticketUrl ? `\n\nVer a conversa no Avelliq: ${ticketUrl}` : ""}${quoted}`,
    html: emailLayout({
      preview: answer.trim().replace(/\s+/g, " ").slice(0, 100),
      badge: `Protocolo ${protocol}`,
      body: `<p style="margin:0;white-space:pre-wrap">${escapeHtml(answer.trim())}</p>
<p style="margin:20px 0 0;font-size:14px;line-height:20px;color:${MUTED}">Atenciosamente,<br><strong style="color:${INK}">Equipe Avelliq</strong></p>${
        notice
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:${PAGE};border-left:4px solid ${BRAND};border-radius:8px">
<tr><td style="padding:14px 16px;font-size:13px;line-height:21px;color:${INK}">${escapeHtml(notice)}</td></tr>
</table>`
          : ""
      }`,
      action: ticketUrl ? { label: TICKET_BUTTON, url: ticketUrl } : undefined,
      // The earlier e-mail, quoted below the button so it doesn't push it
      // out of sight.
      afterAction: quoted
        ? `<blockquote style="margin:28px 0 0;padding:4px 0 4px 14px;border-left:3px solid ${BORDER};font-size:13px;line-height:20px;color:${MUTED};white-space:pre-wrap">${escapeHtml(quoted.trim())}</blockquote>`
        : undefined,
      footnote: notice
        ? `Protocolo ${escapeHtml(protocol)}.`
        : `Protocolo ${escapeHtml(protocol)}. Para continuar a conversa, é só responder este email${ticketUrl ? " ou usar o botão acima" : ""}.`,
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

// The help form's account details, for the team only.
export const supportRequestContext = (request: SupportRequestEmail) =>
  [
    request.account
      ? `Conta: ${request.account.userId} · Plano: ${request.account.plan} · Clínica: ${request.account.clinic ?? "nenhuma"}`
      : "Conta: não estava logado",
    request.page ? `Página: ${request.page}` : null,
  ]
    .filter(Boolean)
    .join("\n");

// The team's notice of a help-form ticket. The ticket is already in the
// Atendimento; answering there keeps the answer in its history.
export const supportRequestEmail = (
  request: SupportRequestEmail,
  protocol: string,
) => {
  const summary = request.message.replace(/\s+/g, " ").slice(0, 60);
  const details = [
    `Nome: ${request.name}`,
    `E-mail: ${request.email}`,
    supportRequestContext(request),
  ].join("\n");
  return {
    subject: `[Avelliq · Protocolo ${protocol}] ${request.topic}: ${summary}`,
    text: `${details}\n\n${request.message}`,
    html: emailLayout({
      preview: summary,
      heading: `Nova mensagem: ${request.topic}`,
      body: `${protocolBox(protocol)}<p style="margin:0;white-space:pre-wrap">${escapeHtml(request.message)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:${PAGE};border-radius:8px">
<tr><td style="padding:14px 16px;font-size:13px;line-height:21px;color:${MUTED};white-space:pre-wrap">${escapeHtml(details)}</td></tr>
</table>`,
      footnote:
        "Responda pelo Atendimento do Avelliq: assim a resposta fica no histórico do protocolo.",
    }),
  };
};
