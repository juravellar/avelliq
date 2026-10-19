import { count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { usersTable } from "@/db/schema";

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
  supportAdmin: boolean;
  createdAt: Date;
  clinicCount: number;
  // "credential" (e-mail and password), "google", ...
  providers: string[];
}

// Every Avelliq account, newest first, for the owners' Contas page.
export const listAccounts = async ({
  search,
  page,
}: {
  search?: string;
  page: number;
}) => {
  const where = search?.trim()
    ? or(
        ilike(usersTable.name, searchPattern(search)),
        ilike(usersTable.email, searchPattern(search)),
      )
    : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        emailVerified: usersTable.emailVerified,
        plan: usersTable.plan,
        supportAdmin: usersTable.supportAdmin,
        createdAt: usersTable.createdAt,
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
