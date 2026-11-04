"use server";

import { and, eq, inArray, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withUserLock } from "@/db/clinic-lock";
import { usersTable, usersToClinicsTable } from "@/db/schema";
import { inClinicTimezone } from "@/helpers/time";
import { UserFacingError } from "@/lib/action-errors";
import { clinicChoiceStatus } from "@/lib/clinic-access";
import { clinicActionClient } from "@/lib/clinic-action";

const supportContact = () =>
  process.env.SUPPORT_EMAIL
    ? ` (${process.env.SUPPORT_EMAIL})`
    : "";

export const chooseClinics = clinicActionClient
  .schema(z.object({ clinicIds: z.array(z.string().uuid()).min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const { clinicLimit, overClinicLimit, clinics } = ctx.user;
    const chosen = [...new Set(parsedInput.clinicIds)];
    if (!overClinicLimit || clinicLimit === null) {
      throw new UserFacingError(
        "Seu plano já permite usar todas as suas clínicas.",
      );
    }
    // Exactly the plan's limit: with fewer, the free slots would go to the
    // oldest clinics, which isn't what the user confirmed.
    if (chosen.length !== clinicLimit) {
      throw new UserFacingError(
        `Escolha ${clinicLimit} ${clinicLimit === 1 ? "clínica" : "clínicas"}, o limite do seu plano.`,
      );
    }
    if (!chosen.every((id) => clinics.some((clinic) => clinic.id === id))) {
      throw new Error("Clínica não encontrada");
    }

    await withUserLock(ctx.user.id, async (tx) => {
      const user = await tx.query.usersTable.findFirst({
        where: eq(usersTable.id, ctx.user.id),
      });
      if (!user) {
        throw new Error("Unauthorized");
      }
      const status = clinicChoiceStatus(
        user.clinicChoiceMadeAt,
        user.clinicChoiceChangedAt,
      );
      if (!status.allowed && status.nextChangeAt) {
        throw new UserFacingError(
          `Você já alterou as clínicas ativas recentemente. A próxima alteração fica liberada em ${inClinicTimezone(status.nextChangeAt).format("DD/MM/YYYY")}. Para mudar antes, fale com o suporte${supportContact()}.`,
        );
      }
      const now = new Date();
      await tx
        .update(usersToClinicsTable)
        .set({ keptInPlan: true })
        .where(
          and(
            eq(usersToClinicsTable.userId, user.id),
            inArray(usersToClinicsTable.clinicId, chosen),
          ),
        );
      await tx
        .update(usersToClinicsTable)
        .set({ keptInPlan: false })
        .where(
          and(
            eq(usersToClinicsTable.userId, user.id),
            not(inArray(usersToClinicsTable.clinicId, chosen)),
          ),
        );
      await tx
        .update(usersTable)
        .set(
          user.clinicChoiceMadeAt
            ? { clinicChoiceChangedAt: now }
            : { clinicChoiceMadeAt: now },
        )
        .where(eq(usersTable.id, user.id));
    });
    revalidatePath("/", "layout");
  });
