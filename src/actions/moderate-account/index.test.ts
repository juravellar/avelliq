import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findAccount: vi.fn(),
  removeAccount: vi.fn(),
  updated: vi.fn(),
  deleted: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/lib/support/accounts", () => ({ findAccount: mocks.findAccount }));
vi.mock("@/lib/audit", () => ({ recordAudit: mocks.audit }));
vi.mock("@/lib/account-data", () => ({
  deletionPreview: async () => ({ clinics: 1, patients: 3, appointments: 9 }),
}));
vi.mock("@/lib/remove-account", async () => {
  class BillingNotCancelledError extends Error {}
  return { BillingNotCancelledError, removeAccount: mocks.removeAccount };
});
vi.mock("@/db", () => ({
  db: {
    transaction: async (run: (tx: unknown) => Promise<void>) =>
      run({
        update: () => ({
          set: (values: unknown) => ({ where: () => mocks.updated(values) }),
        }),
        delete: (table: unknown) => ({ where: () => mocks.deleted(table) }),
      }),
  },
}));

import { sessionsTable } from "@/db/schema";
import { BillingNotCancelledError } from "@/lib/remove-account";

import {
  blockAccount,
  cancelDeletionRequest,
  deleteAccountAsOwner,
  getDeletionPreview,
  requestAccountDeletion,
} from ".";

const owner = { id: "owner", email: "equipe@avelliq.com", emailVerified: true };
const admin = {
  id: "admin",
  email: "a@y.com",
  emailVerified: true,
  staffRole: "admin",
};
const support = { ...admin, id: "support", staffRole: "support" };
const customer = {
  id: "customer",
  email: "Ana@Clinica.com",
  emailVerified: true,
  staffRole: null,
  deletionRequestedBy: null as string | null,
};

describe("account moderation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "equipe@avelliq.com");
    mocks.findAccount.mockResolvedValue(customer);
    mocks.audit.mockResolvedValue(undefined);
    mocks.removeAccount.mockResolvedValue(undefined);
  });

  it("lets an admin block an account, ending its sessions", async () => {
    mocks.getSession.mockResolvedValue({ user: admin });

    const result = await blockAccount({ userId: "customer", reason: "spam" });

    expect(result?.serverError).toBeUndefined();
    expect(mocks.updated).toHaveBeenCalledWith(
      expect.objectContaining({ blockedReason: "spam", blockedBy: "admin" }),
    );
    expect(mocks.deleted).toHaveBeenCalledWith(sessionsTable);
    expect(mocks.audit.mock.calls[0][0]).toMatchObject({
      userId: "admin",
      action: "account.blocked",
      entityId: "customer",
    });
  });

  it("doesn't let support block or anyone block an owner", async () => {
    mocks.getSession.mockResolvedValue({ user: support });
    expect(
      (await blockAccount({ userId: "customer", reason: "spam" }))?.serverError,
    ).toBe("Acesso negado.");

    mocks.getSession.mockResolvedValue({ user: admin });
    mocks.findAccount.mockResolvedValue({ ...owner, id: "owner2" });
    expect(
      (await blockAccount({ userId: "owner2", reason: "spam" }))?.serverError,
    ).toBe("Acesso negado.");
    expect(mocks.updated).not.toHaveBeenCalled();
  });

  it("lets admins only ask for a deletion, and the owner turn it down", async () => {
    mocks.getSession.mockResolvedValue({ user: admin });
    expect(
      (
        await deleteAccountAsOwner({
          userId: "customer",
          confirmEmail: "ana@clinica.com",
        })
      )?.serverError,
    ).toBe("Acesso negado.");
    expect(
      (await getDeletionPreview({ userId: "customer" }))?.serverError,
    ).toBe("Acesso negado.");

    await requestAccountDeletion({ userId: "customer", reason: "holder" });
    expect(mocks.updated).toHaveBeenCalledWith(
      expect.objectContaining({
        deletionRequestReason: "holder",
        deletionRequestedBy: "admin",
      }),
    );

    mocks.getSession.mockResolvedValue({ user: owner });
    mocks.findAccount.mockResolvedValue({
      ...customer,
      deletionRequestedBy: "admin",
    });
    await cancelDeletionRequest({ userId: "customer" });
    expect(mocks.updated).toHaveBeenLastCalledWith(
      expect.objectContaining({ deletionRequestedAt: null }),
    );
    expect(mocks.removeAccount).not.toHaveBeenCalled();
  });

  it("deletes for the owner only after the account's e-mail is typed", async () => {
    mocks.getSession.mockResolvedValue({ user: owner });

    const wrong = await deleteAccountAsOwner({
      userId: "customer",
      confirmEmail: "outra@x.com",
    });
    expect(wrong?.serverError).toContain("não confere");
    expect(mocks.removeAccount).not.toHaveBeenCalled();

    const preview = await getDeletionPreview({ userId: "customer" });
    expect(preview?.data).toMatchObject({ clinics: 1, patients: 3 });

    await deleteAccountAsOwner({
      userId: "customer",
      confirmEmail: " ana@clinica.com ",
    });
    expect(mocks.removeAccount).toHaveBeenCalledWith(customer, "owner");
  });

  it("keeps the account when billing can't be stopped", async () => {
    mocks.getSession.mockResolvedValue({ user: owner });
    mocks.removeAccount.mockRejectedValue(new BillingNotCancelledError());

    const result = await deleteAccountAsOwner({
      userId: "customer",
      confirmEmail: "ana@clinica.com",
    });

    expect(result?.serverError).toContain("nada foi excluído");
  });
});
