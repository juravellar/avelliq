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

// The original below the answer, as e-mail clients quote it.
export const quotedOriginal = (email: ReceivedEmail, receivedAt: string) => {
  const body = (email.text ?? "").trim();
  if (!body) {
    return "";
  }
  const quoted = body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `\n\nEm ${receivedAt}, ${email.from} escreveu:\n${quoted}`;
};
