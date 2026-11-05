import { z } from "zod";

import { isAcceptablePhone } from "@/helpers/phone";
import {
  BRAND_COLOR_PATTERN,
  LOGO_DATA_URL_PATTERN,
  MAX_LOGO_LENGTH,
} from "@/lib/branding";

export const CLINIC_NAME_MAX = 120;
export const CLINIC_ADDRESS_MAX = 200;

export const updateClinicSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Nome é obrigatório." })
    .max(CLINIC_NAME_MAX, {
      message: `Use até ${CLINIC_NAME_MAX} caracteres.`,
    }),
  address: z
    .string()
    .trim()
    .max(CLINIC_ADDRESS_MAX, {
      message: `Use até ${CLINIC_ADDRESS_MAX} caracteres.`,
    })
    .optional(),
  // Checked against the saved number by clinicFormSchema and the action.
  phoneNumber: z.string().trim().max(20).optional(),
  // Empty removes the color or the logo; left out, they stay as they are.
  brandColor: z
    .string()
    .optional()
    .refine((value) => !value || BRAND_COLOR_PATTERN.test(value), {
      message: "Cor inválida.",
    }),
  logoDataUrl: z
    .string()
    .max(MAX_LOGO_LENGTH, { message: "Logo muito grande." })
    .optional()
    .refine((value) => !value || LOGO_DATA_URL_PATTERN.test(value), {
      message: "Use uma imagem PNG, JPG ou WebP.",
    }),
});

export type UpdateClinicSchema = z.infer<typeof updateClinicSchema>;

export const INVALID_PHONE_MESSAGE = "Telefone inválido.";

// The form's rules: the shared ones, plus a phone that is empty, valid, or
// unchanged from the one saved.
export const clinicFormSchema = (savedPhone?: string | null) =>
  updateClinicSchema.refine(
    ({ phoneNumber }) =>
      !phoneNumber || isAcceptablePhone(phoneNumber, savedPhone),
    { message: INVALID_PHONE_MESSAGE, path: ["phoneNumber"] },
  );
