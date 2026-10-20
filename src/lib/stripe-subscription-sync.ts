import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { withUserLock } from "@/db/clinic-lock";
import { usersTable } from "@/db/schema";
import type { PaidPlanId } from "@/lib/plans";
import type { StripeMode } from "@/lib/stripe-mode";
import { planForPriceId } from "@/lib/stripe-plan";
import { canSimulatePlan } from "@/lib/support/admin";

// past_due keeps access while Stripe retries the payment; unpaid, paused,
// incomplete and canceled subscriptions fall back to Free.
const STATUSES_WITH_ACCESS = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);

export const planForSubscription = (
  subscription: Stripe.Subscription,
  mode: StripeMode = "live",
): PaidPlanId | null => {
  if (!STATUSES_WITH_ACCESS.has(subscription.status)) {
    return null;
  }
  // Subscriptions created before plans existed only had the Essencial price.
  return (
    planForPriceId(subscription.items.data[0]?.price.id, mode) ?? "essential"
  );
};

type User = typeof usersTable.$inferSelect;

// Where each Stripe account's customer and subscription are kept.
export const billingIdsOf = (user: User, mode: StripeMode) =>
  mode === "live"
    ? {
        customerId: user.stripeCustomerId,
        subscriptionId: user.stripeSubscriptionId,
      }
    : {
        customerId: user.stripeTestCustomerId,
        subscriptionId: user.stripeTestSubscriptionId,
      };

// When a canceled subscription stops granting access; null while it renews.
export const scheduledEndOf = (subscription: Stripe.Subscription) => {
  const endsAt =
    subscription.cancel_at ??
    (subscription.cancel_at_period_end
      ? subscription.items.data[0]?.current_period_end
      : null);
  return endsAt ? new Date(endsAt * 1000) : null;
};

const customerIdOf = (subscription: Stripe.Subscription) =>
  typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

const findUserFor = async (
  subscription: Stripe.Subscription,
  mode: StripeMode,
) => {
  const userId = subscription.metadata?.userId;
  if (userId) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });
    if (user) {
      return user;
    }
  }
  const customerColumn =
    mode === "live"
      ? usersTable.stripeCustomerId
      : usersTable.stripeTestCustomerId;
  return db.query.usersTable.findFirst({
    where: eq(customerColumn, customerIdOf(subscription)),
  });
};

// Only "no such subscription" means it is gone. Rate limits, network and
// Stripe outages must fail the webhook, so Stripe retries it later instead of
// the user being downgraded on a transient error.
export const retrieveIfExists = async (
  stripe: Stripe,
  subscriptionId: string,
) => {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    if ((error as { code?: string })?.code === "resource_missing") {
      return null;
    }
    throw error;
  }
};

export const listCustomerSubscriptions = (stripe: Stripe, customerId: string) =>
  stripe.subscriptions
    .list({ customer: customerId, status: "all", limit: 100 })
    .autoPagingToArray({ limit: 10_000 });

/**
 * Picks the subscription that should define the user's plan: the current one
 * while it still grants access, otherwise the newest one that does.
 */
const chooseSubscription = (
  subscriptions: Stripe.Subscription[],
  currentSubscriptionId: string | null,
  mode: StripeMode,
) => {
  const withAccess = subscriptions.filter((subscription) =>
    planForSubscription(subscription, mode),
  );
  return (
    withAccess.find(({ id }) => id === currentSubscriptionId) ??
    withAccess.sort((a, b) => b.created - a.created)[0] ??
    null
  );
};

/**
 * Brings the user's plan in line with their subscriptions as Stripe has them
 * now.
 *
 * Webhook events can arrive late, retried or out of order, so the event only
 * says which customer to look at: every subscription of that customer is read
 * again, plus the user's current one. Canceling a duplicate therefore never
 * drops a user who still has another subscription granting access.
 */
export const syncSubscription = async (
  stripe: Stripe,
  subscriptionId: string,
  mode: StripeMode = "live",
) => {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const user = await findUserFor(subscription, mode);
  if (!user) {
    // Subscriptions created outside the app on the same Stripe account are
    // acknowledged, so Stripe does not keep retrying and disable the endpoint.
    console.warn(`Ignoring subscription ${subscription.id}: no matching user`);
    return;
  }
  // Test keys are easier to get hold of than live ones: whoever has them
  // could otherwise create a test subscription for any account.
  if (mode === "test" && !canSimulatePlan(user)) {
    console.warn(
      `Ignoring test subscription ${subscription.id}: user ${user.id} is not QA`,
    );
    return;
  }

  const customerId = customerIdOf(subscription);
  // Serialized per user, so concurrent webhooks for one checkout (created,
  // updated, invoice.paid) can't write a state read before another's.
  await withUserLock(user.id, async (tx) => {
    const latest = await tx.query.usersTable.findFirst({
      where: eq(usersTable.id, user.id),
    });
    if (!latest) {
      return;
    }
    const candidates = await listCustomerSubscriptions(stripe, customerId);
    const billing = billingIdsOf(latest, mode);
    const currentId = billing.subscriptionId;
    if (currentId && !candidates.some(({ id }) => id === currentId)) {
      const current = await retrieveIfExists(stripe, currentId);
      if (current) {
        candidates.push(current);
      }
    }

    const chosen = chooseSubscription(candidates, currentId, mode);
    // Without a subscription granting access, an event about another
    // customer must not replace the one checkout will use next.
    const nextCustomerId = chosen
      ? customerIdOf(chosen)
      : (billing.customerId ?? customerId);
    await tx
      .update(usersTable)
      .set(
        mode === "live"
          ? {
              plan: chosen ? planForSubscription(chosen) : null,
              stripeSubscriptionId: chosen?.id ?? null,
              subscriptionStatus: chosen?.status ?? null,
              subscriptionEndsAt: chosen ? scheduledEndOf(chosen) : null,
              stripeCustomerId: nextCustomerId,
            }
          : {
              // The simulated plan: without a test subscription, QA is back
              // on its real one.
              qaPlan: chosen ? planForSubscription(chosen, mode) : null,
              stripeTestSubscriptionId: chosen?.id ?? null,
              stripeTestCustomerId: nextCustomerId,
            },
      )
      .where(eq(usersTable.id, user.id));
  });
};
