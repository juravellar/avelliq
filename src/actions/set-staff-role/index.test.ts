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

import { setStaffRole } from ".";

const owner = {
  id: "owner",
  email: "principal@avelliq.com",
  emailVerified: true,
};
const admin = {
  id: "admin",
  email: "admin@avelliq.com",
  emailVerified: true,
  staffRole: "admin",
};
const account = {
  id: "u1",
  email: "ana@clinica.com",
  emailVerified: true,
  staffRole: null,
};

describe("setStaffRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "principal@avelliq.com");
    mocks.getSession.mockResolvedValue({ user: owner });
    mocks.findAccount.mockResolvedValue(account);
  });

  it("lets an owner choose admins and support, and records who did it", async () => {
    expect((await setStaffRole({ userId: "u1", role: "admin" }))?.data).toEqual(
      { role: "admin" },
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ staffRole: "admin" }),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "owner",
        action: "staff.admin-granted",
        entityId: "u1",
      }),
      expect.anything(),
    );

    mocks.findAccount.mockResolvedValue({ ...account, staffRole: "admin" });
    await setStaffRole({ userId: "u1", role: null });
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ staffRole: null }),
    );
    expect(mocks.audit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "staff.removed" }),
      expect.anything(),
    );
  });

  it("lets an admin add and remove support", async () => {
    mocks.getSession.mockResolvedValue({ user: admin });
    await setStaffRole({ userId: "u1", role: "support" });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ staffRole: "support" }),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin",
        action: "staff.support-granted",
      }),
      expect.anything(),
    );

    mocks.findAccount.mockResolvedValue({ ...account, staffRole: "support" });
    await setStaffRole({ userId: "u1", role: null });
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ staffRole: null }),
    );
  });

  it("doesn't let an admin make admins or change one", async () => {
    mocks.getSession.mockResolvedValue({ user: admin });
    expect(
      (await setStaffRole({ userId: "u1", role: "admin" }))?.serverError,
    ).toMatch(/conta principal/);

    mocks.findAccount.mockResolvedValue({ ...account, staffRole: "admin" });
    expect(
      (await setStaffRole({ userId: "u1", role: "support" }))?.serverError,
    ).toMatch(/conta principal/);
    expect(
      (await setStaffRole({ userId: "u1", role: null }))?.serverError,
    ).toMatch(/conta principal/);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses support and everyone off the team", async () => {
    mocks.getSession.mockResolvedValue({
      user: { ...account, staffRole: "support" },
    });
    expect(
      (await setStaffRole({ userId: "u2", role: "support" }))?.serverError,
    ).toBe("Acesso negado.");
    mocks.getSession.mockResolvedValue({ user: account });
    expect(
      (await setStaffRole({ userId: "u2", role: "support" }))?.serverError,
    ).toBe("Acesso negado.");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("changes nothing and records nothing when the account already has that role", async () => {
    mocks.findAccount.mockResolvedValue({ ...account, staffRole: "support" });
    expect(
      (await setStaffRole({ userId: "u1", role: "support" }))?.data,
    ).toEqual({ role: "support" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("refuses accounts with an unconfirmed e-mail and the owners", async () => {
    mocks.findAccount.mockResolvedValue({ ...account, emailVerified: false });
    expect(
      (await setStaffRole({ userId: "u1", role: "support" }))?.serverError,
    ).toMatch(/confirmar o e-mail/);

    mocks.findAccount.mockResolvedValue(owner);
    expect(
      (await setStaffRole({ userId: "owner", role: null }))?.serverError,
    ).toMatch(/conta principal \(SUPPORT_ADMIN_EMAILS\)/);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
