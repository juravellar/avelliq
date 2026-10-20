import Stripe from "stripe";

import type { StripeMode } from "@/lib/stripe-mode";

export const STRIPE_API_VERSION = "2025-05-28.basil";

export const SECRET_KEY_ENV: Record<StripeMode, string> = {
  live: "STRIPE_SECRET_KEY",
  test: "STRIPE_TEST_SECRET_KEY",
};

const WEBHOOK_SECRET_ENV: Record<StripeMode, string> = {
  live: "STRIPE_WEBHOOK_SECRET",
  test: "STRIPE_TEST_WEBHOOK_SECRET",
};

export const stripeSecretKey = (mode: StripeMode) =>
  process.env[SECRET_KEY_ENV[mode]] || undefined;

export const stripeWebhookSecret = (mode: StripeMode) =>
  process.env[WEBHOOK_SECRET_ENV[mode]] || undefined;

export const stripeClient = (mode: StripeMode) => {
  const key = stripeSecretKey(mode);
  if (!key) {
    throw new Error(`${SECRET_KEY_ENV[mode]} is not set`);
  }
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
};
