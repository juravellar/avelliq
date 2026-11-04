"use server";

import { and, eq, gte, lt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isUniqueViolation, withClinicLock } from "@/db/clinic-lock";
import { appointmentsTable, patientsTable } from "@/db/schema";
import { priceInCentsSchema } from "@/helpers/currency";
import {
  clinicDateTimeToDate,
  clinicMonthRange,
  inClinicTimezone,
} from "@/helpers/time";
import { UserFacingError } from "@/lib/action-errors";
import { recordAudit } from "@/lib/audit";
import { computeAvailableTimes } from "@/lib/available-times";
import { clinicWriteActionClient } from "@/lib/clinic-action";
import { ensurePlanAllows } from "@/lib/plan-limits";
import { resolvePlan } from "@/lib/plans";

const SLOT_UNAVAILABLE_MESSAGE =
  "Este horário não está mais disponível. Escolha outro horário.";

export const upsertAppointment = clinicWriteActionClient
  .schema(
    z.object({
      id: z.string().uuid().optional(),
      patientId: z.string().uuid(),
      doctorId: z.string().uuid(),
      date: z.date(),
      time: z.string(),
      appointmentPriceInCents: priceInCentsSchema(
        "Valor da consulta é obrigatório.",
      ),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const clinicId = ctx.clinic.id;
    const appointmentDay = inClinicTimezone(parsedInput.date).format(
      "YYYY-MM-DD",
    );
    try {
      await withClinicLock(clinicId, async (tx) => {
        const patient = await tx.query.patientsTable.findFirst({
          where: eq(patientsTable.id, parsedInput.patientId),
        });
        if (!patient || patient.clinicId !== clinicId) {
          throw new Error("Paciente não encontrado");
        }

        let storedDate: Date | null = null;
        if (parsedInput.id) {
          const appointment = await tx.query.appointmentsTable.findFirst({
            where: eq(appointmentsTable.id, parsedInput.id),
          });
          if (!appointment || appointment.clinicId !== clinicId) {
            throw new Error("Agendamento não encontrado");
          }
          storedDate = appointment.date;
        }

        const availableTimes = await computeAvailableTimes(tx, {
          clinicId,
          doctorId: parsedInput.doctorId,
          date: appointmentDay,
          ignoreAppointmentId: parsedInput.id,
        });
        const isTimeAvailable = availableTimes.some(
          (time) => time.value === parsedInput.time && time.available,
        );
        if (!isTimeAvailable) {
          throw new UserFacingError(SLOT_UNAVAILABLE_MESSAGE);
        }

        const appointmentDate = clinicDateTimeToDate(
          appointmentDay,
          parsedInput.time,
        );

        // Creating, or moving an appointment into another month, adds one to
        // that month's count. An edit inside the same month changes nothing.
        const { start, end } = clinicMonthRange(appointmentDay);
        const isSameMonth =
          storedDate !== null && storedDate >= start && storedDate < end;
        if (!isSameMonth) {
          const appointmentsInMonth = await tx.$count(
            appointmentsTable,
            and(
              eq(appointmentsTable.clinicId, clinicId),
              gte(appointmentsTable.date, start),
              lt(appointmentsTable.date, end),
              parsedInput.id
                ? ne(appointmentsTable.id, parsedInput.id)
                : undefined,
            ),
          );
          ensurePlanAllows(
            resolvePlan(ctx.user.plan),
            "appointmentsPerMonth",
            appointmentsInMonth,
          );
        }

        if (parsedInput.id) {
          await tx
            .update(appointmentsTable)
            .set({
              patientId: parsedInput.patientId,
              doctorId: parsedInput.doctorId,
              date: appointmentDate,
              appointmentPriceInCents: parsedInput.appointmentPriceInCents,
            })
            .where(eq(appointmentsTable.id, parsedInput.id));
          await recordAudit(
            {
              userId: ctx.user.id,
              clinicId,
              action: "appointment.updated",
              entityId: parsedInput.id,
            },
            tx,
          );
          return;
        }

        const [created] = await tx
          .insert(appointmentsTable)
          .values({
            patientId: parsedInput.patientId,
            doctorId: parsedInput.doctorId,
            date: appointmentDate,
            appointmentPriceInCents: parsedInput.appointmentPriceInCents,
            clinicId,
          })
          .returning({ id: appointmentsTable.id });
        await recordAudit(
          {
            userId: ctx.user.id,
            clinicId,
            action: "appointment.created",
            entityId: created?.id,
          },
          tx,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UserFacingError(SLOT_UNAVAILABLE_MESSAGE);
      }
      throw error;
    }

    revalidatePath("/agendamentos");
  });
