import { withUserLock } from "@/db/clinic-lock";
import type { usersTable } from "@/db/schema";
import {
  cancelBillableSubscriptions,
  deleteAccountData,
} from "@/lib/account-data";
import { recordAudit } from "@/lib/audit";
import { stripeSecretKey } from "@/lib/stripe-client";

export class BillingNotCancelledError extends Error {
  constructor() {
    super("Subscription not cancelled");
  }
}

/**
 * Deletes an account for good, by the person themselves or by an owner
 * (`deletedBy`). Billing stops before any data is deleted: if Stripe fails,
 * the account stays as it was instead of being gone while still charging.
 */
export const removeAccount = async (
  user: typeof usersTable.$inferSelect,
  deletedBy: string | null,
) => {
  if (user.stripeCustomerId || user.stripeTestCustomerId) {
    try {
      if (user.stripeCustomerId) {
        await cancelBillableSubscriptions(user.stripeCustomerId);
      }
      // A QA account's test subscriptions charge nobody, but are cleaned up
      // too when the test account is still configured.
      if (user.stripeTestCustomerId && stripeSecretKey("test")) {
        await cancelBillableSubscriptions(user.stripeTestCustomerId, "test");
      }
    } catch {
      throw new BillingNotCancelledError();
    }
  }
  await withUserLock(user.id, async (tx) => {
    await deleteAccountData(tx, user.id);
    // Only opaque ids: the deleted account's and whoever deleted it.
    await recordAudit(
      {
        userId: deletedBy,
        clinicId: null,
        action: deletedBy ? "account.deleted-by-staff" : "account.deleted",
        entityId: user.id,
      },
      tx,
    );
  });
};
