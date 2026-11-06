import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  ticketsOf: vi.fn(),
  deleteTicketsOf: vi.fn(),
}));

vi.mock("@/lib/stripe-client", () => ({ stripeClient: vi.fn() }));
vi.mock("@/lib/stripe-subscription-sync", () => ({
  listCustomerSubscriptions: vi.fn(),
}));
vi.mock("@/lib/support/retention", () => ({
  ticketsOf: mocks.ticketsOf,
  deleteTicketsOf: mocks.deleteTicketsOf,
}));
vi.mock("@/db", () => ({
  db: {
    query: {
      usersTable: { findFirst: mocks.findUser },
      usersToClinicsTable: { findMany: async () => [] },
    },
    delete: () => ({ where: async () => undefined }),
  },
}));

import { db } from "@/db";

import { collectAccountData, deleteAccountData } from "./account-data";

const user = { id: "user_1", email: "dona@clinica.com" };

describe("account data and support tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ticketsOf.mockResolvedValue([{ protocol: "AV-000001" }]);
  });

  it("exports and deletes the tickets of a confirmed e-mail", async () => {
    mocks.findUser.mockResolvedValue({ ...user, emailVerified: true });

    const data = await collectAccountData("user_1");
    await deleteAccountData(db as never, "user_1");

    expect(data?.supportTickets).toHaveLength(1);
    expect(mocks.deleteTicketsOf).toHaveBeenCalledWith(db, user.email);
  });

  it("leaves the tickets of an unconfirmed e-mail alone", async () => {
    mocks.findUser.mockResolvedValue({ ...user, emailVerified: false });

    const data = await collectAccountData("user_1");
    await deleteAccountData(db as never, "user_1");

    expect(data?.supportTickets).toEqual([]);
    expect(mocks.ticketsOf).not.toHaveBeenCalled();
    expect(mocks.deleteTicketsOf).not.toHaveBeenCalled();
  });
});
