import { db } from "@/db";
import type { Transaction } from "@/db/clinic-lock";
import { auditLogsTable } from "@/db/schema";

export type AuditAction =
  | "clinic.created"
  | "clinic.updated"
  | "doctor.created"
  | "doctor.updated"
  | "doctor.deleted"
  | "patient.created"
  | "patient.updated"
  | "patient.deleted"
  | "appointment.created"
  | "appointment.updated"
  | "appointment.deleted"
  | "account.exported"
  | "account.deleted"
  | "support-admin.granted"
  | "support-admin.revoked";

export interface AuditEntry {
  userId: string | null;
  clinicId: string | null;
  action: AuditAction;
  // The affected record's id. Never a name, email or other personal data.
  entityId?: string | null;
}

// Inside a transaction, pass it, so the record and the change commit together.
export const recordAudit = (
  entry: AuditEntry,
  executor: typeof db | Transaction = db,
) => executor.insert(auditLogsTable).values(entry);
