"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { withUserLock } from "@/db/clinic-lock";
import { usersTable } from "@/db/schema";
import {
  cancelBillableSubscriptions,
  deleteAccountData,
} from "@/lib/account-data";
import { UserFacingError } from "@/lib/action-errors";
import { recordAudit } from "@/lib/audit";
import { stripeSecretKey } from "@/lib/stripe-client";
import { userActionClient } from "@/lib/user-action";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const deleteAccount = userActionClient
  .schema(z.object({ confirmEmail: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    if (
      normalizeEmail(parsedInput.confirmEmail) !==
      normalizeEmail(ctx.user.email)
    ) {
      throw new UserFacingError("O email digitado não confere com o da conta.");
    }
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, ctx.user.id),
    });
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Billing stops before any data is deleted: if Stripe fails, the account
    // stays as it was instead of being gone while still charging.
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
        throw new UserFacingError(
          "Não foi possível cancelar sua assinatura agora, então nada foi excluído. Tente de novo em alguns minutos ou fale com o suporte.",
        );
      }
    }

    await withUserLock(user.id, async (tx) => {
      await deleteAccountData(tx, user.id);
      // Only the account's opaque id, to show when it was deleted.
      await recordAudit(
        {
          userId: null,
          clinicId: null,
          action: "account.deleted",
          entityId: user.id,
        },
        tx,
      );
    });
  });
