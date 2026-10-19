"use client";

import { DataTable } from "@/components/ui/data-table";
import { appointmentsTable, doctorsTable } from "@/db/schema";

import type { PatientOption } from "./patient-option";
import { createAppointmentsTableColumns } from "./table-columns";

type Appointment = typeof appointmentsTable.$inferSelect & {
  patient: PatientOption;
  doctor: {
    id: string;
    name: string;
    specialty: string;
  };
};

interface AppointmentsTableProps {
  appointments: Appointment[];
  patients: PatientOption[];
  doctors: (typeof doctorsTable.$inferSelect)[];
}

export function AppointmentsTable({
  appointments,
  patients,
  doctors,
}: AppointmentsTableProps) {
  const columns = createAppointmentsTableColumns({ patients, doctors });

  return <DataTable columns={columns} data={appointments} />;
}
