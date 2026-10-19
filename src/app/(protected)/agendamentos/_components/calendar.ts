import dayjs from "dayjs";

import {
  generateTimeSlots,
  inClinicTimezone,
  isWeekDayInRange,
  utcTimeToClinic,
} from "@/helpers/time";

const DAY = "YYYY-MM-DD";

export interface CalendarDoctor {
  id: string;
  availableFromWeekDay: number;
  availableToWeekDay: number;
  // Stored in UTC, like everywhere else (see utcTimeToClinic).
  availableFromTime: string;
  availableToTime: string;
}

// Weeks start on Monday, as on Brazilian calendars.
export const weekStart = (day: string) => {
  const date = dayjs(day);
  return date.subtract((date.day() + 6) % 7, "day").format(DAY);
};

export const weekDays = (monday: string) =>
  Array.from({ length: 7 }, (_, index) =>
    dayjs(monday).add(index, "day").format(DAY),
  );

export const shiftWeek = (monday: string, weeks: number) =>
  dayjs(monday).add(weeks, "week").format(DAY);

// A doctor's working hours in clinic time, as "HH:mm:ss".
const workingHours = (doctor: CalendarDoctor) => ({
  from: utcTimeToClinic(doctor.availableFromTime).format("HH:mm:ss"),
  to: utcTimeToClinic(doctor.availableToTime).format("HH:mm:ss"),
});

// The same rule as the available times of the appointment form: the
// doctor's weekdays, and 30-minute slots from the first to the last hour.
export const isDoctorWorking = (
  doctor: CalendarDoctor,
  day: string,
  slot: string,
) => {
  if (
    !isWeekDayInRange(
      dayjs(day).day(),
      doctor.availableFromWeekDay,
      doctor.availableToWeekDay,
    )
  ) {
    return false;
  }
  const { from, to } = workingHours(doctor);
  return slot >= from && slot <= to;
};

const DEFAULT_HOURS = { from: "08:00:00", to: "18:00:00" };

// The rows of the calendar: every slot from the earliest start to the latest
// end among the doctors shown, so nobody's hours are cut off.
export const calendarSlots = (doctors: CalendarDoctor[]) => {
  const hours = doctors.map(workingHours);
  const from = hours.length
    ? hours.map((h) => h.from).sort()[0]
    : DEFAULT_HOURS.from;
  const to = hours.length
    ? hours
        .map((h) => h.to)
        .sort()
        .at(-1)!
    : DEFAULT_HOURS.to;
  return generateTimeSlots().filter((slot) => slot >= from && slot <= to);
};

// Where an appointment goes in the grid: its clinic day and slot.
// Phones show one day at a time: the one picked when it is in the week on
// screen, otherwise today when it is in that week, otherwise Monday. Moving to
// another week keeps the component mounted, so a picked day from the previous
// week must not hide every column.
export const shownMobileDay = (
  days: string[],
  chosen: string | null,
  today: string,
) => {
  if (chosen && days.includes(chosen)) return chosen;
  return days.includes(today) ? today : days[0];
};

export const cellKey = (day: string, slot: string) => `${day}|${slot}`;

export const appointmentCell = (date: Date) => {
  const local = inClinicTimezone(date);
  return cellKey(local.format(DAY), local.format("HH:mm:ss"));
};

export const groupByCell = <T extends { date: Date }>(appointments: T[]) => {
  const cells = new Map<string, T[]>();
  for (const appointment of appointments) {
    const key = appointmentCell(appointment.date);
    cells.set(key, [...(cells.get(key) ?? []), appointment]);
  }
  return cells;
};
