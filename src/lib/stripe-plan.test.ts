import type Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import {
  formatPlanPrice,
  monthlyEquivalent,
  planForPriceId,
  priceIdForPlan,
  yearlySavingsPercent,
} from "./stripe-plan";

const price = (overrides: Partial<Stripe.Price>) =>
  ({
    unit_amount: 5900,
    currency: "brl",
    recurring: { interval: "month" },
    ...overrides,
  }) as Stripe.Price;

describe("formatPlanPrice", () => {
  it("formats a monthly BRL price without cents", () => {
    expect(formatPlanPrice(price({}))).toEqual({
      amount: "R$ 59",
      interval: "mês",
      cents: 5900,
      months: 1,
    });
  });

  it("keeps cents when the price has them", () => {
    expect(formatPlanPrice(price({ unit_amount: 7990 }))?.amount).toBe(
      "R$ 79,90",
    );
  });

  it("labels yearly prices", () => {
    const yearly = formatPlanPrice(
      price({ recurring: { interval: "year" } as Stripe.Price.Recurring }),
    );
    expect(yearly?.interval).toBe("ano");
    expect(yearly?.months).toBe(12);
  });

  it("returns null for prices without a fixed amount", () => {
    expect(formatPlanPrice(price({ unit_amount: null }))).toBeNull();
  });
});

describe("planForPriceId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps each configured Stripe price to its plan", () => {
    vi.stubEnv("STRIPE_ESSENTIAL_PLAN_PRICE_ID", "price_essential");
    vi.stubEnv("STRIPE_PROFESSIONAL_PLAN_PRICE_ID", "price_professional");

    expect(priceIdForPlan("professional")).toBe("price_professional");
    expect(planForPriceId("price_essential")).toBe("essential");
    expect(planForPriceId("price_professional")).toBe("professional");
  });

  it("returns null for unknown or missing prices", () => {
    vi.stubEnv("STRIPE_ESSENTIAL_PLAN_PRICE_ID", "price_essential");
    vi.stubEnv("STRIPE_PROFESSIONAL_PLAN_PRICE_ID", "");

    expect(planForPriceId("price_other")).toBeNull();
    expect(planForPriceId(undefined)).toBeNull();
    expect(planForPriceId("")).toBeNull();
  });
});

describe("getPlanPrices", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("hides prices and warns once when Stripe is not configured", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const { getPlanPrices } = await import("./stripe-plan");

    await expect(getPlanPrices()).resolves.toEqual({
      essential: { monthly: null, yearly: null },
      professional: { monthly: null, yearly: null },
    });
    await getPlanPrices();

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "STRIPE_SECRET_KEY is not set; plan prices are hidden",
    );
  });
});

describe("yearly plans", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps a yearly price to the same plan as the monthly one", () => {
    vi.stubEnv("STRIPE_ESSENTIAL_PLAN_PRICE_ID", "price_ess_month");
    vi.stubEnv("STRIPE_ESSENTIAL_ANNUAL_PRICE_ID", "price_ess_year");

    expect(priceIdForPlan("essential", "yearly")).toBe("price_ess_year");
    expect(planForPriceId("price_ess_year")).toBe("essential");
    expect(planForPriceId("price_ess_month")).toBe("essential");
  });

  it("reads the test Stripe account's prices for QA", () => {
    vi.stubEnv("STRIPE_ESSENTIAL_PLAN_PRICE_ID", "price_live");
    vi.stubEnv("STRIPE_TEST_ESSENTIAL_PLAN_PRICE_ID", "price_test");
    vi.stubEnv("STRIPE_TEST_ESSENTIAL_ANNUAL_PRICE_ID", "price_test_year");

    expect(priceIdForPlan("essential", "monthly", "test")).toBe("price_test");
    expect(priceIdForPlan("essential", "yearly", "test")).toBe(
      "price_test_year",
    );
    expect(planForPriceId("price_test_year", "test")).toBe("essential");
    // A test price never grants a real plan, nor a real one a test plan.
    expect(planForPriceId("price_test", "live")).toBeNull();
    expect(planForPriceId("price_live", "test")).toBeNull();
  });

  it("has no yearly price when it isn't configured", () => {
    vi.stubEnv("STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID", "");

    expect(priceIdForPlan("professional", "yearly")).toBeUndefined();
  });

  it("computes the saving of paying yearly", () => {
    const monthly = {
      amount: "R$ 79",
      interval: "mês",
      cents: 7900,
      months: 1,
    };
    const yearly = {
      amount: "R$ 790",
      interval: "ano",
      cents: 79000,
      months: 12,
    };

    // 790 instead of 12 × 79 = 948: two months free, about 17%.
    expect(yearlySavingsPercent(monthly, yearly)).toBe(17);
    expect(
      yearlySavingsPercent(monthly, { ...yearly, cents: 94800 }),
    ).toBeNull();
    expect(yearlySavingsPercent(null, yearly)).toBeNull();
    expect(monthlyEquivalent(yearly).replace(/\u00a0/g, " ")).toBe("R$ 65,83");
  });
});
