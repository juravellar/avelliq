"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { isUniqueViolation, withClinicLock } from "@/db/clinic-lock";
import { doctorsTable } from "@/db/schema";
import { clinicTimeToUtc } from "@/helpers/time";
import { UserFacingError } from "@/lib/action-errors";
import { recordAudit } from "@/lib/audit";
import { clinicWriteActionClient } from "@/lib/clinic-action";
import { ensurePlanAllows } from "@/lib/plan-limits";
import { resolvePlan } from "@/lib/plans";

import { doctorDetailColumns, upsertDoctorSchema } from "./schema";

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
      if (!existingDoctor) {
        const doctorCount = await tx.$count(
          doctorsTable,
          eq(doctorsTable.clinicId, clinicId),
        );
        ensurePlanAllows(resolvePlan(ctx.user.plan), "doctors", doctorCount);
      }

      const columns = {
        name: parsedInput.name,
        specialty: parsedInput.specialty,
        appointmentPriceInCents: parsedInput.appointmentPriceInCents,
        availableFromWeekDay: parsedInput.availableFromWeekDay,
        availableToWeekDay: parsedInput.availableToWeekDay,
        availableFromTime: clinicTimeToUtc(parsedInput.availableFromTime),
        availableToTime: clinicTimeToUtc(parsedInput.availableToTime),
        ...doctorDetailColumns(parsedInput),
      };

      const [saved] = await tx
        .insert(doctorsTable)
        .values({ ...columns, id: parsedInput.id, clinicId })
        .onConflictDoUpdate({
          target: [doctorsTable.id],
          setWhere: eq(doctorsTable.clinicId, clinicId),
          set: columns,
        })
        .returning({ id: doctorsTable.id })
        .catch((error) => {
          // doctors_clinic_crm_unique: another doctor of the clinic has it.
          if (isUniqueViolation(error)) {
            throw new UserFacingError(
              "Já existe um médico com este CRM nesta clínica.",
            );
          }
          throw error;
        });
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
