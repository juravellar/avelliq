"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { UserFacingError } from "@/lib/action-errors";
import { type AuditAction, recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { actionClient } from "@/lib/next-safe-action";
import { findAccount } from "@/lib/support/accounts";
import {
  isSupportOwner,
  rolesManagedBy,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/support/admin";

const AUDIT_ACTIONS: Record<StaffRole, AuditAction> = {
  support: "staff.support-granted",
  admin: "staff.admin-granted",
};

// Puts an account on Avelliq's team (Suporte or Admin) or takes it off.
// Owners (SUPPORT_ADMIN_EMAILS) choose both; admins only choose Suporte and
// can't change another admin.
export const setStaffRole = actionClient
  .schema(
    z.object({
      userId: z.string().min(1),
      role: z.enum(STAFF_ROLES).nullable(),
    }),
  )
  .action(async ({ parsedInput }) => {
    const session = await auth.api.getSession({ headers: await headers() });
    const managed = rolesManagedBy(session?.user);
    if (managed.length === 0) {
      throw new UserFacingError("Acesso negado.");
    }
    const account = await findAccount(parsedInput.userId);
    if (!account) {
      throw new UserFacingError("Conta não encontrada.");
    }
    if (isSupportOwner(account)) {
      throw new UserFacingError(
        "Esta é uma conta principal (SUPPORT_ADMIN_EMAILS) e sempre tem acesso.",
      );
    }
    const current = account.staffRole;
    if (
      (current && !managed.includes(current)) ||
      (parsedInput.role && !managed.includes(parsedInput.role))
    ) {
      throw new UserFacingError("Só uma conta principal escolhe os admins.");
    }
    if (parsedInput.role && !account.emailVerified) {
      throw new UserFacingError(
        "A pessoa precisa confirmar o e-mail da conta antes de entrar na equipe.",
      );
    }

    // A second click from an old page changes nothing and isn't audited.
    if (current === parsedInput.role) {
      return { role: parsedInput.role };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({ staffRole: parsedInput.role, updatedAt: new Date() })
        .where(eq(usersTable.id, account.id));
      await recordAudit(
        {
          userId: session!.user.id,
          clinicId: null,
          action: parsedInput.role
            ? AUDIT_ACTIONS[parsedInput.role]
            : "staff.removed",
          entityId: account.id,
        },
        tx,
      );
    });
    revalidatePath("/contas");
    return { role: parsedInput.role };
  });
