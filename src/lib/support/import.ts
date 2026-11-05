import { createHmac, timingSafeEqual } from "node:crypto";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  supportDeletedEmailsTable,
  supportMessagesTable,
  supportTicketsTable,
  usersTable,
} from "@/db/schema";
import {
  isEmailConfigured,
  sendEmail,
  ticketReceivedEmail,
  ticketUrlFor,
} from "@/lib/email";

import { emailIdHash } from "./email-id-hash";
import { getReceivedEmail, InboxError, listReceivedEmails } from "./inbox";
import {
  customerAddress,
  htmlToText,
  isHelpFormMessage,
  isOwnAddress,
  isSupportAddress,
  nameOf,
  type ReceivedEmail,
  type ReceivedEmailSummary,
} from "./inbox-helpers";
import {
  isSupportTicket,
  normalized,
  openTicket,
  type Ticket,
} from "./tickets";
import {
  cleanSubject,
  isAutomatedEmail,
  isFinalStatus,
  parseProtocol,
  protocolOf,
  referencedMessageIds,
  shouldAcknowledge,
  ticketSubject,
  ticketThreadHeaders,
} from "./tickets-helpers";

// Sent with the team's notice of a help-form ticket, which is already in
// the database: the import links that e-mail to it instead of opening
// another ticket.
export const TICKET_HEADER = "X-Avelliq-Protocol";

// The notice is recognized by a signature only this server can make. DMARC
// can't vouch for it: Avelliq's own mail arrives with "gray" while the
// domain publishes no DMARC policy.
const noticeSignature = (protocol: string) =>
  createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "")
    .update(`support-form-notice:${protocol}`)
    .digest("base64url")
    .slice(0, 32);

export const formNoticeHeader = (protocol: string) =>
  `${protocol}; ${noticeSignature(protocol)}`;

// The protocol of a genuine notice's header, or null.
const signedNoticeProtocol = (header: string | undefined) => {
  const [protocol, signature] = (header ?? "")
    .split(";")
    .map((part) => part.trim());
  if (!protocol || !signature || !process.env.BETTER_AUTH_SECRET) {
    return null;
  }
  const expected = Buffer.from(noticeSignature(protocol));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected)
    ? protocol
    : null;
};

// Opening the Atendimento elsewhere (locally with the real keys in
// .env.local, or a preview deployment) imports the same inbox into another
// database: its protocols would reach real customers with wrong numbers.
const sendsAcknowledgements = () => process.env.VERCEL_ENV === "production";

// A huge e-mail (a newsletter sent to the domain) would weigh on the search.
const MAX_BODY_LENGTH = 50_000;

// Postgres's unique_violation: another import stored the same e-mail first.
const isDuplicate = (error: unknown) =>
  (error as { code?: string })?.code === "23505" ||
  (error as { cause?: { code?: string } })?.cause?.code === "23505";

// The ticket an e-mail continues: the protocol in its subject, else the
// e-mails it answers. Only when it comes from the ticket's own customer, so
// a stranger can't write into someone else's ticket by copying a protocol.
const findTicketFor = async (email: ReceivedEmail, sender: string) => {
  const number = parseProtocol(email.subject);
  if (number !== null) {
    const ticket = await db.query.supportTicketsTable.findFirst({
      where: eq(supportTicketsTable.number, number),
    });
    if (ticket?.customerEmail === sender) {
      return ticket;
    }
  }
  const references = referencedMessageIds(email);
  if (references.length) {
    const [match] = await db
      .select({ ticket: supportTicketsTable })
      .from(supportMessagesTable)
      .innerJoin(
        supportTicketsTable,
        eq(supportMessagesTable.ticketId, supportTicketsTable.id),
      )
      .where(
        and(
          inArray(supportMessagesTable.messageId, references),
          eq(supportTicketsTable.customerEmail, sender),
        ),
      )
      .orderBy(desc(supportMessagesTable.createdAt))
      .limit(1);
    if (match) {
      return match.ticket;
    }
  }
  return null;
};

// The help form's notice comes back into the inbox; it belongs to the
// ticket the form already opened. Without the signed header (lost on the
// way), the subject's protocol on a DMARC-approved notice still links it: a
// notice taken for a new e-mail would open a second ticket.
const linkFormNotice = async (email: ReceivedEmail) => {
  const signed = signedNoticeProtocol(
    email.headers?.[TICKET_HEADER.toLowerCase()],
  );
  if (!signed && !isHelpFormMessage(email)) {
    return false;
  }
  const number = parseProtocol(signed ?? email.subject);
  if (number === null) {
    return false;
  }
  const ticket = await db.query.supportTicketsTable.findFirst({
    where: eq(supportTicketsTable.number, number),
  });
  if (!ticket && signed) {
    // Our own signature, so the notice is genuine: its ticket is gone
    // (account deleted or retention) and the notice must not come back as a
    // new ticket.
    return true;
  }
  if (ticket?.source !== "form") {
    return false;
  }
  const linked = await db
    .update(supportMessagesTable)
    // Only the Resend id: the notice's Message-ID is an e-mail the customer
    // never got, and answers must not claim to reply to it. It goes on only
    // one message, the form's own (the earliest): replies typed later in the
    // help panel also have no e-mail id, and the column is unique.
    .set({ resendEmailId: email.id })
    .where(
      inArray(
        supportMessagesTable.id,
        db
          .select({ id: supportMessagesTable.id })
          .from(supportMessagesTable)
          .where(
            and(
              eq(supportMessagesTable.ticketId, ticket.id),
              eq(supportMessagesTable.author, "customer"),
              isNull(supportMessagesTable.resendEmailId),
            ),
          )
          .orderBy(asc(supportMessagesTable.createdAt))
          .limit(1),
      ),
    )
    .returning({ id: supportMessagesTable.id });
  return linked.length > 0;
};

// The ids among these whose tickets were deleted: the e-mail is still in
// Resend, but it must not come back as a new ticket.
const deletedEmailIds = async (ids: string[]) => {
  if (!ids.length) {
    return new Set<string>();
  }
  const hashes = new Map(ids.map((id) => [emailIdHash(id), id]));
  const deleted = await db
    .select({ hash: supportDeletedEmailsTable.resendEmailIdHash })
    .from(supportDeletedEmailsTable)
    .where(
      inArray(supportDeletedEmailsTable.resendEmailIdHash, [...hashes.keys()]),
    );
  return new Set(deleted.map(({ hash }) => hashes.get(hash)!));
};

// The support address an e-mail was sent to, or the first recipient.
const inboxOf = (email: ReceivedEmail) =>
  normalized(email.to.find((to) => isSupportAddress(to)) ?? email.to[0] ?? "");

/**
 * Stores a received e-mail: as a new message of the ticket it answers, or as
 * a new ticket. A reply to a finalized ticket opens a new one that points
 * back to it. Returns null when the e-mail was already stored, or its ticket
 * was deleted.
 */
export const importReceivedEmail = async (
  email: ReceivedEmail,
  now = new Date(),
) => {
  const known = await db.query.supportMessagesTable.findFirst({
    where: eq(supportMessagesTable.resendEmailId, email.id),
    columns: { id: true },
  });
  if (
    known ||
    (await deletedEmailIds([email.id])).size > 0 ||
    (await linkFormNotice(email))
  ) {
    return null;
  }

  const customer = normalized(customerAddress(email));
  const fullBody = email.text?.trim() || htmlToText(email.html ?? "");
  const body =
    fullBody.length > MAX_BODY_LENGTH
      ? `${fullBody.slice(0, MAX_BODY_LENGTH)}\n\n[mensagem cortada]`
      : fullBody;
  const receivedAt = new Date(email.created_at);
  const message = {
    body,
    resendEmailId: email.id,
    messageId: email.message_id,
    hadAttachments: (email.attachments?.length ?? 0) > 0,
    createdAt: receivedAt,
  };
  const match = await findTicketFor(email, customer);
  // Only a DMARC pass proves the From is who it says. A forged From fails it;
  // domains without a DMARC policy ("gray") and mail received before Resend
  // checked prove nothing. None of them may join a customer's ticket by
  // copying its protocol.
  const unverified = email.authentication?.dmarc !== "pass";
  const previous = unverified ? null : match;
  // Out-of-office replies and the like answer the team's own e-mail, not the
  // team's turn: they are kept in the conversation, but never ask for an
  // answer, reopen a finished ticket or start a new one.
  const automated = isAutomatedEmail(email, customer);

  let result: { ticket: Ticket; opened: boolean };
  try {
    result = await db.transaction(async (tx) => {
      // The status read above may be stale: the team can finalize the ticket
      // meanwhile. Locking the row makes the check final, since finalizing
      // waits for this transaction.
      const [current] = previous
        ? await tx
            .select()
            .from(supportTicketsTable)
            .where(eq(supportTicketsTable.id, previous.id))
            .for("update")
        : [];
      // Gone meanwhile (account deleted, retention): the e-mail opens a new
      // ticket instead.
      const target = previous ? current : undefined;
      if (target && (automated || !isFinalStatus(target.status))) {
        await tx.insert(supportMessagesTable).values({
          ...message,
          ticketId: target.id,
          author: "customer",
        });
        if (automated) {
          return { ticket: target, opened: false };
        }
        // teamSeenAt is cleared because lastMessageAt is when the e-mail
        // arrived: a teammate may have opened the ticket after that but
        // before this import, and the message would never count as new.
        const [ticket] = await tx
          .update(supportTicketsTable)
          .set({
            awaitingTeam: true,
            lastMessageAt: receivedAt,
            teamSeenAt: null,
          })
          .where(eq(supportTicketsTable.id, target.id))
          .returning();
        return { ticket, opened: false };
      }
      const ticket = await openTicket(
        tx,
        {
          subject: cleanSubject(email.subject),
          customerEmail: customer,
          customerName: isHelpFormMessage(email) ? null : nameOf(email.from),
          inbox: inboxOf(email),
          source: "email",
          previousTicketId: target?.id ?? null,
        },
        message,
      );
      if (target) {
        await tx.insert(supportMessagesTable).values({
          ticketId: ticket.id,
          author: "system",
          body: `Resposta ao protocolo ${protocolOf(target.number)}, que já estava finalizado. Este novo atendimento continua a conversa.`,
          createdAt: receivedAt,
        });
      } else if (unverified && match) {
        await tx.insert(supportMessagesTable).values({
          ticketId: ticket.id,
          author: "system",
          body: `Este e-mail diz responder ao protocolo ${protocolOf(match.number)}, mas não foi possível confirmar o remetente (DMARC). Por isso não foi juntado àquele atendimento: confirme com o cliente antes de agir.`,
          createdAt: receivedAt,
        });
      }
      return { ticket, opened: true };
    });
  } catch (error) {
    if (isDuplicate(error)) {
      return null;
    }
    throw error;
  }

  if (
    result.opened &&
    sendsAcknowledgements() &&
    isSupportTicket(result.ticket) &&
    isEmailConfigured() &&
    !isOwnAddress(customer) &&
    shouldAcknowledge(email, customer, now)
  ) {
    await acknowledge(
      result.ticket,
      email.message_id ? [email.message_id] : [],
    );
  }
  return result;
};

// The e-mails' "Ver conversa no Avelliq" link, only for a customer with a
// confirmed Avelliq account: "Meus atendimentos" finds tickets by that
// address, and anyone else would land on a sign-in page that can't help.
export const customerTicketUrl = async (
  ticket: Pick<Ticket, "id" | "customerEmail">,
) => {
  const account = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, ticket.customerEmail),
    columns: { emailVerified: true },
  });
  return account?.emailVerified ? ticketUrlFor(ticket.id) : undefined;
};

// E-mails the protocol of a new ticket to the customer, and notes it in the
// ticket's history. A failure is logged: the ticket is already stored.
export const acknowledge = async (ticket: Ticket, messageIds: string[]) => {
  const protocol = protocolOf(ticket.number);
  try {
    await sendEmail({
      from: process.env.SUPPORT_EMAIL
        ? `Avelliq <${process.env.SUPPORT_EMAIL}>`
        : undefined,
      to: ticket.customerEmail,
      subject: ticketSubject(protocol, ticket.subject, {
        reply: ticket.source === "email",
      }),
      ...ticketReceivedEmail(protocol, await customerTicketUrl(ticket)),
      headers: {
        // RFC 3834: tells the other side's autoresponder not to answer.
        "Auto-Submitted": "auto-replied",
        ...ticketThreadHeaders(messageIds),
      },
    });
    await db.insert(supportMessagesTable).values({
      ticketId: ticket.id,
      author: "system",
      body: `Protocolo ${protocol} enviado por e-mail para ${ticket.customerEmail}.`,
    });
  } catch (error) {
    console.error("Support ticket not acknowledged:", (error as Error).message);
  }
};

// Imports at most this many e-mails per call, so the Atendimento page stays
// quick; the rest come on the next visit. Resend allows about 2 requests per
// second, hence the pause between e-mails.
const IMPORT_PER_SYNC = 10;
const SCAN_PAGES = 10;
const PAUSE_MS = 500;

/**
 * Brings the e-mails received since the last import into the database,
 * oldest first. Returns how many are still waiting for the next call.
 */
export const syncInbox = async ({ pauseMs = PAUSE_MS } = {}) => {
  const unseen: ReceivedEmailSummary[] = [];
  let after: string | undefined;
  for (let page = 0; page < SCAN_PAGES; page++) {
    const result = await listReceivedEmails({ after });
    const ids = result.data.map(({ id }) => id);
    const stored = ids.length
      ? await db
          .select({ id: supportMessagesTable.resendEmailId })
          .from(supportMessagesTable)
          .where(inArray(supportMessagesTable.resendEmailId, ids))
      : [];
    // A deleted ticket's e-mail counts as stored too: it is not imported
    // again, and the scan can stop at it.
    const storedIds = new Set([
      ...stored.map(({ id }) => id),
      ...(await deletedEmailIds(ids)),
    ]);
    unseen.push(...result.data.filter(({ id }) => !storedIds.has(id)));
    // Newest first: once a stored e-mail shows up, the older ones are in.
    if (storedIds.size > 0 || !result.has_more) {
      break;
    }
    after = ids.at(-1);
  }

  const batch = unseen.reverse().slice(0, IMPORT_PER_SYNC);
  for (const [index, summary] of batch.entries()) {
    if (index > 0 && pauseMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
    try {
      await importReceivedEmail(await getReceivedEmail(summary.id));
    } catch (error) {
      // Over Resend's rate limit: the rest waits for the next visit.
      if (error instanceof InboxError && error.status === 429) {
        break;
      }
      // One e-mail that can't be imported must not hold back the newer ones;
      // it is tried again on the next visit.
      console.error("Support e-mail not imported:", (error as Error).message);
    }
  }
  return Math.max(0, unseen.length - batch.length);
};
