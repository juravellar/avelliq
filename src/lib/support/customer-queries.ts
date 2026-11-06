import { and, count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { supportMessagesTable, supportTicketsTable } from "@/db/schema";

import { getTicket } from "./team-queries";
import { normalized } from "./tickets";
import { isFinalStatus, protocolOf } from "./tickets-helpers";

// Team messages the customer hasn't seen in the help panel yet. Written out
// with table names: inside a subquery Drizzle leaves columns unqualified,
// and "id" would be the message's own.
const unseenByCustomer = sql<boolean>`exists (
  select 1 from support_messages m
  where m.ticket_id = support_tickets.id
    and m.author = 'team' and m.body is not null
    and (support_tickets.customer_seen_at is null
      or m.created_at > support_tickets.customer_seen_at)
)`;

// The customer's own tickets, for "Meus atendimentos" in the help panel:
// newest activity first, with whether the team answered since their last
// look.
export const customerTickets = (email: string) =>
  db
    .select({
      id: supportTicketsTable.id,
      number: supportTicketsTable.number,
      subject: supportTicketsTable.subject,
      status: supportTicketsTable.status,
      lastMessageAt: supportTicketsTable.lastMessageAt,
      unread: unseenByCustomer,
    })
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.customerEmail, normalized(email)))
    .orderBy(desc(supportTicketsTable.lastMessageAt))
    .limit(50);

export const countUnreadTickets = async (email: string) => {
  const [{ total }] = await db
    .select({ total: count() })
    .from(supportTicketsTable)
    .where(
      and(
        eq(supportTicketsTable.customerEmail, normalized(email)),
        unseenByCustomer,
      ),
    );
  return total;
};

/**
 * One of the customer's tickets as they see it: their messages, the team's
 * answers (signed "Equipe Avelliq", without who wrote them) and the status
 * changes. The account context and system notes stay with the team. Null
 * when the ticket isn't theirs.
 */
export const customerTicket = async (id: string, email: string) => {
  const ticket = await getTicket(id);
  if (!ticket || ticket.customerEmail !== normalized(email)) {
    return null;
  }
  return {
    id: ticket.id,
    protocol: protocolOf(ticket.number),
    subject: ticket.subject,
    status: ticket.status,
    messages: ticket.messages
      .filter(
        ({ author, body, statusChange }) =>
          author !== "system" && (body || statusChange),
      )
      .map(({ id: messageId, author, body, statusChange, createdAt }) => ({
        id: messageId,
        fromTeam: author === "team",
        body,
        statusChange,
        createdAt,
      })),
  };
};

export const markSeenByCustomer = (id: string) =>
  db
    .update(supportTicketsTable)
    .set({ customerSeenAt: new Date() })
    .where(eq(supportTicketsTable.id, id));

// A message the customer wrote in the help panel, in the same history as
// their e-mails. Refused when the ticket is over: disagreeing opens a new
// one.
export const addCustomerMessage = async (
  id: string,
  email: string,
  body: string,
) => {
  const ticket = await db.query.supportTicketsTable.findFirst({
    where: eq(supportTicketsTable.id, id),
  });
  if (!ticket || ticket.customerEmail !== normalized(email)) {
    return { error: "not-found" as const };
  }
  if (isFinalStatus(ticket.status)) {
    return { error: "final" as const, protocol: protocolOf(ticket.number) };
  }
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(supportMessagesTable).values({
      ticketId: ticket.id,
      author: "customer",
      body,
      createdAt: now,
    });
    await tx
      .update(supportTicketsTable)
      .set({ awaitingTeam: true, lastMessageAt: now, customerSeenAt: now })
      .where(eq(supportTicketsTable.id, ticket.id));
  });
  return { error: null };
};
