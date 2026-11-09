import type { patientsTable } from "@/db/schema";

// Only what the list shows; the edit dialog loads the rest (CPF, address,
// insurance, notes) when it opens.
export const PATIENT_ROW_COLUMNS = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  sex: true,
} as const;

export type PatientRow = Pick<
  typeof patientsTable.$inferSelect,
  keyof typeof PATIENT_ROW_COLUMNS
>;
