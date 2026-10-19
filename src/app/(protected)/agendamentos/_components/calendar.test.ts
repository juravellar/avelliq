import { describe, expect, it } from "vitest";

import { clinicDateTimeToDate, clinicTimeToUtc } from "@/helpers/time";

import {
  appointmentCell,
  calendarSlots,
  groupByCell,
  isDoctorWorking,
  shiftWeek,
  weekDays,
  weekStart,
} from "./calendar";

// Monday to Friday, 08:00 to 12:00 in clinic time (stored in UTC).
const doctor = {
  id: "d1",
  availableFromWeekDay: 1,
  availableToWeekDay: 5,
  availableFromTime: clinicTimeToUtc("08:00:00"),
  availableToTime: clinicTimeToUtc("12:00:00"),
};

describe("weeks", () => {
  it("start on Monday", () => {
    expect(weekStart("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // Sunday
    expect(weekStart("2026-10-21")).toBe("2026-10-19"); // Wednesday
  });

  it("list seven days and move a week at a time", () => {
    expect(weekDays("2026-10-19")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(shiftWeek("2026-10-19", -1)).toBe("2026-10-12");
    expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
  });
});

describe("isDoctorWorking", () => {
  it("follows the doctor's weekdays and hours in clinic time", () => {
    expect(isDoctorWorking(doctor, "2026-10-19", "08:00:00")).toBe(true);
    expect(isDoctorWorking(doctor, "2026-10-19", "12:00:00")).toBe(true);
    expect(isDoctorWorking(doctor, "2026-10-19", "12:30:00")).toBe(false);
    expect(isDoctorWorking(doctor, "2026-10-25", "09:00:00")).toBe(false); // Sunday
  });
});

describe("calendarSlots", () => {
  it("spans the earliest start to the latest end of the doctors shown", () => {
    const afternoon = {
      ...doctor,
      id: "d2",
      availableFromTime: clinicTimeToUtc("14:00:00"),
      availableToTime: clinicTimeToUtc("18:00:00"),
    };
    const slots = calendarSlots([doctor, afternoon]);
    expect(slots[0]).toBe("08:00:00");
    expect(slots.at(-1)).toBe("18:00:00");
    expect(slots).toHaveLength(21);
  });

  it("shows business hours when there is no doctor", () => {
    expect(calendarSlots([])[0]).toBe("08:00:00");
    expect(calendarSlots([]).at(-1)).toBe("18:00:00");
  });
});

describe("groupByCell", () => {
  it("places appointments by clinic day and slot", () => {
    const at = (day: string, time: string) => ({
      date: clinicDateTimeToDate(day, time),
    });
    const cells = groupByCell([
      at("2026-10-19", "09:00:00"),
      at("2026-10-19", "09:00:00"),
      at("2026-10-20", "10:30:00"),
    ]);
    expect(cells.get("2026-10-19|09:00:00")).toHaveLength(2);
    expect(cells.get("2026-10-20|10:30:00")).toHaveLength(1);
    // 23:30 in São Paulo is already the next day in UTC.
    expect(
      appointmentCell(clinicDateTimeToDate("2026-10-19", "23:30:00")),
    ).toBe("2026-10-19|23:30:00");
  });
});
