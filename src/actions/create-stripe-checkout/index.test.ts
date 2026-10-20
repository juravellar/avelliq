import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const where = vi.fn();
  const set = vi.fn(() => ({ where }));
  return {
    getSession: vi.fn(),
    findUser: vi.fn(),
    set,
    createCustomer: vi.fn(),
    listSessions: vi.fn(),
    expireSession: vi.fn(),
    createSession: vi.fn(),
    listSubscriptions: vi.fn(),
    retrieveSubscription: vi.fn(),
    stripeKey: vi.fn(),
  };
});

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/db", () => ({
  db: {
    query: { usersTable: { findFirst: mocks.findUser } },
    update: () => ({ set: mocks.set }),
  },
}));
vi.mock("stripe", () => ({
  default: class {
    constructor(key: string) {
      mocks.stripeKey(key);
    }
    customers = { create: mocks.createCustomer };
    subscriptions = {
      list: mocks.listSubscriptions,
      retrieve: mocks.retrieveSubscription,
    };
    checkout = {
      sessions: {
        list: mocks.listSessions,
        expire: mocks.expireSession,
        create: mocks.createSession,
      },
    };
  },
}));

import { createStripeCheckout } from ".";

const pages = <T>(items: T[]) => ({
  autoPagingToArray: async () => [...items],
});

const freeUser = {
  id: "user_1",
  name: "Ana",
  email: "ana@example.com",
  plan: null,
  stripeCustomerId: "cus_1",
  stripeSubscriptionId: null,
};

describe("createStripeCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");
    vi.stubEnv("STRIPE_PROFESSIONAL_PLAN_PRICE_ID", "price_professional");
    mocks.getSession.mockResolvedValue({ user: { id: "user_1" } });
    mocks.findUser.mockResolvedValue(freeUser);
    mocks.createCustomer.mockResolvedValue({ id: "cus_new" });
    mocks.listSubscriptions.mockReturnValue(pages([]));
    mocks.listSessions.mockReturnValue(pages([]));
    mocks.createSession.mockResolvedValue({
      id: "cs_new",
      url: "https://checkout.stripe.com/c/pay/cs_new",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("opens a checkout for the plan, idempotent within a minute", async () => {
    const result = await createStripeCheckout({ plan: "professional" });

    expect(result?.data).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_new",
    });
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_1",
        metadata: { plan: "professional", interval: "monthly" },
        line_items: [{ price: "price_professional", quantity: 1 }],
      }),
      { idempotencyKey: expect.stringMatching(/^checkout:[0-9a-f]{64}$/) },
    );
  });

  it("creates a customer keyed by the user's details and keeps the saved one", async () => {
    mocks.findUser
      .mockResolvedValueOnce({ ...freeUser, stripeCustomerId: null })
      .mockResolvedValue({ ...freeUser, stripeCustomerId: "cus_saved_first" });

    await createStripeCheckout({ plan: "professional" });

    expect(mocks.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { userId: "user_1" } }),
      { idempotencyKey: expect.stringMatching(/^customer:[0-9a-f]{64}$/) },
    );
    expect(mocks.set).toHaveBeenCalledWith({ stripeCustomerId: "cus_new" });
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_saved_first" }),
      expect.anything(),
    );
  });

  it("changes the customer idempotency key when the user's name changes", async () => {
    const keys: string[] = [];
    mocks.createCustomer.mockImplementation(async (_params, options) => {
      keys.push(options.idempotencyKey);
      return { id: "cus_new" };
    });
    mocks.findUser.mockResolvedValueOnce({
      ...freeUser,
      stripeCustomerId: null,
    });
    await createStripeCheckout({ plan: "professional" });
    mocks.findUser.mockResolvedValueOnce({
      ...freeUser,
      name: "Ana Souza",
      stripeCustomerId: null,
    });
    await createStripeCheckout({ plan: "professional" });

    expect(keys[0]).not.toBe(keys[1]);
  });

  it.each(["active", "trialing", "past_due", "unpaid", "paused"])(
    "refuses a new checkout while a subscription is %s",
    async (status) => {
      mocks.listSubscriptions.mockReturnValue(pages([{ id: "sub_1", status }]));

      const result = await createStripeCheckout({ plan: "professional" });

      expect(result?.serverError).toBe(
        "Você já tem uma assinatura. Use Gerenciar assinatura para trocar de plano.",
      );
      expect(mocks.createSession).not.toHaveBeenCalled();
    },
  );

  it("refuses when the user's subscription lives on another customer", async () => {
    mocks.findUser.mockResolvedValue({
      ...freeUser,
      stripeSubscriptionId: "sub_elsewhere",
    });
    mocks.retrieveSubscription.mockResolvedValue({
      id: "sub_elsewhere",
      status: "active",
    });

    const result = await createStripeCheckout({ plan: "professional" });

    expect(result?.serverError).toContain("Você já tem uma assinatura");
  });

  it("allows a checkout after the previous subscription ended", async () => {
    mocks.listSubscriptions.mockReturnValue(
      pages([{ id: "sub_1", status: "canceled" }]),
    );

    const result = await createStripeCheckout({ plan: "professional" });

    expect(result?.data).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_new",
    });
  });

  it("reuses the open checkout for the same plan", async () => {
    mocks.listSessions.mockReturnValue(
      pages([
        {
          id: "cs_open",
          url: "https://checkout.stripe.com/c/pay/cs_open",
          metadata: { plan: "professional" },
        },
      ]),
    );

    const result = await createStripeCheckout({ plan: "professional" });

    expect(result?.data).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_open",
    });
    expect(mocks.expireSession).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("charges the yearly price when the user picks yearly", async () => {
    vi.stubEnv(
      "STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID",
      "price_professional_year",
    );

    await createStripeCheckout({ plan: "professional", interval: "yearly" });

    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { plan: "professional", interval: "yearly" },
        line_items: [{ price: "price_professional_year", quantity: 1 }],
      }),
      expect.anything(),
    );
  });

  it("explains when yearly billing isn't offered for the plan", async () => {
    vi.stubEnv("STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID", "");

    const result = await createStripeCheckout({
      plan: "professional",
      interval: "yearly",
    });

    expect(result?.serverError).toBe(
      "O pagamento anual não está disponível para este plano.",
    );
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("doesn't reuse an open monthly checkout for a yearly one", async () => {
    vi.stubEnv(
      "STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID",
      "price_professional_year",
    );
    mocks.listSessions
      .mockReturnValueOnce(
        pages([
          {
            id: "cs_month",
            url: "https://checkout.stripe.com/c/pay/cs_month",
            metadata: { plan: "professional" },
          },
        ]),
      )
      .mockReturnValue(pages([]));

    const result = await createStripeCheckout({
      plan: "professional",
      interval: "yearly",
    });

    expect(mocks.expireSession).toHaveBeenCalledWith("cs_month");
    expect(result?.data).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_new",
    });
  });

  it("expires open checkouts for another plan", async () => {
    mocks.listSessions
      .mockReturnValueOnce(
        pages([
          {
            id: "cs_other",
            url: "https://checkout.stripe.com/c/pay/cs_other",
            metadata: { plan: "essential" },
          },
        ]),
      )
      .mockReturnValue(pages([]));

    const result = await createStripeCheckout({ plan: "professional" });

    expect(mocks.expireSession).toHaveBeenCalledWith("cs_other");
    expect(result?.data).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_new",
    });
  });

  it("refuses to open a second checkout if an old one could not be expired", async () => {
    const other = {
      id: "cs_other",
      url: "https://checkout.stripe.com/c/pay/cs_other",
      metadata: { plan: "essential" },
    };
    mocks.listSessions.mockReturnValue(pages([other]));
    mocks.expireSession.mockRejectedValue(new Error("Stripe is unavailable"));

    const result = await createStripeCheckout({ plan: "professional" });

    expect(result?.serverError).toBeDefined();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("ignores an expire error when the session already closed", async () => {
    mocks.listSessions
      .mockReturnValueOnce(
        pages([
          {
            id: "cs_paid",
            url: "https://checkout.stripe.com/c/pay/cs_paid",
            metadata: { plan: "essential" },
          },
        ]),
      )
      .mockReturnValue(pages([]));
    mocks.expireSession.mockRejectedValue(new Error("session is not open"));

    const result = await createStripeCheckout({ plan: "professional" });

    expect(result?.data).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_new",
    });
  });

  it("refuses when the database already has a paid subscription", async () => {
    mocks.findUser.mockResolvedValue({
      ...freeUser,
      plan: "essential",
      stripeSubscriptionId: "sub_1",
    });

    const result = await createStripeCheckout({ plan: "professional" });

    expect(result?.serverError).toContain("Você já tem uma assinatura");
    expect(mocks.listSubscriptions).not.toHaveBeenCalled();
  });

  it("gives a fresh session when returning to a plan whose checkout was expired", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T15:00:10Z"));
    const keys: string[] = [];
    mocks.createSession.mockImplementation(async (_params, options) => {
      keys.push(options.idempotencyKey);
      return { id: `cs_${keys.length}` };
    });
    // Same minute: the plan with nothing open, then again while another is open.
    mocks.listSessions.mockReturnValueOnce(pages([]));
    await createStripeCheckout({ plan: "professional" });
    mocks.listSessions
      .mockReturnValueOnce(
        pages([
          {
            id: "cs_b",
            url: "https://checkout.stripe.com/c/pay/cs_b",
            metadata: { plan: "essential" },
          },
        ]),
      )
      .mockReturnValue(pages([]));
    await createStripeCheckout({ plan: "professional" });

    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("gives a double click the same idempotency key", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T15:00:10Z"));
    const keys: string[] = [];
    mocks.createSession.mockImplementation(async (_params, options) => {
      keys.push(options.idempotencyKey);
      return {
        id: "cs_same",
        url: "https://checkout.stripe.com/c/pay/cs_same",
      };
    });

    await Promise.all([
      createStripeCheckout({ plan: "professional" }),
      createStripeCheckout({ plan: "professional" }),
    ]);

    expect(keys[0]).toBe(keys[1]);
  });

  describe("for QA accounts", () => {
    const qaUser = {
      ...freeUser,
      email: "qa@avelliq.com",
      emailVerified: true,
      staffRole: "qa",
      qaPlan: null,
      stripeCustomerId: "cus_live",
      stripeTestCustomerId: "cus_test",
      stripeTestSubscriptionId: null,
    };

    beforeEach(() => {
      vi.stubEnv("STRIPE_TEST_SECRET_KEY", "sk_test_qa");
      vi.stubEnv("STRIPE_TEST_PROFESSIONAL_PLAN_PRICE_ID", "price_test_pro");
      mocks.findUser.mockResolvedValue(qaUser);
    });

    it("checks out through the test Stripe account, never the real one", async () => {
      const result = await createStripeCheckout({ plan: "professional" });

      expect(result?.data?.url).toBeDefined();
      expect(mocks.stripeKey).toHaveBeenCalledWith("sk_test_qa");
      expect(mocks.stripeKey).not.toHaveBeenCalledWith("sk_test");
      expect(mocks.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_test",
          line_items: [{ price: "price_test_pro", quantity: 1 }],
        }),
        expect.anything(),
      );
    });

    it("keeps the test customer apart from the real one", async () => {
      mocks.findUser
        .mockResolvedValueOnce({ ...qaUser, stripeTestCustomerId: null })
        .mockResolvedValue({ ...qaUser, stripeTestCustomerId: "cus_new" });

      await createStripeCheckout({ plan: "professional" });

      expect(mocks.set).toHaveBeenCalledWith({
        stripeTestCustomerId: "cus_new",
      });
      expect(mocks.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ stripeCustomerId: expect.anything() }),
      );
    });

    it("refuses to check out when the test account isn't configured", async () => {
      vi.stubEnv("STRIPE_TEST_SECRET_KEY", "");

      const result = await createStripeCheckout({ plan: "professional" });

      expect(result?.serverError).toMatch(
        /Stripe de teste não está configurado/,
      );
      expect(mocks.stripeKey).not.toHaveBeenCalled();
      expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it("says a QA account already has a test subscription", async () => {
      mocks.findUser.mockResolvedValue({
        ...qaUser,
        qaPlan: "essential",
        stripeTestSubscriptionId: "sub_test",
      });

      const result = await createStripeCheckout({ plan: "professional" });

      expect(result?.serverError).toMatch(/já tem uma assinatura/);
    });
  });
});
