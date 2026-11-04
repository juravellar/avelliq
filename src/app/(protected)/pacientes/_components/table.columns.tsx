"use client";

import { ColumnDef } from "@tanstack/react-table";

import { formatPhone } from "@/helpers/phone";

import type { PatientRow } from "./patient-row";
import { PatientTableActions } from "./table-actions";

export const patientsTableColumns: ColumnDef<PatientRow>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Nome",
  },
  {
    id: "email",
    accessorKey: "email",
    header: "Email",
  },
  {
    id: "phoneNumber",
    accessorKey: "phoneNumber",
    header: "Telefone",
    cell: (params) => {
      return formatPhone(params.row.original.phoneNumber);
    },
  },
  {
    id: "sex",
    accessorKey: "sex",
    header: "Sexo",
    cell: (params) => {
      const patient = params.row.original;
      return patient.sex === "male" ? "Masculino" : "Feminino";
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <PatientTableActions patient={row.original} />,
  },
];
