import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import { supportMessagesTable, supportTicketsTable } from "@/db/schema";

import { searchPattern } from "./accounts";
import { supportVisibility } from "./tickets";
import { protocolSearch, type SupportStatus } from "./tickets-helpers";

export const TICKETS_PAGE_SIZE = 30;

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

// Open tickets with a customer message nobody on the team who answers has
// opened yet (isNewForTeam): the header alert.
export const countNewForTeam = async ({ seesAll }: { seesAll: boolean }) => {
  const [{ total }] = await db
    .select({ total: count() })
    .from(supportTicketsTable)
    .where(
      and(
        seesAll ? undefined : supportVisibility(),
        eq(supportTicketsTable.awaitingTeam, true),
        inArray(supportTicketsTable.status, ["received", "in_review"]),
        or(
          isNull(supportTicketsTable.teamSeenAt),
          gt(supportTicketsTable.lastMessageAt, supportTicketsTable.teamSeenAt),
        ),
      ),
    );
  return total;
};

export const markSeenByTeam = (id: string) =>
  db
    .update(supportTicketsTable)
    .set({ teamSeenAt: new Date() })
    .where(eq(supportTicketsTable.id, id));
