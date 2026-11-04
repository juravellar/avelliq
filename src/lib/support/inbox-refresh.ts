import { sql } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/db";
import { supportInboxSyncTable } from "@/db/schema";

import { isInboxConfigured } from "./inbox";
import { syncInbox } from "./tickets";

const REFRESH_EVERY_MS = 2 * 60 * 1000;
const LEASE_KEY = "inbox";
let lastCheck = 0;

// One instance wins the right to sync per interval, across all instances:
// the row is created or, if it is older than the interval, moved to now, and
// only the call that changed it gets a row back.
export const takeInboxLease = async () => {
  const rows = await db
    .insert(supportInboxSyncTable)
    .values({ key: LEASE_KEY, lastSyncedAt: sql`now()` })
    .onConflictDoUpdate({
      target: supportInboxSyncTable.key,
      set: { lastSyncedAt: sql`now()` },
      setWhere: sql`${supportInboxSyncTable.lastSyncedAt} < now() - make_interval(secs => ${REFRESH_EVERY_MS / 1000})`,
    })
    .returning({ key: supportInboxSyncTable.key });
  return rows.length > 0;
};

// Brings in new e-mails after the response, at most every 2 minutes across
// the whole fleet, so the team's alert counts them without anyone opening
// the Atendimento and without slowing the page down. The in-memory check only
// spares the database a lease attempt on every call.
export const refreshInboxSoon = () => {
  if (!isInboxConfigured() || Date.now() - lastCheck < REFRESH_EVERY_MS) {
    return;
  }
  lastCheck = Date.now();
  after(async () => {
    try {
      if (await takeInboxLease()) {
        await syncInbox();
      }
    } catch (error) {
      console.error("Support inbox not refreshed:", (error as Error).message);
    }
  });
};
