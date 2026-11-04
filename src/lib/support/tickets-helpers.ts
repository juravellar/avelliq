// Rules for support tickets, kept apart from the database so they can be
// tested.

import { createHash } from "node:crypto";

import type { ReceivedEmail } from "./inbox-helpers";

export const SUPPORT_STATUSES = [
  "received",
  "in_review",
  "concluded",
  "archived",
] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const STATUS_NAMES: Record<SupportStatus, string> = {
  received: "Recebido",
  in_review: "Em análise",
  concluded: "Concluído",
  archived: "Arquivado",
};

// Concluded and archived tickets take no more messages. To disagree, the
// customer opens another ticket quoting the old protocol.
export const FINAL_STATUSES: SupportStatus[] = ["concluded", "archived"];
export const isFinalStatus = (status: SupportStatus) =>
  FINAL_STATUSES.includes(status);

// What is kept of a deleted ticket's received e-mail ids: enough to skip the
// e-mail on the next import, not to find it. Both recording and checking use
// this function (sha256 of the UTF-8 id, in hex).
export const emailIdHash = (resendEmailId: string) =>
  createHash("sha256").update(resendEmailId, "utf8").digest("hex");

export const protocolOf = (number: number) =>
  `AV-${String(number).padStart(6, "0")}`;

// "AV-000123", "av 123" or "AV123" anywhere in the text.
export const parseProtocol = (text: string | null | undefined) => {
  const match = text?.match(/\bAV[-\s]?0*(\d{1,9})\b/i);
  return match ? Number(match[1]) : null;
};

// What the team types in the search box: a protocol or just its number.
export const protocolSearch = (term: string) =>
  parseProtocol(term) ??
  (/^\s*#?\d{1,9}\s*$/.test(term) ? Number(term.replace(/\D/g, "")) : null);

const PROTOCOL_TAG = /\s*\[Avelliq · Protocolo AV-\d+\]\s*/gi;
const REPLY_PREFIX = /^\s*((re|res|fw|fwd|enc|encaminhada)\s*:\s*)+/i;

// The subject without "Re:"/"Fwd:" and without the protocol tag.
export const cleanSubject = (subject: string | null | undefined) =>
  (subject ?? "").replace(PROTOCOL_TAG, " ").replace(REPLY_PREFIX, "").trim() ||
  "Sua mensagem";

// Every e-mail about a ticket carries its protocol in the subject, so a reply
// finds its ticket even when the e-mail client drops the thread headers.
export const ticketSubject = (
  protocol: string,
  subject: string,
  { reply = false } = {},
) =>
  `${reply ? "Re: " : ""}[Avelliq · Protocolo ${protocol}] ${cleanSubject(subject)}`;

// The Message-IDs an e-mail answers (In-Reply-To and References).
export const referencedMessageIds = (email: ReceivedEmail) => {
  const headers = email.headers ?? {};
  const ids = `${headers["in-reply-to"] ?? ""} ${headers.references ?? ""}`
    .split(/\s+/)
    .filter((id) => /^<[^<>\s]+>$/.test(id));
  return [...new Set(ids)];
};

// Thread headers for an answer: In-Reply-To is the customer's latest e-mail,
// References the earlier ones too, oldest first.
export const ticketThreadHeaders = (messageIds: string[]) => {
  const ids = messageIds.filter(Boolean).slice(-20);
  return ids.length
    ? { "In-Reply-To": ids.at(-1)!, References: ids.join(" ") }
    : undefined;
};

const AUTOMATED_SENDER =
  /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|nao-?responda|bounces?)([+.-]|@)/i;

// Out-of-office replies, bounces and mailing lists. Answering them with a
// protocol could start a loop of automatic e-mails.
export const isAutomatedEmail = (email: ReceivedEmail, sender: string) => {
  const headers = email.headers ?? {};
  const autoSubmitted = headers["auto-submitted"]?.trim().toLowerCase();
  return (
    (!!autoSubmitted && autoSubmitted !== "no") ||
    /^(bulk|junk|list|auto_reply)$/i.test(headers.precedence?.trim() ?? "") ||
    "x-autoreply" in headers ||
    "x-autorespond" in headers ||
    "list-id" in headers ||
    AUTOMATED_SENDER.test(sender)
  );
};

const ACKNOWLEDGE_WITHIN_MS = 24 * 60 * 60 * 1000;

// Whether a new ticket's protocol goes back to whoever wrote. Only genuine
// senders (a forged From fails DMARC, and answering it would send our mail to
// a stranger) and only recent mail: the first import of an old inbox
// mustn't e-mail everyone who ever wrote.
export const shouldAcknowledge = (
  email: ReceivedEmail,
  sender: string,
  now = new Date(),
) =>
  email.authentication?.dmarc === "pass" &&
  now.getTime() - new Date(email.created_at).getTime() <=
    ACKNOWLEDGE_WITHIN_MS &&
  !isAutomatedEmail(email, sender);

const QUOTE_HEADER =
  /^\s*(Em .+escreveu:|On .+wrote:|-{2,}\s*(Mensagem original|Original Message)\s*-{2,}|De: .+|From: .+)\s*$/i;

// A reply as the customer typed it, apart from the earlier e-mails their
// client quoted below it.
export const splitQuotedReply = (text: string) => {
  const lines = text.split("\n");
  const start = lines.findIndex(
    (line) => QUOTE_HEADER.test(line) || line.startsWith(">"),
  );
  if (start <= 0) {
    return { reply: text.trim(), quoted: null };
  }
  const reply = lines.slice(0, start).join("\n").trim();
  const quoted = lines.slice(start).join("\n").trim();
  return reply
    ? { reply, quoted: quoted || null }
    : { reply: text.trim(), quoted: null };
};

// The customer's message below the answer, as e-mail clients quote it.
export const quoteMessage = (author: string, sentAt: string, body: string) => {
  const reply = splitQuotedReply(body).reply;
  if (!reply) {
    return "";
  }
  const quoted = reply
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `\n\nEm ${sentAt}, ${author} escreveu:\n${quoted}`;
};

// Why the team's update can't go out, or null when it can.
export const updateProblem = ({
  current,
  next,
  message,
  canEmail,
}: {
  current: SupportStatus;
  next: SupportStatus;
  message: string;
  // False when the customer is one of Avelliq's own addresses.
  canEmail: boolean;
}) => {
  if (isFinalStatus(current)) {
    return `Este atendimento já foi ${STATUS_NAMES[current].toLowerCase()} e não pode mais ser alterado. Se o cliente não concordar, ele abre um novo atendimento informando o protocolo.`;
  }
  if (message && !canEmail) {
    return "Este atendimento veio de um endereço do próprio Avelliq: não há para quem enviar a mensagem. Mude só o status.";
  }
  if (isFinalStatus(next) && !message && canEmail) {
    return "Escreva uma mensagem para o cliente ao concluir ou arquivar o atendimento.";
  }
  if (!message && next === current) {
    return "Escreva uma mensagem ou escolha outro status.";
  }
  return null;
};

// A customer message nobody on the team who answers has opened yet: what
// the header alert counts.
export const isNewForTeam = (ticket: {
  awaitingTeam: boolean;
  status: SupportStatus;
  lastMessageAt: Date;
  teamSeenAt: Date | null;
}) =>
  ticket.awaitingTeam &&
  !isFinalStatus(ticket.status) &&
  (!ticket.teamSeenAt || ticket.lastMessageAt > ticket.teamSeenAt);
