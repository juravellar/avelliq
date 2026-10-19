"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { UserFacingError } from "@/lib/action-errors";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { actionClient } from "@/lib/next-safe-action";
import { findAccount } from "@/lib/support/accounts";
import { isOwnerEmail, isSupportOwner } from "@/lib/support/admin";

// Gives or takes away access to the support inbox. Only owners
// (SUPPORT_ADMIN_EMAILS) choose the admins; owners themselves are always in.
export const setSupportAdmin = actionClient
  .schema(z.object({ userId: z.string().min(1), admin: z.boolean() }))
  .action(async ({ parsedInput }) => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!isSupportOwner(session?.user)) {
      throw new UserFacingError("Acesso negado.");
    }
    const account = await findAccount(parsedInput.userId);
    if (!account) {
      throw new UserFacingError("Conta não encontrada.");
    }
    if (isOwnerEmail(account.email)) {
      throw new UserFacingError(
        "Esta é uma conta principal (SUPPORT_ADMIN_EMAILS) e sempre tem acesso.",
      );
    }
    if (parsedInput.admin && !account.emailVerified) {
      throw new UserFacingError(
        "A pessoa precisa confirmar o e-mail da conta antes de virar admin.",
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({ supportAdmin: parsedInput.admin, updatedAt: new Date() })
        .where(eq(usersTable.id, account.id));
      await recordAudit(
        {
          userId: session!.user.id,
          clinicId: null,
          action: parsedInput.admin
            ? "support-admin.granted"
            : "support-admin.revoked",
          entityId: account.id,
        },
        tx,
      );
    });
    revalidatePath("/contas");
    return { admin: parsedInput.admin };
  });
