import { z } from "zod";

import { BRAZILIAN_STATES, onlyDigits } from "@/helpers/cpf";
import { priceInCentsSchema } from "@/helpers/currency";
import { isValidPhone } from "@/helpers/phone";

// Shared with the client form, whose fields have a different shape.
export const timeRangeRule = {
  isValid: (from: string, to: string) => from < to,
  message: "O horário de término deve ser posterior ao horário de início.",
};

export const MAX_HEALTH_INSURANCES = 30;
export const DOCTOR_NAME_MAX = 120;
export const EMAIL_MAX = 254;

// Plans offered as suggestions while typing; any other can still be typed.
// National ones first, then the doctor's state's own (state public-servant
// plans and strong regional operators), so a doctor in GO sees Ipasgo.
const NATIONAL_HEALTH_INSURANCES = [
  "Allianz Saúde",
  "Amil",
  "Bradesco Saúde",
  "Care Plus",
  "Cassi",
  "Geap",
  "Golden Cross",
  "Hapvida",
  "Mediservice",
  "NotreDame Intermédica",
  "Omint",
  "Porto Saúde",
  "Postal Saúde",
  "Prevent Senior",
  "Saúde Caixa",
  "SulAmérica",
  "Unimed",
];

const REGIONAL_HEALTH_INSURANCES: Record<string, string[]> = {
  AL: ["Ipaseal Saúde"],
  BA: ["Planserv"],
  CE: ["Issec"],
  DF: ["GDF Saúde (Inas)"],
  GO: ["Ipasgo Saúde"],
  MG: ["IPSEMG", "Cemig Saúde"],
  MS: ["Cassems"],
  MT: ["MT Saúde"],
  PA: ["Iasep"],
  PE: ["Sassepe"],
  PI: ["Iapep Saúde"],
  PR: ["Clinipam", "Paraná Clínicas"],
  RJ: ["Assim Saúde", "Leve Saúde"],
  RS: ["IPE Saúde", "Cabergs"],
  SC: ["SC Saúde"],
  SE: ["Ipes Saúde"],
  SP: ["Iamspe", "Cabesp"],
  TO: ["Plansaúde"],
};

// The suggestions for a doctor registered in `state` (the CRM's UF): the
// state's own plans first, since those are the ones people look for.
export const healthInsuranceSuggestions = (state?: string | null) => [
  ...(state ? (REGIONAL_HEALTH_INSURANCES[state] ?? []) : []),
  ...NATIONAL_HEALTH_INSURANCES,
];

// The professional and contact details, all optional so doctors saved before
// they existed stay valid. Shared by the form and the server action.
export const doctorDetailsSchema = z.object({
  crmNumber: z
    .string()
    .optional()
    .refine((value) => !value || /^\d{4,7}$/.test(onlyDigits(value)), {
      message: "CRM inválido: use de 4 a 7 números.",
    }),
  crmState: z
    .string()
    .optional()
    .refine(
      (value) =>
        !value || (BRAZILIAN_STATES as readonly string[]).includes(value),
      { message: "UF inválida." },
    ),
  rqe: z
    .string()
    .optional()
    .refine((value) => !value || /^\d{1,10}$/.test(onlyDigits(value)), {
      message: "RQE inválido.",
    }),
  phoneNumber: z
    .string()
    .optional()
    .refine((value) => !value || isValidPhone(value), {
      message: "Telefone inválido.",
    }),
  email: z
    .string()
    .trim()
    .max(EMAIL_MAX, { message: "E-mail muito longo." })
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "E-mail inválido.",
    }),
  acceptsPrivate: z.boolean().default(true),
  healthInsurances: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(60, { message: "Use até 60 caracteres por convênio." }),
    )
    .max(MAX_HEALTH_INSURANCES, {
      message: `Informe até ${MAX_HEALTH_INSURANCES} convênios.`,
    })
    .default([]),
});

type DoctorDetails = z.output<typeof doctorDetailsSchema>;

// Rules across fields, for the form and the action alike.
export const doctorDetailsProblems = (details: DoctorDetails) => {
  const problems: { path: keyof DoctorDetails; message: string }[] = [];
  if (Boolean(details.crmNumber) !== Boolean(details.crmState)) {
    problems.push({
      path: details.crmNumber ? "crmState" : "crmNumber",
      message: "Informe o número e a UF do CRM.",
    });
  }
  if (!details.acceptsPrivate && details.healthInsurances.length === 0) {
    problems.push({
      path: "healthInsurances",
      message: "Informe os convênios aceitos ou marque que atende particular.",
    });
  }
  return problems;
};

export const upsertDoctorSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z
      .string()
      .trim()
      .min(1, {
        message: "Nome é obrigatório.",
      })
      .max(DOCTOR_NAME_MAX, {
        message: `Use até ${DOCTOR_NAME_MAX} caracteres.`,
      }),
    specialty: z.string().trim().min(1, {
      message: "Especialidade é obrigatória.",
    }),
    appointmentPriceInCents: priceInCentsSchema(
      "Preço da consulta é obrigatório.",
    ),
    availableFromWeekDay: z.number().min(0).max(6),
    availableToWeekDay: z.number().min(0).max(6),
    availableFromTime: z.string().min(1, {
      message: "Hora de início é obrigatória.",
    }),
    availableToTime: z.string().min(1, {
      message: "Hora de término é obrigatória.",
    }),
  })
  .merge(doctorDetailsSchema)
  .superRefine((data, ctx) => {
    if (!timeRangeRule.isValid(data.availableFromTime, data.availableToTime)) {
      ctx.addIssue({
        code: "custom",
        message: timeRangeRule.message,
        path: ["availableToTime"],
      });
    }
    for (const problem of doctorDetailsProblems(data)) {
      ctx.addIssue({
        code: "custom",
        message: problem.message,
        path: [problem.path],
      });
    }
  });

export type UpsertDoctorSchema = z.infer<typeof upsertDoctorSchema>;

const orNull = (value: string | undefined) => value?.trim() || null;
const digitsOrNull = (value: string | undefined) =>
  value ? onlyDigits(value) || null : null;

// The columns to store: empty fields become null, CRM, RQE and phone keep
// only their digits, and repeated plans are dropped.
export const doctorDetailColumns = (details: DoctorDetails) => ({
  crmNumber: digitsOrNull(details.crmNumber),
  crmState: orNull(details.crmState),
  rqe: digitsOrNull(details.rqe),
  phoneNumber: digitsOrNull(details.phoneNumber),
  email: orNull(details.email)?.toLowerCase() ?? null,
  acceptsPrivate: details.acceptsPrivate,
  healthInsurances: details.healthInsurances
    .map((name) => name.trim())
    .filter(
      (name, index, names) =>
        name &&
        names.findIndex(
          (other) =>
            other.toLocaleLowerCase("pt-BR") ===
            name.toLocaleLowerCase("pt-BR"),
        ) === index,
    ),
});
