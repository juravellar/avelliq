import { canSimulatePlan } from "@/lib/support/admin";

// Which Stripe account an account pays through. QA accounts use the test one,
// so they can go through checkout with test cards while everyone else is
// charged for real.
export type StripeMode = "live" | "test";

export const stripeModeFor = (
  user: Parameters<typeof canSimulatePlan>[0],
): StripeMode => (canSimulatePlan(user) ? "test" : "live");

// Written out in full: Next.js only inlines NEXT_PUBLIC_ variables it can
// read literally, and this also runs in the browser.
export const customerPortalUrl = (mode: StripeMode, email: string) => {
  const base =
    mode === "test"
      ? process.env.NEXT_PUBLIC_STRIPE_TEST_CUSTOMER_PORTAL_URL
      : process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL;
  return `${base}?prefilled_email=${encodeURIComponent(email)}`;
};
