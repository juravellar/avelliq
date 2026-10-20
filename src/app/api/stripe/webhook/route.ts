import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  stripeClient,
  stripeSecretKey,
  stripeWebhookSecret,
} from "@/lib/stripe-client";
import type { StripeMode } from "@/lib/stripe-mode";
import { syncSubscription } from "@/lib/stripe-subscription-sync";

interface InvoiceParent {
  subscription_details?: {
    subscription?: string | { id: string };
  };
}

interface LineParent {
  subscription_item_details?: {
    subscription?: string;
  };
}

const subscriptionIdOfInvoice = (invoice: Stripe.Invoice) => {
  const parent = invoice.parent as InvoiceParent | null | undefined;
  const fromParent = parent?.subscription_details?.subscription;
  if (fromParent) {
    return typeof fromParent === "string" ? fromParent : fromParent.id;
  }
  const lineParent = invoice.lines?.data[0]?.parent as LineParent | undefined;
  return lineParent?.subscription_item_details?.subscription;
};

const MODES: StripeMode[] = ["live", "test"];

// Both Stripe accounts send to this endpoint, each signing with its own
// secret; the one that verifies says which account the event is from.
const verify = (rawBody: string, signature: string) => {
  for (const mode of MODES) {
    const secret = stripeWebhookSecret(mode);
    if (!secret || !stripeSecretKey(mode)) {
      continue;
    }
    const stripe = stripeClient(mode);
    try {
      const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
      return { event, stripe, mode };
    } catch {
      // Not signed by this account; try the other one.
    }
  }
  return null;
};

export const POST = async (request: Request) => {
  if (!stripeSecretKey("live") || !stripeWebhookSecret("live")) {
    throw new Error("Stripe secret key not found");
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    throw new Error("Stripe signature not found");
  }

  const verified = verify(await request.text(), signature);
  if (!verified) {
    return NextResponse.json(
      { error: "Webhook Error: Invalid signature" },
      { status: 400 },
    );
  }
  const { event, stripe, mode } = verified;

  switch (event.type) {
    case "invoice.paid": {
      const subscriptionId = subscriptionIdOfInvoice(event.data.object);
      if (subscriptionId) {
        await syncSubscription(stripe, subscriptionId, mode);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(stripe, event.data.object.id, mode);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
};
