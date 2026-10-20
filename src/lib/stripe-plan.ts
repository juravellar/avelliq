import { unstable_cache } from "next/cache";
import type Stripe from "stripe";

import {
  BILLING_INTERVALS,
  type BillingInterval,
  type PlanPrice,
} from "@/lib/plan-price";
import { PAID_PLAN_IDS, type PaidPlanId } from "@/lib/plans";
import {
  SECRET_KEY_ENV,
  stripeClient,
  stripeSecretKey,
} from "@/lib/stripe-client";
import type { StripeMode } from "@/lib/stripe-mode";

export {
  BILLING_INTERVALS,
  type BillingInterval,
  monthlyEquivalent,
  type PlanPrice,
  yearlySavingsPercent,
} from "@/lib/plan-price";

const MONTHS_PER_INTERVAL: Partial<
  Record<Stripe.Price.Recurring.Interval, number>
> = { month: 1, year: 12 };

const INTERVAL_LABELS: Record<Stripe.Price.Recurring.Interval, string> = {
  day: "dia",
  week: "semana",
  month: "mês",
  year: "ano",
};

export const formatPlanPrice = (price: Stripe.Price): PlanPrice | null => {
  if (price.unit_amount === null) {
    return null;
  }
  const amount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: price.unit_amount % 100 === 0 ? 0 : 2,
  }).format(price.unit_amount / 100);
  const interval = price.recurring
    ? INTERVAL_LABELS[price.recurring.interval]
    : null;
  const months = price.recurring
    ? (MONTHS_PER_INTERVAL[price.recurring.interval] ?? 1) *
      (price.recurring.interval_count ?? 1)
    : 1;
  return { amount, interval, cents: price.unit_amount, months };
};

// The yearly prices are optional: without them the page offers monthly only.
// The test Stripe account has its own prices, under STRIPE_TEST_*.
const PRICE_ENV: Record<PaidPlanId, Record<BillingInterval, string>> = {
  essential: {
    monthly: "STRIPE_ESSENTIAL_PLAN_PRICE_ID",
    yearly: "STRIPE_ESSENTIAL_ANNUAL_PRICE_ID",
  },
  professional: {
    monthly: "STRIPE_PROFESSIONAL_PLAN_PRICE_ID",
    yearly: "STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID",
  },
};

const priceEnv = (
  plan: PaidPlanId,
  interval: BillingInterval,
  mode: StripeMode,
) => {
  const name = PRICE_ENV[plan][interval];
  return mode === "test" ? name.replace(/^STRIPE_/, "STRIPE_TEST_") : name;
};

export const priceIdForPlan = (
  plan: PaidPlanId,
  interval: BillingInterval = "monthly",
  mode: StripeMode = "live",
) => process.env[priceEnv(plan, interval, mode)] || undefined;

// A subscription on either billing period grants the same plan.
export const planForPriceId = (
  priceId: string | null | undefined,
  mode: StripeMode = "live",
): PaidPlanId | null =>
  PAID_PLAN_IDS.find(
    (plan) =>
      priceId &&
      BILLING_INTERVALS.some(
        (interval) => priceIdForPlan(plan, interval, mode) === priceId,
      ),
  ) ?? null;

// Whether QA accounts can go through checkout: the test account's key and
// at least one monthly price.
export const isStripeTestReady = () =>
  Boolean(stripeSecretKey("test")) &&
  PAID_PLAN_IDS.some((plan) => priceIdForPlan(plan, "monthly", "test"));

// The price id and mode are arguments, so they are part of the cache key:
// changing the env var takes effect at once. Failures throw and are
// therefore not cached.
const fetchPriceById = unstable_cache(
  async (priceId: string, mode: StripeMode): Promise<PlanPrice | null> => {
    const stripe = stripeClient(mode);
    return formatPlanPrice(await stripe.prices.retrieve(priceId));
  },
  ["plan-price"],
  { revalidate: 3600 },
);

// Missing configuration is reported once per server instance instead of on
// every render of the plans page.
const reportedMissingConfig = new Set<string>();
const reportMissingConfig = (name: string) => {
  if (!reportedMissingConfig.has(name)) {
    reportedMissingConfig.add(name);
    console.warn(`${name} is not set; plan prices are hidden`);
  }
};

const loadPlanPrice = async (
  plan: PaidPlanId,
  interval: BillingInterval,
  mode: StripeMode,
): Promise<PlanPrice | null> => {
  if (!stripeSecretKey(mode)) {
    reportMissingConfig(SECRET_KEY_ENV[mode]);
    return null;
  }
  const priceId = priceIdForPlan(plan, interval, mode);
  if (!priceId) {
    // Yearly prices are optional, so only a missing monthly one is reported.
    if (interval === "monthly") {
      reportMissingConfig(priceEnv(plan, "monthly", mode));
    }
    return null;
  }
  try {
    return await fetchPriceById(priceId, mode);
  } catch (error) {
    console.error(
      `Failed to load the ${interval} Stripe price of plan ${plan}`,
      error,
    );
    return null;
  }
};

export type PlanPrices = Record<
  PaidPlanId,
  Record<BillingInterval, PlanPrice | null>
>;

// Checkout charges these Stripe prices, so the plan cards must show the same.
export const getPlanPrices = async (
  mode: StripeMode = "live",
): Promise<PlanPrices> => {
  const [essentialMonthly, essentialYearly, proMonthly, proYearly] =
    await Promise.all([
      loadPlanPrice("essential", "monthly", mode),
      loadPlanPrice("essential", "yearly", mode),
      loadPlanPrice("professional", "monthly", mode),
      loadPlanPrice("professional", "yearly", mode),
    ]);
  return {
    essential: { monthly: essentialMonthly, yearly: essentialYearly },
    professional: { monthly: proMonthly, yearly: proYearly },
  };
};
