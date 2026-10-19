import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findAccount: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/lib/support/accounts", () => ({ findAccount: mocks.findAccount }));
vi.mock("@/lib/audit", () => ({ recordAudit: mocks.audit }));
vi.mock("@/db", () => ({
  db: {
    transaction: async (run: (tx: unknown) => Promise<void>) =>
      run({
        update: () => ({
          set: (values: unknown) => ({
            where: async () => mocks.update(values),
          }),
        }),
      }),
  },
}));

import { setSupportAdmin } from ".";

const owner = {
  id: "owner",
  email: "principal@avelliq.com",
  emailVerified: true,
};
const account = { id: "u1", email: "ana@clinica.com", emailVerified: true };

describe("setSupportAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "principal@avelliq.com");
    mocks.getSession.mockResolvedValue({ user: owner });
    mocks.findAccount.mockResolvedValue(account);
  });

  it("lets an owner add and remove admins, and records who did it", async () => {
    expect(
      (await setSupportAdmin({ userId: "u1", admin: true }))?.data,
    ).toEqual({ admin: true });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ supportAdmin: true }),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "owner",
        action: "support-admin.granted",
        entityId: "u1",
      }),
      expect.anything(),
    );

    await setSupportAdmin({ userId: "u1", admin: false });
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ supportAdmin: false }),
    );
  });

  it("refuses admins who aren't owners", async () => {
    mocks.getSession.mockResolvedValue({
      user: { ...account, supportAdmin: true },
    });
    const result = await setSupportAdmin({ userId: "u2", admin: true });
    expect(result?.serverError).toBe("Acesso negado.");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses accounts with an unconfirmed e-mail and the owners", async () => {
    mocks.findAccount.mockResolvedValue({ ...account, emailVerified: false });
    expect(
      (await setSupportAdmin({ userId: "u1", admin: true }))?.serverError,
    ).toMatch(/confirmar o e-mail/);

    mocks.findAccount.mockResolvedValue(owner);
    expect(
      (await setSupportAdmin({ userId: "owner", admin: false }))?.serverError,
    ).toMatch(/conta principal/);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
