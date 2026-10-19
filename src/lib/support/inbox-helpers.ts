// Rules for answering received mail, kept apart from the API calls so they
// can be tested.

export interface ReceivedEmailSummary {
  id: string;
  from: string;
  to: string[];
  subject: string | null;
  created_at: string;
  reply_to?: string[] | null;
}

export interface ReceivedEmail extends ReceivedEmailSummary {
  html: string | null;
  text: string | null;
  message_id: string | null;
  // Lower-case header names, as Resend returns them.
  headers?: Record<string, string> | null;
}

// "Ana <ana@x.com>" → "ana@x.com"; a bare address stays as it is.
export const addressOf = (value: string) => {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim();
};

// "Ana <ana@x.com>" → "Ana"; without a name, the address.
export const nameOf = (value: string) => {
  const match = value.match(/^\s*"?([^"<]+?)"?\s*</);
  return match ? match[1].trim() : addressOf(value);
};

// Where an answer goes: the Reply-To when there is one (messages from the
// help form come from Avelliq's own address with the person in Reply-To),
// otherwise the sender.
export const replyTarget = (email: ReceivedEmailSummary) =>
  addressOf(email.reply_to?.find(Boolean) ?? email.from);

export const replySubject = (subject: string | null) => {
  const original = subject?.trim() || "Sua mensagem";
  return /^re:/i.test(original) ? original : `Re: ${original}`;
};

// Sent by the "Falar com a equipe" form, not by e-mail directly.
export const isHelpFormMessage = (email: ReceivedEmailSummary) =>
  !!email.subject?.startsWith("[Avelliq ·");

// An HTML-only e-mail as plain text, for quoting: line breaks where blocks
// end, tags dropped, the common entities decoded.
export const htmlToText = (html: string) =>
  html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// The help form's e-mail starts with internal details (account id, plan,
// clinic, page) and a blank line; only the person's message goes back.
const personMessage = (text: string) =>
  text
    .split(/\n\s*\n/)
    .slice(1)
    .join("\n\n")
    .trim();

// The original below the answer, as e-mail clients quote it. For the help
// form it is the person's own message, credited to them, not Avelliq's
// sender with the internal details.
export const quotedOriginal = (email: ReceivedEmail, receivedAt: string) => {
  const fromForm = isHelpFormMessage(email);
  const text = email.text?.trim() || htmlToText(email.html ?? "");
  const body = fromForm ? personMessage(text) : text;
  if (!body) {
    return "";
  }
  const quoted = body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  const author = fromForm ? replyTarget(email) : email.from;
  return `\n\nEm ${receivedAt}, ${author} escreveu:\n${quoted}`;
};

// The thread headers of an answer: In-Reply-To is the original; References
// keeps the original's own chain too, so clients that thread by it don't
// split a long conversation.
export const threadHeaders = (email: ReceivedEmail) => {
  if (!email.message_id) {
    return undefined;
  }
  const earlier = (email.headers?.references ?? "")
    .split(/\s+/)
    .filter((id) => id && id !== email.message_id)
    .slice(-20);
  return {
    "In-Reply-To": email.message_id,
    References: [...earlier, email.message_id].join(" "),
  };
};

// Avelliq's own addresses: an answer sent there would land back in the inbox
// or in a mailbox nobody reads.
export const isOwnAddress = (
  address: string,
  own = [
    process.env.SUPPORT_EMAIL,
    process.env.SUPPORT_INBOX,
    process.env.EMAIL_FROM,
  ],
) =>
  own.some(
    (value) =>
      !!value?.trim() &&
      addressOf(value).toLowerCase() === addressOf(address).toLowerCase(),
  );

// A received HTML e-mail, made safe to show in the sandboxed frame: links
// lose their address (the frame could otherwise be navigated to the
// sender's site, which would learn the e-mail was opened, or show a fake
// page inside Avelliq) and refresh redirects are removed.
export const safeEmailHtml = (html: string) =>
  html
    .replace(/<meta[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, "")
    .replace(
      /([\s"'/])(?:xlink:)?(href|action|formaction)\s*=/gi,
      "$1data-removed-$2=",
    );

// Links to the pages around this one. Going back uses `before` with the
// page's first id, so "Mais recentes" returns to the previous page instead of
// the first one.
export const inboxPageLinks = (
  page: { data: { id: string }[]; has_more: boolean },
  { after, before }: { after?: string; before?: string },
) => {
  const first = page.data[0]?.id;
  const last = page.data.at(-1)?.id;
  const newerExists = Boolean(after) || (Boolean(before) && page.has_more);
  const olderExists = Boolean(before) || (!before && page.has_more);
  return {
    newer: newerExists
      ? first
        ? `/atendimento?antes=${first}`
        : "/atendimento"
      : null,
    older: olderExists && last ? `/atendimento?depois=${last}` : null,
  };
};
