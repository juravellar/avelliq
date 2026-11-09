import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  syncInbox: vi.fn(),
  configured: vi.fn(),
  returning: vi.fn(),
  onConflictDoUpdate: vi.fn(),
}));
vi.mock("next/server", () => ({
  after: (task: () => Promise<unknown>) => mocks.after(task),
}));
vi.mock("./inbox", () => ({ isInboxConfigured: mocks.configured }));
vi.mock("./import", () => ({ syncInbox: mocks.syncInbox }));
vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: () => ({ onConflictDoUpdate: mocks.onConflictDoUpdate }),
    }),
  },
}));

describe("refreshInboxSoon", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.configured.mockReturnValue(true);
    mocks.syncInbox.mockResolvedValue(0);
    mocks.returning.mockResolvedValue([{ key: "inbox" }]);
    mocks.onConflictDoUpdate.mockReturnValue({ returning: mocks.returning });
  });

  it("imports after the response when it wins the lease, at most every 2 minutes", async () => {
    const { refreshInboxSoon } = await import("./inbox-refresh");

    refreshInboxSoon();
    refreshInboxSoon();
    expect(mocks.after).toHaveBeenCalledTimes(1);
    await mocks.after.mock.calls[0][0]();
    expect(mocks.syncInbox).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2 * 60 * 1000 + 1);
    refreshInboxSoon();
    expect(mocks.after).toHaveBeenCalledTimes(2);
  });

  it("leaves the import to another instance that holds the lease", async () => {
    const { refreshInboxSoon } = await import("./inbox-refresh");
    mocks.returning.mockResolvedValue([]);

    refreshInboxSoon();
    await mocks.after.mock.calls[0][0]();

    expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.syncInbox).not.toHaveBeenCalled();
  });

  it("does nothing without the inbox, and only logs a failure", async () => {
    const { refreshInboxSoon } = await import("./inbox-refresh");
    mocks.configured.mockReturnValue(false);
    refreshInboxSoon();
    expect(mocks.after).not.toHaveBeenCalled();

    mocks.configured.mockReturnValue(true);
    mocks.syncInbox.mockRejectedValue(new Error("Resend 500"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    refreshInboxSoon();
    await expect(mocks.after.mock.calls[0][0]()).resolves.toBeUndefined();
  });
});
