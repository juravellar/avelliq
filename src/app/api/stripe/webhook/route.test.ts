import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  syncSubscription: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class {
    webhooks = { constructEvent: mocks.constructEvent };
  },
}));
vi.mock("@/lib/stripe-subscription-sync", () => ({
  syncSubscription: mocks.syncSubscription,
}));

import { POST } from "./route";

const sendEvent = async (event: unknown) => {
  mocks.constructEvent.mockReturnValue(event);
  return POST(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: "{}",
    }),
  );
};

describe("Stripe webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ])("syncs the subscription on %s", async (type) => {
    const response = await sendEvent({
      type,
      data: { object: { id: "sub_1" } },
    });

    expect(response.status).toBe(200);
    expect(mocks.syncSubscription).toHaveBeenCalledWith(
      expect.anything(),
      "sub_1",
      "live",
    );
  });

  it("syncs the subscription of a paid invoice", async () => {
    await sendEvent({
      type: "invoice.paid",
      data: {
        object: {
          parent: { subscription_details: { subscription: "sub_1" } },
          lines: { data: [] },
        },
      },
    });

    expect(mocks.syncSubscription).toHaveBeenCalledWith(
      expect.anything(),
      "sub_1",
      "live",
    );
  });

  it("finds the subscription in the invoice lines when the parent lacks it", async () => {
    await sendEvent({
      type: "invoice.paid",
      data: {
        object: {
          parent: null,
          lines: {
            data: [
              {
                parent: {
                  subscription_item_details: { subscription: "sub_2" },
                },
              },
            ],
          },
        },
      },
    });

    expect(mocks.syncSubscription).toHaveBeenCalledWith(
      expect.anything(),
      "sub_2",
      "live",
    );
  });

  it("ignores invoices that are not tied to a subscription", async () => {
    const response = await sendEvent({
      type: "invoice.paid",
      data: { object: { parent: null, lines: { data: [] } } },
    });

    expect(response.status).toBe(200);
    expect(mocks.syncSubscription).not.toHaveBeenCalled();
  });

  it("tells events from the test Stripe account apart by their secret", async () => {
    vi.stubEnv("STRIPE_TEST_SECRET_KEY", "sk_test_qa");
    vi.stubEnv("STRIPE_TEST_WEBHOOK_SECRET", "whsec_test_qa");
    mocks.constructEvent.mockImplementation(
      (_body: string, _signature: string, secret: string) => {
        if (secret !== "whsec_test_qa") {
          throw new Error("bad signature");
        }
        return {
          type: "customer.subscription.created",
          data: { object: { id: "sub_qa" } },
        };
      },
    );

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.syncSubscription).toHaveBeenCalledWith(
      expect.anything(),
      "sub_qa",
      "test",
    );
  });

  it("rejects requests with an invalid signature", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.syncSubscription).not.toHaveBeenCalled();
  });
});
