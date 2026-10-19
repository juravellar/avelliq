import { and, eq, gte, lt } from "drizzle-orm";
import { redirect } from "next/navigation";

import {
  PageActions,
  PageContainer,
  PageContent,
  PageDescription,
  PageHeader,
  PageHeaderContent,
  PageTitle,
} from "@/components/ui/page-container";
import { db } from "@/db";
import { appointmentsTable, doctorsTable, patientsTable } from "@/db/schema";
import {
  clinicDayRange,
  clinicToday,
  inClinicTimezone,
  isCalendarDay,
} from "@/helpers/time";
import { createGate } from "@/lib/create-gate";
import { writeBlock } from "@/lib/free-period";
import { getPlanUsage } from "@/lib/plan-usage";
import { getServerSession } from "@/lib/server-session";

import AddAppointmentButton from "./_components/add-appointments-button";
import { AppointmentsCalendar } from "./_components/appointments-calendar";
import { AppointmentsTable } from "./_components/appointments-table";
import { calendarSlots, weekDays, weekStart } from "./_components/calendar";
import { PATIENT_OPTION_COLUMNS } from "./_components/patient-option";
import { type AppointmentsView, ViewToggle } from "./_components/view-toggle";

interface AppointmentsPageProps {
  searchParams: Promise<{ visao?: string; semana?: string; medico?: string }>;
}

const AppointmentsPage = async ({ searchParams }: AppointmentsPageProps) => {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/entrar");
  }

  if (!session.user.clinic) {
    redirect("/nova-clinica");
  }

  const clinicId = session.user.clinic.id;
  const params = await searchParams;
  const view: AppointmentsView =
    params.visao === "calendario" ? "calendario" : "lista";
  // The calendar shows one week (Monday to Sunday) and loads only that week.
  const days = weekDays(
    weekStart(isCalendarDay(params.semana) ? params.semana : clinicToday()),
  );
  const weekRange = {
    start: clinicDayRange(days[0]).start,
    end: clinicDayRange(days[6]).end,
  };

  const [patients, doctors, appointments] = await Promise.all([
    db.query.patientsTable.findMany({
      where: eq(patientsTable.clinicId, clinicId),
      columns: PATIENT_OPTION_COLUMNS,
    }),
    db.query.doctorsTable.findMany({
      where: eq(doctorsTable.clinicId, clinicId),
    }),
    db.query.appointmentsTable.findMany({
      where:
        view === "calendario"
          ? and(
              eq(appointmentsTable.clinicId, clinicId),
              gte(appointmentsTable.date, weekRange.start),
              lt(appointmentsTable.date, weekRange.end),
            )
          : eq(appointmentsTable.clinicId, clinicId),
      with: {
        patient: { columns: PATIENT_OPTION_COLUMNS },
        doctor: true,
      },
    }),
  ]);

  const usage = await getPlanUsage(
    session.user.clinic.id,
    session.user.plan,
    session.user.clinics.length,
  );
  const block = writeBlock(session.user);
  const gate = createGate(
    usage.appointmentsPerMonth,
    block,
    { one: "agendamento", many: "agendamentos" },
    " neste mês",
  );
  // An unknown doctor in the URL (deleted, or from another clinic) shows all.
  const doctorId = doctors.some(({ id }) => id === params.medico)
    ? params.medico!
    : null;
  const now = inClinicTimezone(new Date());
  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>Agendamentos</PageTitle>
          <PageDescription>
            Gerencie os agendamentos da sua clínica
          </PageDescription>
        </PageHeaderContent>
        <PageActions>
          <ViewToggle view={view} />
          <AddAppointmentButton
            patients={patients}
            doctors={doctors}
            gate={gate}
          />
        </PageActions>
      </PageHeader>
      <PageContent>
        {view === "calendario" ? (
          <AppointmentsCalendar
            days={days}
            slots={calendarSlots(
              doctorId ? doctors.filter(({ id }) => id === doctorId) : doctors,
            )}
            appointments={appointments}
            doctors={doctors}
            patients={patients}
            gate={gate}
            doctorId={doctorId}
            now={{
              day: now.format("YYYY-MM-DD"),
              time: now.format("HH:mm:ss"),
            }}
          />
        ) : (
          <AppointmentsTable
            appointments={appointments}
            doctors={doctors}
            patients={patients}
          />
        )}
      </PageContent>
    </PageContainer>
  );
};

export default AppointmentsPage;
