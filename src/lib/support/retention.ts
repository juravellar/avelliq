import { and, asc, eq, isNotNull, lt, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  supportDeletedEmailsTable,
  supportMessagesTable,
  supportTicketsTable,
} from "@/db/schema";

import { emailIdHash } from "./email-id-hash";
import { type Executor, normalized } from "./tickets";
import { protocolOf } from "./tickets-helpers";

// Tickets are kept for 2 years after their last message, as the privacy
// policy states.
export const TICKET_RETENTION_YEARS = 2;

// Records the received e-mails of the tickets matching the condition as
// deleted, before the tickets (and their messages) go.
const rememberDeletedEmails = async (tx: Executor, tickets: SQL) => {
  const rows = await tx
    .select({ id: supportMessagesTable.resendEmailId })
    .from(supportMessagesTable)
    .innerJoin(
      supportTicketsTable,
      eq(supportTicketsTable.id, supportMessagesTable.ticketId),
    )
    .where(and(isNotNull(supportMessagesTable.resendEmailId), tickets));
  // Hashed here, with the same function the import compares with.
  const hashes = new Set(rows.map(({ id }) => emailIdHash(id!)));
  if (!hashes.size) {
    return;
  }
  await tx
    .insert(supportDeletedEmailsTable)
    .values([...hashes].map((resendEmailIdHash) => ({ resendEmailIdHash })))
    .onConflictDoNothing();
};

export const deleteTicketsOf = async (tx: Executor, email: string) => {
  const ofCustomer = eq(supportTicketsTable.customerEmail, normalized(email));
  await rememberDeletedEmails(tx, ofCustomer);
  await tx.delete(supportTicketsTable).where(ofCustomer);
};

export const deleteExpiredTickets = (cutoff: Date) =>
  db.transaction(async (tx) => {
    const expired = lt(supportTicketsTable.lastMessageAt, cutoff);
    await rememberDeletedEmails(tx, expired);
    return tx
      .delete(supportTicketsTable)
      .where(expired)
      .returning({ id: supportTicketsTable.id });
  });

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
