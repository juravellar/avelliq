"use client";

import { EditIcon, MoreVerticalIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { deletePatient } from "@/actions/delete-patient";
import { getPatient } from "@/actions/get-patient";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { patientsTable } from "@/db/schema";
import { actionErrorMessage } from "@/lib/action-errors";

import type { PatientRow } from "./patient-row";
import UpsertPatientForm from "./upsert-patient-form";

type Patient = typeof patientsTable.$inferSelect;

interface PatientTableActionsProps {
  patient: PatientRow;
}

export function PatientTableActions({ patient }: PatientTableActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // The list only has a few columns; the full record is read on each open, so
  // the form never shows stale data.
  const [fullPatient, setFullPatient] = useState<Patient | null>(null);

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (!open) return;
    setFullPatient(null);
    try {
      const result = await getPatient({ id: patient.id });
      if (!result?.data) {
        toast.error(
          actionErrorMessage(result ?? {}, "Erro ao carregar paciente."),
        );
        setIsOpen(false);
        return;
      }
      setFullPatient(result.data);
    } catch {
      toast.error("Erro ao carregar paciente.");
      setIsOpen(false);
    }
  };

  const handleDeletePatientClick = async () => {
    setIsDeleting(true);
    try {
      const result = await deletePatient({ id: patient.id });
      if (result?.serverError || result?.validationErrors) {
        toast.error(actionErrorMessage(result, "Erro ao deletar paciente."));
        return;
      }
      toast.success("Paciente deletado com sucesso.");
    } catch {
      toast.error("Erro ao deletar paciente.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVerticalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{patient.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <EditIcon className="text-foreground mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          </DialogTrigger>
          {fullPatient ? (
            <UpsertPatientForm
              patient={fullPatient}
              onSuccess={() => setIsOpen(false)}
              isOpen={isOpen}
            />
          ) : (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{patient.name}</DialogTitle>
                <DialogDescription>Carregando paciente...</DialogDescription>
              </DialogHeader>
            </DialogContent>
          )}
        </Dialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              className="focus:bg-destructive/10 focus:text-destructive"
              onSelect={(e) => e.preventDefault()}
            >
              <TrashIcon className="focus:text-destructive mr-2 h-4 w-4" />
              Deletar
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Tem certeza que deseja deletar esse paciente?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação não pode ser desfeita. Isso irá deletar o paciente e
                todas as consultas agendadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogTrigger asChild>
                <Button
                  onClick={handleDeletePatientClick}
                  variant="outline"
                  disabled={isDeleting}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {isDeleting ? "Deletando..." : "Deletar"}
                </Button>
              </AlertDialogTrigger>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
