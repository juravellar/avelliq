"use client";

import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { appointmentsTable, doctorsTable } from "@/db/schema";
import type { CreateGate } from "@/lib/create-gate";
import { cn } from "@/lib/utils";

import { BlockedCreateDialog } from "../../_components/blocked-create-dialog";
import UpsertAppointmentForm from "./add-appointment-form";
import { cellKey, groupByCell, isDoctorWorking, shiftWeek } from "./calendar";
import type { PatientOption } from "./patient-option";

type Doctor = typeof doctorsTable.$inferSelect;
type CalendarAppointment = typeof appointmentsTable.$inferSelect & {
  patient: PatientOption;
  doctor: Pick<Doctor, "id" | "name">;
};

const ALL_DOCTORS = "todos";
const WEEKDAY = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface AppointmentsCalendarProps {
  days: string[];
  slots: string[];
  appointments: CalendarAppointment[];
  doctors: Doctor[];
  patients: PatientOption[];
  gate: CreateGate;
  doctorId: string | null;
  // Clinic date and time when the page was rendered; earlier slots are past.
  now: { day: string; time: string };
}

// A week of 30-minute slots. An empty slot in someone's working hours opens
// a new appointment already set to that day and time; an appointment opens
// its edit form.
export function AppointmentsCalendar({
  days,
  slots,
  appointments,
  doctors,
  patients,
  gate,
  doctorId,
  now,
}: AppointmentsCalendarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [newAt, setNewAt] = useState<{
    date: string;
    time: string;
    doctorId?: string;
  } | null>(null);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarAppointment | null>(null);
  // Phones show one day at a time: today when it is in this week.
  const [mobileDay, setMobileDay] = useState(
    days.includes(now.day) ? now.day : days[0],
  );

  const shown = doctorId
    ? doctors.filter(({ id }) => id === doctorId)
    : doctors;
  const cells = groupByCell(
    doctorId
      ? appointments.filter((appointment) => appointment.doctorId === doctorId)
      : appointments,
  );

  const hrefWith = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    return `${pathname}?${params.toString()}`;
  };

  const isPast = (day: string, slot: string) =>
    day < now.day || (day === now.day && slot < now.time);

  // Doctors who could take an appointment in this slot: working, and not
  // already booked at that time.
  const freeDoctors = (day: string, slot: string) => {
    const booked = new Set(
      (cells.get(cellKey(day, slot)) ?? []).map((a) => a.doctorId),
    );
    return shown.filter(
      (doctor) => isDoctorWorking(doctor, day, slot) && !booked.has(doctor.id),
    );
  };

  const openNew = (day: string, slot: string, free: Doctor[]) => {
    if (gate.blockedKind) {
      setBlockedOpen(true);
      return;
    }
    setNewAt({
      date: day,
      time: slot,
      // Filled in when there is only one doctor it could be.
      doctorId: free.length === 1 ? free[0].id : undefined,
    });
  };

  const monday = days[0];
  const range = `${dayjs(days[0]).format("DD/MM")} – ${dayjs(days[6]).format("DD/MM/YYYY")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link
              href={hrefWith({ semana: shiftWeek(monday, -1) })}
              aria-label="Semana anterior"
              prefetch={false}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={hrefWith({ semana: null })} prefetch={false}>
              Hoje
            </Link>
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link
              href={hrefWith({ semana: shiftWeek(monday, 1) })}
              aria-label="Próxima semana"
              prefetch={false}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <span className="text-sm font-medium">{range}</span>
        </div>
        <Select
          value={doctorId ?? ALL_DOCTORS}
          onValueChange={(value) =>
            router.push(
              hrefWith({ medico: value === ALL_DOCTORS ? null : value }),
            )
          }
        >
          <SelectTrigger className="w-full sm:w-64" aria-label="Médico">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DOCTORS}>Todos os médicos</SelectItem>
            {doctors.map((doctor) => (
              <SelectItem key={doctor.id} value={doctor.id}>
                {doctor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Phones: pick the day to show. */}
      <div className="grid grid-cols-7 gap-1 md:hidden">
        {days.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => setMobileDay(day)}
            aria-pressed={day === mobileDay}
            className={cn(
              "rounded-md border py-1.5 text-xs",
              day === mobileDay
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background",
              day === now.day && day !== mobileDay && "border-primary",
            )}
          >
            <span className="block">{WEEKDAY[dayjs(day).day()]}</span>
            <span className="block font-semibold">
              {dayjs(day).format("DD")}
            </span>
          </button>
        ))}
      </div>

      {doctors.length === 0 ? (
        <p className="text-muted-foreground rounded-md border p-6 text-center text-sm">
          Cadastre um médico para ver os horários de atendimento.
        </p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-md border">
          <table className="w-full table-fixed border-collapse text-xs">
            <thead className="bg-background sticky top-0 z-10">
              <tr>
                <th className="w-14 border-b p-2" aria-label="Horário" />
                {days.map((day) => (
                  <th
                    key={day}
                    scope="col"
                    className={cn(
                      "border-b border-l p-2 font-medium",
                      day !== mobileDay && "hidden md:table-cell",
                      day === now.day && "text-primary",
                    )}
                  >
                    {WEEKDAY[dayjs(day).day()]} {dayjs(day).format("DD/MM")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot}>
                  <th
                    scope="row"
                    className="text-muted-foreground border-b p-1 text-right align-top font-normal"
                  >
                    {slot.slice(0, 5)}
                  </th>
                  {days.map((day) => {
                    const booked = cells.get(cellKey(day, slot)) ?? [];
                    const free = freeDoctors(day, slot);
                    const working = shown.some((doctor) =>
                      isDoctorWorking(doctor, day, slot),
                    );
                    const past = isPast(day, slot);
                    const canBook = free.length > 0 && !past;
                    return (
                      <td
                        key={day}
                        className={cn(
                          "h-10 border-b border-l p-0.5 align-top",
                          day !== mobileDay && "hidden md:table-cell",
                          (!working || past) && "bg-muted/50",
                        )}
                      >
                        <div className="flex flex-col gap-0.5">
                          {booked.map((appointment) => (
                            <button
                              key={appointment.id}
                              type="button"
                              onClick={() => setEditing(appointment)}
                              className="bg-primary/10 hover:bg-primary/20 text-foreground border-primary w-full truncate rounded-sm border-l-2 px-1.5 py-1 text-left transition-colors"
                              title={`${appointment.patient.name} · ${appointment.doctor.name}`}
                            >
                              <span className="font-medium">
                                {appointment.patient.name}
                              </span>
                              {!doctorId && (
                                <span className="text-muted-foreground block truncate">
                                  {appointment.doctor.name}
                                </span>
                              )}
                            </button>
                          ))}
                          {canBook && (
                            <button
                              type="button"
                              onClick={() => openNew(day, slot, free)}
                              aria-label={`Novo agendamento em ${dayjs(day).format("DD/MM")} às ${slot.slice(0, 5)}`}
                              className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 group flex min-h-8 w-full items-center justify-center rounded-sm outline-none focus-visible:ring-[3px]"
                            >
                              <Plus className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!newAt} onOpenChange={(open) => !open && setNewAt(null)}>
        <UpsertAppointmentForm
          isOpen={!!newAt}
          defaults={newAt ?? undefined}
          patients={patients}
          doctors={doctors}
          onSuccess={() => setNewAt(null)}
        />
      </Dialog>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <UpsertAppointmentForm
          isOpen={!!editing}
          appointment={editing ?? undefined}
          patients={patients}
          doctors={doctors}
          onSuccess={() => setEditing(null)}
        />
      </Dialog>
      {gate.blockedKind && (
        <BlockedCreateDialog
          open={blockedOpen}
          onOpenChange={setBlockedOpen}
          kind={gate.blockedKind}
          usageText={gate.usageText}
        />
      )}
    </div>
  );
}
