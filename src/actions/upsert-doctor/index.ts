"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withClinicLock } from "@/db/clinic-lock";
import { doctorsTable } from "@/db/schema";
import { clinicTimeToUtc } from "@/helpers/time";
import { UserFacingError } from "@/lib/action-errors";
import { recordAudit } from "@/lib/audit";
import { clinicWriteActionClient } from "@/lib/clinic-action";
import { ensurePlanAllows } from "@/lib/plan-limits";
import { resolvePlan } from "@/lib/plans";

import { upsertDoctorSchema } from "./schema";

export const upsertDoctor = clinicWriteActionClient
  .schema(upsertDoctorSchema)
  .action(async ({ parsedInput, ctx }) => {
    const clinicId = ctx.clinic.id;
    await withClinicLock(clinicId, async (tx) => {
      const existingDoctor = parsedInput.id
        ? await tx.query.doctorsTable.findFirst({
            where: eq(doctorsTable.id, parsedInput.id),
          })
        : undefined;
      if (existingDoctor && existingDoctor.clinicId !== clinicId) {
        throw new Error("Médico não encontrado");
      }
      // Deleted in the meantime: saving must not bring it back with the
      // client's id.
      if (parsedInput.id && !existingDoctor) {
        throw new UserFacingError("Médico não encontrado. Atualize a página.");
      }
      if (!existingDoctor) {
        const doctorCount = await tx.$count(
          doctorsTable,
          eq(doctorsTable.clinicId, clinicId),
        );
        ensurePlanAllows(resolvePlan(ctx.user.plan), "doctors", doctorCount);
      }

      const availableFromTime = clinicTimeToUtc(parsedInput.availableFromTime);
      const availableToTime = clinicTimeToUtc(parsedInput.availableToTime);

      const [saved] = await tx
        .insert(doctorsTable)
        .values({
          ...parsedInput,
          clinicId,
          availableFromTime,
          availableToTime,
        })
        .onConflictDoUpdate({
          target: [doctorsTable.id],
          setWhere: eq(doctorsTable.clinicId, clinicId),
          set: {
            ...parsedInput,
            availableFromTime,
            availableToTime,
          },
        })
        .returning({ id: doctorsTable.id });
      await recordAudit(
        {
          userId: ctx.user.id,
          clinicId,
          action: existingDoctor ? "doctor.updated" : "doctor.created",
          entityId: saved?.id,
        },
        tx,
      );
    });
    revalidatePath("/medicos");
  });
