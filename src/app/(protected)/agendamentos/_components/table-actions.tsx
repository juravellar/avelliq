"use client";

import { EditIcon, MoreVerticalIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { deleteAppointment } from "@/actions/delete-appointment";
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
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { appointmentsTable, doctorsTable } from "@/db/schema";

import UpsertAppointmentForm from "./add-appointment-form";
import type { PatientOption } from "./patient-option";

type Appointment = typeof appointmentsTable.$inferSelect & {
  patient: { name: string };
  doctor: { name: string };
};

interface AppointmentTableActionsProps {
  appointment: Appointment;
  patients: PatientOption[];
  doctors: (typeof doctorsTable.$inferSelect)[];
}

export function AppointmentsTableActions({
  patients,
  doctors,
  appointment,
}: AppointmentTableActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAppointmentClick = async () => {
    setIsDeleting(true);
    try {
      await deleteAppointment({ id: appointment.id });
      toast.success("Agendamento deletado com sucesso.");
    } catch {
      toast.error("Erro ao deletar agendamento.");
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
        <DropdownMenuLabel>Agendamento</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <EditIcon className="text-foreground mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          </DialogTrigger>
          <UpsertAppointmentForm
            appointment={appointment}
            onSuccess={() => setIsOpen(false)}
            isOpen={isOpen}
            patients={patients}
            doctors={doctors}
          />
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
                Tem certeza que deseja deletar esse agendamento?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação não pode ser desfeita. Isso irá deletar o agendamento
                permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogTrigger asChild>
                <Button
                  onClick={handleDeleteAppointmentClick}
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
