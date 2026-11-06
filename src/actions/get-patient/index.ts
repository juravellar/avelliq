"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { patientsTable } from "@/db/schema";
import { UserFacingError } from "@/lib/action-errors";
import { clinicActionClient } from "@/lib/clinic-action";

// The full record for the edit dialog. The list only carries a few columns,
// so the rest is read when the dialog opens. Reading stays allowed on a
// read-only Free clinic.
export const getPatient = clinicActionClient
  .schema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const patient = await db.query.patientsTable.findFirst({
      where: eq(patientsTable.id, parsedInput.id),
    });
    if (!patient || patient.clinicId !== ctx.clinic.id) {
      throw new UserFacingError("Paciente não encontrado. Atualize a página.");
    }
    return patient;
  });
