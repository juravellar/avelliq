import { z } from "zod";

import { priceInCentsSchema } from "@/helpers/currency";

export const upsertAppointmentSchema = z.object({
  id: z.string().uuid().optional(),
  patientId: z.string().uuid({
    message: "Paciente é obrigatório.",
  }),
  doctorId: z.string().uuid({
    message: "Médico é obrigatório.",
  }),
  date: z.string().date("Data é obrigatória."), // YYYY-MM-DD
  time: z.string().min(1, {
    message: "Horário é obrigatório.",
  }),
  appointmentPriceInCents: priceInCentsSchema(
    "Valor da consulta é obrigatório.",
  ),
});
