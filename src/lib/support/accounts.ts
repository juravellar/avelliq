import { and, count, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { usersTable } from "@/db/schema";

import type { ModerationReason, StaffRole } from "./admin";

export const ACCOUNTS_PAGE_SIZE = 25;

// A typed search matches anywhere in the name or e-mail; % and _ are taken
// literally instead of as wildcards.
export const searchPattern = (term: string) =>
  `%${term.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

// "1" or a junk value is the first page.
export const pageNumber = (value: string | undefined) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : 1;
};

export interface AccountRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  plan: string | null;
  staffRole: StaffRole | null;
  createdAt: Date;
  clinicCount: number;
  // "credential" (e-mail and password), "google", ...
  providers: string[];
  blockedAt: Date | null;
  blockedReason: ModerationReason | null;
  deletionRequestedAt: Date | null;
  deletionRequestReason: ModerationReason | null;
  deletionRequestedBy: string | null;
}

export type AccountFilter = "bloqueadas" | "exclusao";

// Every Avelliq account, newest first, for the Contas page.
export const listAccounts = async ({
  search,
  filter,
  page,
}: {
  search?: string;
  filter?: AccountFilter;
  page: number;
}) => {
  const where = and(
    search?.trim()
      ? or(
          ilike(usersTable.name, searchPattern(search)),
          ilike(usersTable.email, searchPattern(search)),
        )
      : undefined,
    filter === "bloqueadas"
      ? isNotNull(usersTable.blockedAt)
      : filter === "exclusao"
        ? isNotNull(usersTable.deletionRequestedAt)
        : undefined,
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        emailVerified: usersTable.emailVerified,
        plan: usersTable.plan,
        staffRole: usersTable.staffRole,
        createdAt: usersTable.createdAt,
        blockedAt: usersTable.blockedAt,
        blockedReason: usersTable.blockedReason,
        deletionRequestedAt: usersTable.deletionRequestedAt,
        deletionRequestReason: usersTable.deletionRequestReason,
        deletionRequestedBy: usersTable.deletionRequestedBy,
        // Written out with table names: inside a subquery Drizzle leaves
        // columns unqualified, and "id" would be the subquery's own.
        clinicCount: sql<number>`(select count(*)::int from users_to_clinics m where m.user_id = users.id)`,
        providers: sql<
          string[]
        >`coalesce((select array_agg(distinct a.provider_id) from accounts a where a.user_id = users.id), '{}')`,
      })
      .from(usersTable)
      .where(where)
      .orderBy(desc(usersTable.createdAt), usersTable.id)
      .limit(ACCOUNTS_PAGE_SIZE)
      .offset((page - 1) * ACCOUNTS_PAGE_SIZE),
    db.select({ total: count() }).from(usersTable).where(where),
  ]);
  return { rows: rows as AccountRow[], total };
};

export const findAccount = (id: string) =>
  db.query.usersTable.findFirst({ where: eq(usersTable.id, id) });

// Requests waiting for an owner, for the Contas page's notice.
export const countDeletionRequests = async () => {
  const [{ total }] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(isNotNull(usersTable.deletionRequestedAt));
  return total;
};
