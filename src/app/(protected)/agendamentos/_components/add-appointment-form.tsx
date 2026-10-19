"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import dayjs from "dayjs";
import { CalendarIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getAvailableTimes } from "@/actions/get-available-times";
import { upsertAppointment } from "@/actions/upsert-appointment";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { appointmentsTable, doctorsTable } from "@/db/schema";
import { priceInCentsForDoctor } from "@/helpers/appointment-price";
import {
  formatReais,
  priceInReaisSchema,
  reaisToCents,
} from "@/helpers/currency";
import { inClinicTimezone, isWeekDayInRange } from "@/helpers/time";
import { actionErrorMessage } from "@/lib/action-errors";
import { cn } from "@/lib/utils";

import type { PatientOption } from "./patient-option";

const formSchema = z.object({
  patientId: z.string().min(1, {
    message: "Paciente é obrigatório.",
  }),
  doctorId: z.string().min(1, {
    message: "Médico é obrigatório.",
  }),
  appointmentPrice: priceInReaisSchema("Valor da consulta é obrigatório."),
  date: z.date({
    message: "Data é obrigatória.",
  }),
  time: z.string().min(1, {
    message: "Horário é obrigatório.",
  }),
});

interface UpsertAppointmentFormProps {
  isOpen: boolean;
  patients: PatientOption[];
  doctors: (typeof doctorsTable.$inferSelect)[];
  appointment?: typeof appointmentsTable.$inferSelect;
  // A new appointment started from a calendar slot: its day (YYYY-MM-DD),
  // time (HH:mm:ss) and, when the calendar is filtered, its doctor.
  defaults?: { date: string; time: string; doctorId?: string };
  onSuccess?: () => void;
}

// Shows the doctor's default price under the field and offers it back when the
// typed price differs (a discount, or a price booked before it changed).
function DoctorPriceHint({
  doctor,
  priceInReais,
  onUseDefault,
}: {
  doctor: typeof doctorsTable.$inferSelect | undefined;
  priceInReais: number | undefined;
  onUseDefault: (reais: number) => void;
}) {
  if (!doctor) {
    return null;
  }
  const defaultReais = doctor.appointmentPriceInCents / 100;
  if (reaisToCents(priceInReais ?? 0) === doctor.appointmentPriceInCents) {
    return (
      <p className="text-muted-foreground text-xs">
        Valor padrão de {doctor.name}.
      </p>
    );
  }
  return (
    <p className="text-muted-foreground text-xs">
      Valor padrão de {doctor.name}: {formatReais(defaultReais)}.{" "}
      <button
        type="button"
        className="text-primary font-medium underline"
        onClick={() => onUseDefault(defaultReais)}
      >
        Usar valor padrão
      </button>
    </p>
  );
}

const UpsertAppointmentForm = ({
  appointment,
  patients,
  doctors,
  onSuccess,
  isOpen,
  defaults,
}: UpsertAppointmentFormProps) => {
  const defaultDate = defaults?.date;
  const defaultTime = defaults?.time;
  const defaultDoctorId = defaults?.doctorId;
  const initialValues = useCallback((): z.infer<typeof formSchema> => {
    if (appointment) {
      return {
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        appointmentPrice: appointment.appointmentPriceInCents / 100,
        date: appointment.date,
        time: inClinicTimezone(appointment.date).format("HH:mm:ss"),
      };
    }
    const doctor = doctors.find(({ id }) => id === defaultDoctorId);
    return {
      patientId: "",
      doctorId: doctor?.id ?? "",
      appointmentPrice: doctor ? doctor.appointmentPriceInCents / 100 : 0,
      // The date picker works with local midnight of the chosen day.
      date: defaultDate
        ? dayjs(defaultDate).toDate()
        : (undefined as unknown as Date),
      time: defaultTime ?? "",
    };
  }, [appointment, doctors, defaultDate, defaultTime, defaultDoctorId]);

  const form = useForm<z.infer<typeof formSchema>>({
    shouldUnregister: true,
    resolver: zodResolver(formSchema),
    defaultValues: initialValues(),
  });

  // Once the user types a price, picking another doctor keeps it instead of
  // overwriting it with that doctor's default.
  const [priceEdited, setPriceEdited] = useState(false);
  const selectedDoctorId = form.watch("doctorId");
  const selectedPatientId = form.watch("patientId");
  const selectedDate = form.watch("date");

  const { data: availableTimes } = useQuery({
    queryKey: [
      "available-times",
      selectedDoctorId,
      selectedDate,
      appointment?.id,
    ],
    queryFn: async () =>
      getAvailableTimes({
        date: dayjs(selectedDate).format("YYYY-MM-DD"),
        doctorId: selectedDoctorId,
        ignoreAppointmentId: appointment?.id,
      }),
    enabled: !!selectedDate && !!selectedDoctorId,
  });

  // Runs only when the user picks a doctor. An effect would also run after
  // every price edit and put the old price back.
  const fillPriceForDoctor = (doctorId: string) => {
    const doctor = doctors.find(({ id }) => id === doctorId);
    if (!doctor) {
      return;
    }
    const cents = priceInCentsForDoctor(doctor, appointment, priceEdited);
    if (cents !== null) {
      form.setValue("appointmentPrice", cents / 100);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPriceEdited(false);
      form.reset(initialValues());
    }
  }, [isOpen, form, initialValues]);

  const upsertAppointmentAction = useAction(upsertAppointment, {
    onSuccess: () => {
      toast.success(
        appointment ? "Agendamento salvo." : "Agendamento criado com sucesso.",
      );
      onSuccess?.();
    },
    onError: ({ error }) => {
      toast.error(actionErrorMessage(error, "Erro ao salvar agendamento."));
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    upsertAppointmentAction.execute({
      ...values,
      id: appointment?.id,
      appointmentPriceInCents: reaisToCents(values.appointmentPrice),
    });
  };

  const isDateAvailable = (date: Date) => {
    if (!selectedDoctorId) return false;
    const selectedDoctor = doctors.find(
      (doctor) => doctor.id === selectedDoctorId,
    );
    if (!selectedDoctor) return false;
    return isWeekDayInRange(
      date.getDay(),
      selectedDoctor.availableFromWeekDay,
      selectedDoctor.availableToWeekDay,
    );
  };
  const isDateTimeEnabled = selectedPatientId && selectedDoctorId;

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>
          {appointment ? "Editar agendamento" : "Novo agendamento"}
        </DialogTitle>
        <DialogDescription>
          {appointment
            ? "Edite as informações deste agendamento."
            : "Crie um novo agendamento."}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="patientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paciente</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um paciente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="doctorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Médico</FormLabel>
                <Select
                  onValueChange={(doctorId) => {
                    field.onChange(doctorId);
                    fillPriceForDoctor(doctorId);
                  }}
                  value={field.value}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um médico" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} - {doctor.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="appointmentPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor da consulta</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onValueChange={(reais) => {
                      setPriceEdited(true);
                      field.onChange(reais);
                    }}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    disabled={!selectedDoctorId}
                    placeholder={
                      selectedDoctorId ? "R$ 0,00" : "Escolha o médico primeiro"
                    }
                  />
                </FormControl>
                <DoctorPriceHint
                  doctor={doctors.find(({ id }) => id === selectedDoctorId)}
                  priceInReais={field.value}
                  onUseDefault={(reais) => {
                    setPriceEdited(false);
                    field.onChange(reais);
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        disabled={!isDateTimeEnabled}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? (
                          format(field.value, "PPP", { locale: ptBR })
                        ) : (
                          <span>Selecione uma data</span>
                        )}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      // Days before today; today itself stays bookable.
                      disabled={(date) =>
                        dayjs(date).isBefore(dayjs(), "day") ||
                        !isDateAvailable(date)
                      }
                      autoFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Horário</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  defaultValue={field.value}
                  disabled={!isDateTimeEnabled || !selectedDate}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um horário" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableTimes?.data?.map((time) => (
                      <SelectItem
                        key={time.value}
                        value={time.value}
                        disabled={!time.available}
                      >
                        {time.label} {!time.available && " (Indisponível)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button type="submit" disabled={upsertAppointmentAction.isPending}>
              {upsertAppointmentAction.isPending
                ? "Salvando..."
                : appointment
                  ? "Salvar alterações"
                  : "Criar agendamento"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

export default UpsertAppointmentForm;
