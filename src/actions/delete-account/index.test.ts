import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
  cancelBillableSubscriptions: vi.fn(),
  deleteAccountData: vi.fn(),
  recordAudit: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/lib/account-data", () => ({
  cancelBillableSubscriptions: mocks.cancelBillableSubscriptions,
  deleteAccountData: mocks.deleteAccountData,
}));
vi.mock("@/lib/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/db", () => {
  const db: Record<string, unknown> = {
    query: { usersTable: { findFirst: mocks.findUser } },
  };
  db.transaction = async (fn: (tx: unknown) => unknown) =>
    fn({ ...db, execute: mocks.execute });
  return { db };
});

import { deleteAccount } from ".";

describe("deleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getSession.mockResolvedValue({
      user: { id: "user_1", email: "Dona@Clinica.com" },
    });
    mocks.findUser.mockResolvedValue({
      id: "user_1",
      stripeCustomerId: "cus_1",
    });
    mocks.cancelBillableSubscriptions.mockResolvedValue(undefined);
    mocks.deleteAccountData.mockResolvedValue(1);
  });

  it("cancels billing, then deletes the account and records it", async () => {
    const result = await deleteAccount({ confirmEmail: " dona@clinica.com " });

    expect(result?.serverError).toBeUndefined();
    expect(mocks.cancelBillableSubscriptions).toHaveBeenCalledWith("cus_1");
    expect(mocks.deleteAccountData).toHaveBeenCalledWith(
      expect.anything(),
      "user_1",
    );
    expect(
      mocks.cancelBillableSubscriptions.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.deleteAccountData.mock.invocationCallOrder[0]);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      {
        userId: null,
        clinicId: null,
        action: "account.deleted",
        entityId: "user_1",
      },
      expect.anything(),
    );
  });

  it("refuses when the typed email doesn't match", async () => {
    const result = await deleteAccount({ confirmEmail: "outra@clinica.com" });

    expect(result?.serverError).toBe(
      "O email digitado não confere com o da conta.",
    );
    expect(mocks.cancelBillableSubscriptions).not.toHaveBeenCalled();
    expect(mocks.deleteAccountData).not.toHaveBeenCalled();
  });

  it("deletes nothing if the subscription can't be canceled", async () => {
    mocks.cancelBillableSubscriptions.mockRejectedValue(
      new Error("stripe down"),
    );

    const result = await deleteAccount({ confirmEmail: "dona@clinica.com" });

    expect(result?.serverError).toContain("nada foi excluído");
    expect(mocks.deleteAccountData).not.toHaveBeenCalled();
  });

  it("skips Stripe for an account that never subscribed", async () => {
    mocks.findUser.mockResolvedValue({ id: "user_1", stripeCustomerId: null });

    await deleteAccount({ confirmEmail: "dona@clinica.com" });

    expect(mocks.cancelBillableSubscriptions).not.toHaveBeenCalled();
    expect(mocks.deleteAccountData).toHaveBeenCalled();
  });

  it("also cancels a QA account's test subscriptions", async () => {
    vi.stubEnv("STRIPE_TEST_SECRET_KEY", "sk_test_qa");
    mocks.findUser.mockResolvedValue({
      id: "user_1",
      stripeCustomerId: null,
      stripeTestCustomerId: "cus_test",
    });

    await deleteAccount({ confirmEmail: "dona@clinica.com" });

    expect(mocks.cancelBillableSubscriptions).toHaveBeenCalledTimes(1);
    expect(mocks.cancelBillableSubscriptions).toHaveBeenCalledWith(
      "cus_test",
      "test",
    );
    vi.unstubAllEnvs();
  });
});
