import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleted: vi.fn(),
  emailIds: vi.fn(),
  tombstones: vi.fn(),
}));

vi.mock("@/db", () => {
  const db: Record<string, unknown> = {
    delete: (table: unknown) => ({
      where: () => ({ returning: () => mocks.deleted(table) }),
    }),
    // The received e-mail ids of the tickets about to go.
    select: () => ({
      from: () => ({
        innerJoin: () => ({ where: async () => mocks.emailIds() }),
      }),
    }),
    insert: () => ({
      values: (rows: unknown) => ({
        onConflictDoNothing: async () => mocks.tombstones(rows),
      }),
    }),
    execute: vi.fn(),
  };
  db.transaction = async (fn: (tx: unknown) => unknown) => fn(db);
  return { db };
});

import {
  auditLogsTable,
  sessionsTable,
  supportTicketsTable,
} from "@/db/schema";
import { emailIdHash } from "@/lib/support/tickets-helpers";

import { GET } from "./route";

const request = (authorization?: string) =>
  new Request("https://avelliq.vercel.app/api/cron/data-retention", {
    headers: authorization ? { authorization } : {},
  });

describe("data-retention cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "s3cret");
    mocks.emailIds.mockResolvedValue([]);
    mocks.deleted.mockImplementation(async (table) =>
      table === sessionsTable
        ? [{ id: "a" }, { id: "b" }]
        : table === auditLogsTable
          ? []
          : table === supportTicketsTable
            ? [{ id: "t" }]
            : [{ id: "c" }],
    );
  });
  afterEach(() => vi.unstubAllEnvs());

  it("deletes expired sessions, verifications, old audit logs and tickets", async () => {
    const response = await GET(request("Bearer s3cret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deletedSessions: 2,
      deletedVerifications: 1,
      deletedAuditLogs: 0,
      deletedSupportTickets: 1,
    });
  });

  it("remembers the hashed e-mail ids of the expired tickets before deleting", async () => {
    mocks.emailIds.mockResolvedValue([{ id: "email_1" }, { id: "email_1" }]);

    await GET(request("Bearer s3cret"));

    expect(mocks.tombstones).toHaveBeenCalledWith([
      { resendEmailIdHash: emailIdHash("email_1") },
    ]);
  });

  it("refuses a request without the cron secret", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
    expect(mocks.deleted).not.toHaveBeenCalled();
  });

  it("refuses everything when the secret is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    expect((await GET(request("Bearer "))).status).toBe(401);
    expect(mocks.deleted).not.toHaveBeenCalled();
  });
});
