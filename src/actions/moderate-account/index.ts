"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { sessionsTable, usersTable } from "@/db/schema";
import { deletionPreview } from "@/lib/account-data";
import { UserFacingError } from "@/lib/action-errors";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { isFreshSession } from "@/lib/fresh-session";
import { actionClient } from "@/lib/next-safe-action";
import { BillingNotCancelledError, removeAccount } from "@/lib/remove-account";
import { findAccount } from "@/lib/support/accounts";
import {
  canBlock,
  canDeleteAccount,
  canRequestDeletion,
  isSupportOwner,
  MODERATION_REASON_IDS,
} from "@/lib/support/admin";

const accountInput = z.object({ userId: z.string().min(1) });
const reasonInput = accountInput.extend({
  reason: z.enum(MODERATION_REASON_IDS),
});

// The signed-in team member and the account they act on, once `allowed`
// says they may.
const load = async (
  userId: string,
  allowed: (
    viewer: NonNullable<
      Awaited<ReturnType<typeof auth.api.getSession>>
    >["user"],
    account: NonNullable<Awaited<ReturnType<typeof findAccount>>>,
  ) => boolean,
) => {
  const session = await auth.api.getSession({ headers: await headers() });
  const account = await findAccount(userId);
  if (!session?.user || !account) {
    throw new UserFacingError("Conta não encontrada.");
  }
  if (!allowed(session.user, account)) {
    throw new UserFacingError("Acesso negado.");
  }
  return { viewer: session.user, session: session.session, account };
};

const done = () => revalidatePath("/contas");

// Blocks an account: its sessions end now and it can't sign in again until
// unblocked. Owners and admins (see canBlock).
export const blockAccount = actionClient
  .schema(reasonInput)
  .action(async ({ parsedInput }) => {
    const { viewer, account } = await load(parsedInput.userId, canBlock);
    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({
          blockedAt: new Date(),
          blockedReason: parsedInput.reason,
          blockedBy: viewer.id,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, account.id));
      await tx
        .delete(sessionsTable)
        .where(eq(sessionsTable.userId, account.id));
      await recordAudit(
        {
          userId: viewer.id,
          clinicId: null,
          action: "account.blocked",
          entityId: account.id,
        },
        tx,
      );
    });
    done();
  });

export const unblockAccount = actionClient
  .schema(accountInput)
  .action(async ({ parsedInput }) => {
    const { viewer, account } = await load(parsedInput.userId, canBlock);
    // An admin can't undo a block an owner put on. blockedBy is a user id, so
    // the blocker is looked up to see whether they are an owner.
    if (account.blockedBy && !isSupportOwner(viewer)) {
      const blocker = await findAccount(account.blockedBy);
      if (isSupportOwner(blocker)) {
        throw new UserFacingError(
          "Só uma conta principal desbloqueia uma conta bloqueada por outra conta principal.",
        );
      }
    }
    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({
          blockedAt: null,
          blockedReason: null,
          blockedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, account.id));
      await recordAudit(
        {
          userId: viewer.id,
          clinicId: null,
          action: "account.unblocked",
          entityId: account.id,
        },
        tx,
      );
    });
    done();
  });

// An admin's request for an owner to delete the account.
export const requestAccountDeletion = actionClient
  .schema(reasonInput)
  .action(async ({ parsedInput }) => {
    const { viewer, account } = await load(
      parsedInput.userId,
      canRequestDeletion,
    );
    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({
          deletionRequestedAt: new Date(),
          deletionRequestReason: parsedInput.reason,
          deletionRequestedBy: viewer.id,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, account.id));
      await recordAudit(
        {
          userId: viewer.id,
          clinicId: null,
          action: "account.deletion-requested",
          entityId: account.id,
        },
        tx,
      );
    });
    done();
  });

// Owners turn a request down; admins withdraw their own.
export const cancelDeletionRequest = actionClient
  .schema(accountInput)
  .action(async ({ parsedInput }) => {
    const { viewer, account } = await load(
      parsedInput.userId,
      (viewer, account) =>
        canDeleteAccount(viewer, account) ||
        (canRequestDeletion(viewer, account) &&
          account.deletionRequestedBy === viewer.id),
    );
    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({
          deletionRequestedAt: null,
          deletionRequestReason: null,
          deletionRequestedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, account.id));
      await recordAudit(
        {
          userId: viewer.id,
          clinicId: null,
          action: "account.deletion-request-cancelled",
          entityId: account.id,
        },
        tx,
      );
    });
    done();
  });

// What deleting takes with it, for the owner's confirmation.
export const getDeletionPreview = actionClient
  .schema(accountInput)
  .action(async ({ parsedInput }) => {
    const { account } = await load(parsedInput.userId, canDeleteAccount);
    return {
      email: account.email,
      subscribed: Boolean(account.stripeSubscriptionId),
      ...(await deletionPreview(account.id)),
    };
  });

// Owners only, after typing the account's e-mail. It takes the path of
// deleting one's own account, so billing stops before any data goes.
export const deleteAccountAsOwner = actionClient
  .schema(accountInput.extend({ confirmEmail: z.string() }))
  .action(async ({ parsedInput }) => {
    const { viewer, session, account } = await load(
      parsedInput.userId,
      canDeleteAccount,
    );
    if (!isFreshSession(session)) {
      throw new UserFacingError(
        "Por segurança, saia e entre de novo para fazer esta ação.",
      );
    }
    if (
      parsedInput.confirmEmail.trim().toLowerCase() !==
      account.email.toLowerCase()
    ) {
      throw new UserFacingError(
        "O e-mail digitado não confere com o da conta.",
      );
    }
    if (isSupportOwner(account)) {
      throw new UserFacingError("Contas principais não podem ser excluídas.");
    }
    try {
      await removeAccount(account, viewer.id);
    } catch (error) {
      if (error instanceof BillingNotCancelledError) {
        throw new UserFacingError(
          "Não foi possível cancelar a assinatura desta conta no Stripe, então nada foi excluído. Tente de novo em alguns minutos.",
        );
      }
      throw error;
    }
    done();
  });
