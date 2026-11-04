"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { violatedConstraint, withClinicLock } from "@/db/clinic-lock";
import { patientsTable } from "@/db/schema";
import { isAcceptablePhone } from "@/helpers/phone";
import { UserFacingError } from "@/lib/action-errors";
import { recordAudit } from "@/lib/audit";
import { clinicWriteActionClient } from "@/lib/clinic-action";
import { ensurePlanAllows } from "@/lib/plan-limits";
import { resolvePlan } from "@/lib/plans";

import {
  INVALID_PHONE_MESSAGE,
  patientColumns,
  upsertPatientSchema,
} from "./schema";

export const upsertPatient = clinicWriteActionClient
  .schema(upsertPatientSchema)
  .action(async ({ parsedInput, ctx }) => {
    const clinicId = ctx.clinic.id;
    const { id, ...input } = parsedInput;
    const columns = patientColumns(input);
    try {
      await withClinicLock(clinicId, async (tx) => {
        const existingPatient = parsedInput.id
          ? await tx.query.patientsTable.findFirst({
              where: eq(patientsTable.id, parsedInput.id),
            })
          : undefined;
        if (existingPatient && existingPatient.clinicId !== clinicId) {
          throw new Error("Paciente não encontrado");
        }
        // Deleted in the meantime: saving must not bring it back with the
        // client's id.
        if (parsedInput.id && !existingPatient) {
          throw new UserFacingError(
            "Paciente não encontrado. Atualize a página.",
          );
        }
        if (
          !isAcceptablePhone(input.phoneNumber, existingPatient?.phoneNumber)
        ) {
          throw new UserFacingError(INVALID_PHONE_MESSAGE);
        }
        if (!existingPatient) {
          const patientCount = await tx.$count(
            patientsTable,
            eq(patientsTable.clinicId, clinicId),
          );
          ensurePlanAllows(
            resolvePlan(ctx.user.plan),
            "patients",
            patientCount,
          );
        }

        const [saved] = await tx
          .insert(patientsTable)
          .values({ ...columns, id, clinicId })
          .onConflictDoUpdate({
            target: [patientsTable.id],
            setWhere: eq(patientsTable.clinicId, clinicId),
            set: columns,
          })
          .returning({ id: patientsTable.id });
        await recordAudit(
          {
            userId: ctx.user.id,
            clinicId,
            action: existingPatient ? "patient.updated" : "patient.created",
            entityId: saved?.id,
          },
          tx,
        );
      });
    } catch (error) {
      if (violatedConstraint(error) === "patients_clinic_cpf_unique") {
        throw new UserFacingError(
          "Já existe um paciente com este CPF nesta clínica.",
        );
      }
      throw error;
    }
    revalidatePath("/pacientes");
  });
