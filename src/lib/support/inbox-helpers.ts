// Rules for answering received mail, kept apart from the API calls so they
// can be tested.

export interface ReceivedEmailSummary {
  id: string;
  from: string;
  to: string[];
  subject: string | null;
  created_at: string;
  reply_to?: string[] | null;
  // SPF, DKIM and DMARC as checked by Resend on arrival (only on the full
  // e-mail; null for mail received before Resend added it).
  authentication?: { dmarc?: string; spf?: string; dkim?: string } | null;
}

export interface ReceivedEmail extends ReceivedEmailSummary {
  html: string | null;
  text: string | null;
  message_id: string | null;
  // Lower-case header names, as Resend returns them.
  headers?: Record<string, string> | null;
  attachments?: { filename?: string | null }[] | null;
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

// The Reply-To when there is one (messages from the help form come from
// Avelliq's own address with the person in Reply-To), otherwise the sender.
export const replyTarget = (email: ReceivedEmailSummary) =>
  addressOf(email.reply_to?.find(Boolean) ?? email.from);

const sameAddress = (a: string, b: string) =>
  addressOf(a).toLowerCase() === addressOf(b).toLowerCase();

// Sent by the "Falar com a equipe" form, not by e-mail directly. The subject
// alone can be typed by anyone, so the sender must be Avelliq's own address
// and Resend must have checked it as genuine: no result is not good enough.
export const isHelpFormMessage = (
  email: ReceivedEmailSummary,
  formSender = process.env.EMAIL_FROM,
) =>
  !!formSender &&
  !!email.subject?.startsWith("[Avelliq ·") &&
  sameAddress(email.from, formSender) &&
  // A forged From fails DMARC; Avelliq's own mail passes it.
  email.authentication?.dmarc === "pass";

// The customer an e-mail's ticket belongs to, and where the protocol and the
// team's answers go. The help form's notice names the person in Reply-To; any
// other e-mail is the From, which DMARC checks: anyone can put someone else
// in Reply-To.
export const customerAddress = (email: ReceivedEmailSummary) =>
  addressOf(isHelpFormMessage(email) ? replyTarget(email) : email.from);

const supportAddresses = () => [
  process.env.SUPPORT_EMAIL,
  process.env.SUPPORT_INBOX,
];

// The domain receives mail for any address (admin@, financeiro@, ...). Only
// what was sent to the support addresses belongs to the support team.
export const isSupportAddress = (
  address: string,
  support: (string | undefined)[] = supportAddresses(),
) => support.some((value) => !!value?.trim() && sameAddress(address, value));

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
