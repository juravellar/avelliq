"use client";

import {
  BadgeCheckIcon,
  CalendarIcon,
  ClockIcon,
  DollarSignIcon,
  HeartHandshakeIcon,
  TrashIcon,
} from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { deleteDoctor } from "@/actions/delete-doctor/index";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { doctorsTable } from "@/db/schema";
import { formatCurrencyInCents } from "@/helpers/currency";

import { getAvailability } from "../_helpers/availability";
import UpsertDoctorForm from "./upsert-doctor-form";

// "Unimed, Amil e mais 2", or "Sem convênios".
const insurancesLabel = (names: string[]) =>
  names.length === 0
    ? "Sem convênios"
    : names.length <= 2
      ? names.join(", ")
      : `${names.slice(0, 2).join(", ")} e mais ${names.length - 2}`;

interface DoctorCardProps {
  doctor: typeof doctorsTable.$inferSelect;
}

const DoctorCard = ({ doctor }: DoctorCardProps) => {
  const [isUpsertDoctorDialogOpen, setIsUpsertDoctorDialogOpen] =
    useState(false);
  const deleteDoctorAction = useAction(deleteDoctor, {
    onSuccess: () => {
      toast.success("Médico deletado com sucesso.");
    },
    onError: () => {
      toast.error("Erro ao deletar médico.");
    },
  });
  const handleDeleteDoctorClick = () => {
    if (!doctor) return;
    deleteDoctorAction.execute({ id: doctor.id });
  };

  const doctorInitials = doctor.name
    .split(" ")
    .map((name) => name[0])
    .join("")
    .slice(0, 2);
  const availability = getAvailability(doctor);

  return (
    <Card className="w-full min-w-0">
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback>{doctorInitials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium">{doctor.name}</h3>
            <p className="text-muted-foreground truncate text-sm">
              {doctor.specialty}
            </p>
            {doctor.crmNumber && (
              <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                <BadgeCheckIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                CRM {doctor.crmNumber}/{doctor.crmState}
                {doctor.rqe ? ` · RQE ${doctor.rqe}` : ""}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-2 overflow-hidden">
        <Badge variant="outline" className="max-w-full truncate">
          <CalendarIcon className="mr-1" />
          <span className="truncate">
            {availability.from.format("dddd")} a{" "}
            {availability.to.format("dddd")}
          </span>
        </Badge>
        <Badge variant="outline" className="max-w-full truncate">
          <ClockIcon className="mr-1" />
          <span className="truncate">
            {availability.from.format("HH:mm")} -{" "}
            {availability.to.format("HH:mm")}
          </span>
        </Badge>
        {doctor.acceptsPrivate && (
          <Badge variant="outline" className="max-w-full truncate">
            <DollarSignIcon className="mr-1" />
            <span className="truncate">
              Particular ·{" "}
              {formatCurrencyInCents(doctor.appointmentPriceInCents)}
            </span>
          </Badge>
        )}
        <Badge
          variant="outline"
          className="max-w-full truncate"
          title={doctor.healthInsurances.join(", ") || undefined}
        >
          <HeartHandshakeIcon className="mr-1" />
          <span className="truncate">
            {insurancesLabel(doctor.healthInsurances)}
          </span>
        </Badge>
      </CardContent>
      <Separator />
      <CardFooter className="flex flex-col gap-2">
        <Dialog
          open={isUpsertDoctorDialogOpen}
          onOpenChange={setIsUpsertDoctorDialogOpen}
        >
          <DialogTrigger asChild>
            <Button className="h-10 w-full">Ver detalhes</Button>
          </DialogTrigger>
          <UpsertDoctorForm
            doctor={{
              ...doctor,
              availableFromTime: availability.from.format("HH:mm:ss"),
              availableToTime: availability.to.format("HH:mm:ss"),
            }}
            onSuccess={() => setIsUpsertDoctorDialogOpen(false)}
            isOpen={isUpsertDoctorDialogOpen}
          />
        </Dialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="hover:bg-destructive/10 hover:text-destructive h-10 w-full"
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              Deletar médico
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Tem certeza que deseja deletar esse médico?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação não pode ser revertida. Isso irá deletar o médico e
                todas as consultas agendadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteDoctorClick}>
                Deletar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
};

export default DoctorCard;
