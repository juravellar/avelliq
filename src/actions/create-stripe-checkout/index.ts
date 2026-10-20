"use server";

import { createHash } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { z } from "zod";

import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { UserFacingError } from "@/lib/action-errors";
import { auth } from "@/lib/auth";
import { actionClient } from "@/lib/next-safe-action";
import { isPaidPlan, type PaidPlanId } from "@/lib/plans";
import { stripeClient, stripeSecretKey } from "@/lib/stripe-client";
import { type StripeMode, stripeModeFor } from "@/lib/stripe-mode";
import { type BillingInterval, priceIdForPlan } from "@/lib/stripe-plan";
import {
  billingIdsOf,
  listCustomerSubscriptions,
  retrieveIfExists,
} from "@/lib/stripe-subscription-sync";

const ALREADY_SUBSCRIBED_MESSAGE =
  "Você já tem uma assinatura. Use Gerenciar assinatura para trocar de plano.";

// Any subscription that can still bill the customer, including ones waiting
// on payment, must be managed in the portal rather than duplicated.
const LIVE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
]);
const isLive = (subscription: Stripe.Subscription) =>
  LIVE_STATUSES.has(subscription.status);

// Stripe rejects an idempotency key reused with different parameters, so the
// parameters are part of the key.
const idempotencyKey = (scope: string, ...parts: string[]) =>
  `${scope}:${createHash("sha256").update(parts.join("|")).digest("hex")}`;

type User = typeof usersTable.$inferSelect;

const ensureCustomer = async (stripe: Stripe, user: User, mode: StripeMode) => {
  const existing = billingIdsOf(user, mode).customerId;
  if (existing) {
    return existing;
  }
  const customer = await stripe.customers.create(
    { email: user.email, name: user.name, metadata: { userId: user.id } },
    {
      idempotencyKey: idempotencyKey(
        mode === "live" ? "customer" : "test-customer",
        user.id,
        user.email,
        user.name,
      ),
    },
  );
  const column =
    mode === "live"
      ? usersTable.stripeCustomerId
      : usersTable.stripeTestCustomerId;
  await db
    .update(usersTable)
    .set(
      mode === "live"
        ? { stripeCustomerId: customer.id }
        : { stripeTestCustomerId: customer.id },
    )
    .where(and(eq(usersTable.id, user.id), isNull(column)));
  // A concurrent request may have saved its customer first; use that one.
  const saved = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, user.id),
  });
  return (saved && billingIdsOf(saved, mode).customerId) ?? customer.id;
};

const hasLiveSubscription = async (
  stripe: Stripe,
  user: User,
  customerId: string,
  mode: StripeMode,
) => {
  const subscriptions = await listCustomerSubscriptions(stripe, customerId);
  if (subscriptions.some(isLive)) {
    return true;
  }
  // The current subscription may belong to an older customer of the user.
  const currentId = billingIdsOf(user, mode).subscriptionId;
  if (currentId && !subscriptions.some(({ id }) => id === currentId)) {
    const current = await retrieveIfExists(stripe, currentId);
    return current ? isLive(current) : false;
  }
  return false;
};

/**
 * Returns the open checkout for this plan if there is one, after expiring
 * open checkouts for other plans. Throws if any of those stays open, since two
 * payable checkouts could create two subscriptions.
 */
const resolveOpenCheckouts = async (
  stripe: Stripe,
  customerId: string,
  plan: PaidPlanId,
  interval: BillingInterval,
) => {
  const listOpen = () =>
    stripe.checkout.sessions
      .list({ customer: customerId, status: "open", limit: 100 })
      .autoPagingToArray({ limit: 1_000 });

  const open = await listOpen();
  // Sessions from before yearly billing carry no interval: they're monthly.
  const reusable = open.find(
    (session) =>
      session.metadata?.plan === plan &&
      (session.metadata?.interval ?? "monthly") === interval,
  );
  const others = open.filter((session) => session !== reusable);
  await Promise.allSettled(
    others.map((session) => stripe.checkout.sessions.expire(session.id)),
  );
  if (others.length > 0) {
    const stillOpen = await listOpen();
    if (stillOpen.some(({ id }) => others.some((other) => other.id === id))) {
      throw new Error("A previous checkout session could not be expired");
    }
  }
  return { reusable: reusable ?? null, openIds: open.map(({ id }) => id) };
};

// The browser goes straight to the hosted checkout page, so Stripe.js never
// loads in the app (once loaded, it reports every page change to Stripe).
const checkoutUrl = (checkout: Stripe.Checkout.Session) => {
  if (!checkout.url) {
    throw new Error(`Checkout session ${checkout.id} has no url`);
  }
  return checkout.url;
};

export const createStripeCheckout = actionClient
  .schema(
    z.object({
      plan: z.enum(["essential", "professional"]),
      interval: z.enum(["monthly", "yearly"]).default("monthly"),
    }),
  )
  .action(async ({ parsedInput }) => {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user) {
      throw new Error("Unauthorized");
    }
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, session.user.id),
    });
    if (!user) {
      throw new Error("Unauthorized");
    }
    // QA accounts pay through the test Stripe account, and never through the
    // real one: without test keys they can't check out at all.
    const mode = stripeModeFor(user);
    if (!stripeSecretKey(mode)) {
      if (mode === "test") {
        throw new UserFacingError(
          "O Stripe de teste não está configurado neste ambiente, então contas QA não podem assinar.",
        );
      }
      throw new Error("Stripe secret key not found");
    }
    const priceId = priceIdForPlan(
      parsedInput.plan,
      parsedInput.interval,
      mode,
    );
    if (!priceId && parsedInput.interval === "yearly") {
      throw new UserFacingError(
        "O pagamento anual não está disponível para este plano.",
      );
    }
    if (!priceId) {
      throw new Error(`Stripe price not configured for ${parsedInput.plan}`);
    }
    const paidPlan = mode === "live" ? user.plan : user.qaPlan;
    if (billingIdsOf(user, mode).subscriptionId && isPaidPlan(paidPlan)) {
      throw new UserFacingError(ALREADY_SUBSCRIBED_MESSAGE);
    }

    const stripe = stripeClient(mode);
    const customerId = await ensureCustomer(stripe, user, mode);

    // Stripe, not the database, is the source of truth here: the database
    // only learns about a paid checkout when its webhook arrives.
    if (await hasLiveSubscription(stripe, user, customerId, mode)) {
      throw new UserFacingError(ALREADY_SUBSCRIBED_MESSAGE);
    }

    const { reusable, openIds } = await resolveOpenCheckouts(
      stripe,
      customerId,
      parsedInput.plan,
      parsedInput.interval,
    );
    if (reusable) {
      return { url: checkoutUrl(reusable) };
    }

    // Requests within the same minute that saw the same open checkouts (a
    // double click, two tabs) get the same session back instead of two
    // payable ones. The open checkouts are part of the key so that returning
    // to a plan whose checkout was just expired creates a fresh session
    // instead of Stripe replaying the expired one.
    const minute = Math.floor(Date.now() / 60_000).toString();
    const checkout = await stripe.checkout.sessions.create(
      {
        payment_method_types: ["card"],
        mode: "subscription",
        customer: customerId,
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel?assinatura=confirmada`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/assinatura`,
        metadata: { plan: parsedInput.plan, interval: parsedInput.interval },
        subscription_data: {
          metadata: {
            userId: user.id,
          },
        },
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
      },
      {
        idempotencyKey: idempotencyKey(
          "checkout",
          customerId,
          priceId,
          minute,
          ...[...openIds].sort(),
        ),
      },
    );
    return { url: checkoutUrl(checkout) };
  });
