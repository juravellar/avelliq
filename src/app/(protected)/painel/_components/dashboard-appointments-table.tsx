"use client";

import { DataTable } from "@/components/ui/data-table";
import { appointmentsTable, doctorsTable } from "@/db/schema";

import type { PatientOption } from "../../agendamentos/_components/patient-option";
import { createAppointmentsTableColumns } from "../../agendamentos/_components/table-columns";

export type AppointmentWithRelations = typeof appointmentsTable.$inferSelect & {
  patient: PatientOption;
  doctor: typeof doctorsTable.$inferSelect;
};

interface DashboardAppointmentsTableProps {
  appointments: AppointmentWithRelations[];
  patients: PatientOption[];
  doctors: (typeof doctorsTable.$inferSelect)[];
}

export default function DashboardAppointmentsTable({
  appointments,
  patients,
  doctors,
}: DashboardAppointmentsTableProps) {
  const columns = createAppointmentsTableColumns({
    patients,
    doctors,
  });

  return <DataTable columns={columns} data={appointments} />;
}
