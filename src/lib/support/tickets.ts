import { eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import type { Transaction } from "@/db/clinic-lock";
import { supportMessagesTable, supportTicketsTable } from "@/db/schema";

import { addressOf, isSupportAddress } from "./inbox-helpers";
import { protocolOf } from "./tickets-helpers";

export type Ticket = typeof supportTicketsTable.$inferSelect;
export type Executor = typeof db | Transaction;

export const normalized = (address: string) => addressOf(address).toLowerCase();

// Whether the whole team sees the ticket, or only the main accounts: mail to
// the domain's other addresses (admin@, financeiro@, ...) isn't support's.
export const isSupportTicket = (ticket: Pick<Ticket, "source" | "inbox">) =>
  ticket.source === "form" || isSupportAddress(ticket.inbox);

export const supportVisibility = () => {
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

export const openTicket = async (
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
