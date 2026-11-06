import { createHash, timingSafeEqual } from "node:crypto";

import { lt } from "drizzle-orm";

import { db } from "@/db";
import { auditLogsTable, sessionsTable, verificationsTable } from "@/db/schema";
import {
  deleteExpiredTickets,
  TICKET_RETENTION_YEARS,
} from "@/lib/support/retention";

// Sessions keep the IP address and browser of each sign-in. Once expired they
// serve no purpose, so they are deleted instead of piling up (LGPD art. 16).
// The audit log is kept for 5 years and support tickets for 2 years after
// their last message, as stated in the privacy policy.
// Called daily by Vercel Cron, which sends CRON_SECRET as a bearer token.
const AUDIT_RETENTION_YEARS = 5;

// Compared as SHA-256 digests (always the same length) in constant time, so
// the response time doesn't reveal how much of the secret was right.
const sameSecret = (given: string, expected: string) =>
  timingSafeEqual(
    createHash("sha256").update(given).digest(),
    createHash("sha256").update(expected).digest(),
  );

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  const now = new Date();
  const auditCutoff = new Date(now);
  auditCutoff.setFullYear(auditCutoff.getFullYear() - AUDIT_RETENTION_YEARS);
  const ticketCutoff = new Date(now);
  ticketCutoff.setFullYear(ticketCutoff.getFullYear() - TICKET_RETENTION_YEARS);
  const [sessions, verifications, auditLogs, tickets] = await Promise.all([
    db
      .delete(sessionsTable)
      .where(lt(sessionsTable.expiresAt, now))
      .returning({ id: sessionsTable.id }),
    db
      .delete(verificationsTable)
      .where(lt(verificationsTable.expiresAt, now))
      .returning({ id: verificationsTable.id }),
    db
      .delete(auditLogsTable)
      .where(lt(auditLogsTable.createdAt, auditCutoff))
      .returning({ id: auditLogsTable.id }),
    deleteExpiredTickets(ticketCutoff),
  ]);
  return Response.json({
    deletedSessions: sessions.length,
    deletedVerifications: verifications.length,
    deletedAuditLogs: auditLogs.length,
    deletedSupportTickets: tickets.length,
  });
}
