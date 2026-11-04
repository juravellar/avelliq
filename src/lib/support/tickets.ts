import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import type { Transaction } from "@/db/clinic-lock";
import { supportMessagesTable, supportTicketsTable } from "@/db/schema";
import { isEmailConfigured, sendEmail, ticketReceivedEmail } from "@/lib/email";

import { searchPattern } from "./accounts";
import { getReceivedEmail, InboxError, listReceivedEmails } from "./inbox";
import {
  addressOf,
  htmlToText,
  isHelpFormMessage,
  isOwnAddress,
  isSupportAddress,
  nameOf,
  type ReceivedEmail,
  type ReceivedEmailSummary,
  replyTarget,
} from "./inbox-helpers";
import {
  cleanSubject,
  isFinalStatus,
  parseProtocol,
  protocolOf,
  protocolSearch,
  referencedMessageIds,
  shouldAcknowledge,
  type SupportStatus,
  ticketSubject,
  ticketThreadHeaders,
} from "./tickets-helpers";

export const TICKETS_PAGE_SIZE = 30;

// Tickets are kept for 2 years after their last message, as the privacy
// policy states.
export const TICKET_RETENTION_YEARS = 2;

// Sent with the team's notice of a help-form ticket, which is already in
// the database: the import links that e-mail to it instead of opening
// another ticket.
export const TICKET_HEADER = "X-Avelliq-Protocol";

// Opening the Atendimento elsewhere (locally with the real keys in
// .env.local, or a preview deployment) imports the same inbox into another
// database: its protocols would reach real customers with wrong numbers.
const sendsAcknowledgements = () => process.env.VERCEL_ENV === "production";

// A huge e-mail (a newsletter sent to the domain) would weigh on the search.
const MAX_BODY_LENGTH = 50_000;

type Ticket = typeof supportTicketsTable.$inferSelect;
type Executor = typeof db | Transaction;

const normalized = (address: string) => addressOf(address).toLowerCase();

// Whether the whole team sees the ticket, or only the main accounts: mail to
// the domain's other addresses (admin@, financeiro@, ...) isn't support's.
export const isSupportTicket = (ticket: Pick<Ticket, "source" | "inbox">) =>
  ticket.source === "form" || isSupportAddress(ticket.inbox);

const supportVisibility = () => {
  const addresses = [process.env.SUPPORT_EMAIL, process.env.SUPPORT_INBOX]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalized);
  return or(
    eq(supportTicketsTable.source, "form"),
    addresses.length
      ? inArray(supportTicketsTable.inbox, addresses)
      : sql`false`,
  );
};

const openTicket = async (
  tx: Executor,
  ticket: Omit<
    typeof supportTicketsTable.$inferInsert,
    "id" | "number" | "lastMessageAt"
  >,
  firstMessage: Omit<
    typeof supportMessagesTable.$inferInsert,
    "id" | "ticketId" | "author"
  > & { createdAt: Date },
) => {
  const [created] = await tx
    .insert(supportTicketsTable)
    .values({ ...ticket, lastMessageAt: firstMessage.createdAt })
    .returning();
  await tx.insert(supportMessagesTable).values({
    ...firstMessage,
    ticketId: created.id,
    author: "customer",
  });
  return created;
};

// A message from the "Falar com a equipe" form: a ticket straight away, so
// the person gets the protocol on screen.
export const createFormTicket = async ({
  name,
  email,
  subject,
  message,
  context,
}: {
  name: string;
  email: string;
  subject: string;
  message: string;
  context: string;
}) => {
  const ticket = await db.transaction((tx) =>
    openTicket(
      tx,
      {
        subject,
        customerEmail: normalized(email),
        customerName: name,
        inbox: normalized(
          process.env.SUPPORT_INBOX || process.env.SUPPORT_EMAIL || "",
        ),
        source: "form",
        context,
      },
      { body: message, createdAt: new Date() },
    ),
  );
  return { ...ticket, protocol: protocolOf(ticket.number) };
};

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
// ticket the form already opened.
// The subject's protocol covers a header lost on the way: a notice taken for
// a new e-mail would open a second ticket and send a second protocol.
const linkFormNotice = async (email: ReceivedEmail) => {
  if (!isHelpFormMessage(email)) {
    return false;
  }
  const number =
    parseProtocol(email.headers?.[TICKET_HEADER.toLowerCase()] ?? null) ??
    parseProtocol(email.subject);
  if (number === null) {
    return false;
  }
  const ticket = await db.query.supportTicketsTable.findFirst({
    where: eq(supportTicketsTable.number, number),
  });
  if (ticket?.source !== "form") {
    return false;
  }
  const linked = await db
    .update(supportMessagesTable)
    // Only the Resend id: the notice's Message-ID is an e-mail the customer
    // never got, and answers must not claim to reply to it.
    .set({ resendEmailId: email.id })
    .where(
      and(
        eq(supportMessagesTable.ticketId, ticket.id),
        eq(supportMessagesTable.author, "customer"),
        isNull(supportMessagesTable.resendEmailId),
      ),
    )
    .returning({ id: supportMessagesTable.id });
  return linked.length > 0;
};

// The support address an e-mail was sent to, or the first recipient.
const inboxOf = (email: ReceivedEmail) =>
  normalized(email.to.find((to) => isSupportAddress(to)) ?? email.to[0] ?? "");

/**
 * Stores a received e-mail: as a new message of the ticket it answers, or as
 * a new ticket. A reply to a finalized ticket opens a new one that points
 * back to it. Returns null when the e-mail was already stored.
 */
export const importReceivedEmail = async (
  email: ReceivedEmail,
  now = new Date(),
) => {
  const known = await db.query.supportMessagesTable.findFirst({
    where: eq(supportMessagesTable.resendEmailId, email.id),
    columns: { id: true },
  });
  if (known || (await linkFormNotice(email))) {
    return null;
  }

  const sender = normalized(replyTarget(email));
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
  const match = await findTicketFor(email, sender);
  // A forged From fails DMARC. Mail received before Resend checked it has no
  // result and is taken as it is.
  const forged =
    !!email.authentication && email.authentication.dmarc !== "pass";
  const previous = forged ? null : match;

  let result: { ticket: Ticket; opened: boolean };
  try {
    result = await db.transaction(async (tx) => {
      if (previous && !isFinalStatus(previous.status)) {
        await tx.insert(supportMessagesTable).values({
          ...message,
          ticketId: previous.id,
          author: "customer",
        });
        const [ticket] = await tx
          .update(supportTicketsTable)
          .set({ awaitingTeam: true, lastMessageAt: receivedAt })
          .where(eq(supportTicketsTable.id, previous.id))
          .returning();
        return { ticket, opened: false };
      }
      const ticket = await openTicket(
        tx,
        {
          subject: cleanSubject(email.subject),
          customerEmail: sender,
          customerName: isHelpFormMessage(email) ? null : nameOf(email.from),
          inbox: inboxOf(email),
          source: "email",
          previousTicketId: previous?.id ?? null,
        },
        message,
      );
      if (previous) {
        await tx.insert(supportMessagesTable).values({
          ticketId: ticket.id,
          author: "system",
          body: `Resposta ao protocolo ${protocolOf(previous.number)}, que já estava finalizado. Este novo atendimento continua a conversa.`,
          createdAt: receivedAt,
        });
      } else if (forged && match) {
        await tx.insert(supportMessagesTable).values({
          ticketId: ticket.id,
          author: "system",
          body: `Este e-mail diz responder ao protocolo ${protocolOf(match.number)}, mas o remetente não passou na verificação de autenticidade (DMARC). Por isso não foi juntado àquele atendimento: confirme com o cliente antes de agir.`,
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
    !isOwnAddress(sender) &&
    shouldAcknowledge(email, sender, now)
  ) {
    await acknowledge(
      result.ticket,
      email.message_id ? [email.message_id] : [],
    );
  }
  return result;
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
      ...ticketReceivedEmail(protocol),
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
    const storedIds = new Set(stored.map(({ id }) => id));
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

export type TicketFilter = SupportStatus | "awaiting";

export const listTickets = async ({
  search,
  filter,
  page,
  seesAll,
}: {
  search?: string;
  filter?: TicketFilter;
  page: number;
  seesAll: boolean;
}) => {
  const term = search?.trim();
  const number = term ? protocolSearch(term) : null;
  const pattern = term ? searchPattern(term) : null;
  const where = and(
    seesAll ? undefined : supportVisibility(),
    filter === "awaiting"
      ? and(
          eq(supportTicketsTable.awaitingTeam, true),
          inArray(supportTicketsTable.status, ["received", "in_review"]),
        )
      : filter
        ? eq(supportTicketsTable.status, filter)
        : undefined,
    pattern
      ? or(
          number !== null ? eq(supportTicketsTable.number, number) : undefined,
          ilike(supportTicketsTable.subject, pattern),
          ilike(supportTicketsTable.customerEmail, pattern),
          ilike(supportTicketsTable.customerName, pattern),
          exists(
            db
              .select({ one: sql`1` })
              .from(supportMessagesTable)
              .where(
                and(
                  eq(supportMessagesTable.ticketId, supportTicketsTable.id),
                  ilike(supportMessagesTable.body, pattern),
                ),
              ),
          ),
        )
      : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(supportTicketsTable)
      .where(where)
      .orderBy(desc(supportTicketsTable.lastMessageAt), supportTicketsTable.id)
      .limit(TICKETS_PAGE_SIZE)
      .offset((page - 1) * TICKETS_PAGE_SIZE),
    db.select({ total: count() }).from(supportTicketsTable).where(where),
  ]);
  return { rows, total };
};

export const getTicket = (id: string) =>
  db.query.supportTicketsTable.findFirst({
    where: eq(supportTicketsTable.id, id),
    with: {
      messages: {
        orderBy: [
          asc(supportMessagesTable.createdAt),
          asc(supportMessagesTable.id),
        ],
        with: { user: { columns: { name: true } } },
      },
      previousTicket: { columns: { id: true, number: true } },
    },
  });

// The ticket an old link (/atendimento/<received e-mail id>) pointed to.
export const ticketIdOfEmail = async (resendEmailId: string) => {
  const message = await db.query.supportMessagesTable.findFirst({
    where: eq(supportMessagesTable.resendEmailId, resendEmailId),
    columns: { ticketId: true },
  });
  return message?.ticketId ?? null;
};

export const deleteTicketsOf = (tx: Executor, email: string) =>
  tx
    .delete(supportTicketsTable)
    .where(eq(supportTicketsTable.customerEmail, normalized(email)));

export const deleteExpiredTickets = (cutoff: Date) =>
  db
    .delete(supportTicketsTable)
    .where(lt(supportTicketsTable.lastMessageAt, cutoff))
    .returning({ id: supportTicketsTable.id });

// The customer's tickets, for the data export: their messages and the
// team's answers, without who on the team wrote them.
export const ticketsOf = async (email: string) => {
  const tickets = await db.query.supportTicketsTable.findMany({
    where: eq(supportTicketsTable.customerEmail, normalized(email)),
    orderBy: asc(supportTicketsTable.createdAt),
    with: {
      messages: {
        orderBy: asc(supportMessagesTable.createdAt),
        columns: {
          author: true,
          body: true,
          statusChange: true,
          createdAt: true,
        },
      },
    },
  });
  return tickets.map((ticket) => ({
    protocol: protocolOf(ticket.number),
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt,
    messages: ticket.messages,
  }));
};
