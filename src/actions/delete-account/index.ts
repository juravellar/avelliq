"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { UserFacingError } from "@/lib/action-errors";
import { BillingNotCancelledError, removeAccount } from "@/lib/remove-account";
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

    try {
      await removeAccount(user, null);
    } catch (error) {
      if (error instanceof BillingNotCancelledError) {
        throw new UserFacingError(
          "Não foi possível cancelar sua assinatura agora, então nada foi excluído. Tente de novo em alguns minutos ou fale com o suporte.",
        );
      }
      throw error;
    }
  });
