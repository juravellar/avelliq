import { describe, expect, it } from "vitest";

import { upsertDoctorSchema } from "./schema";

const valid = {
  name: "Dra. Ana",
  specialty: "Cardiologia",
  appointmentPriceInCents: 20000,
  availableFromWeekDay: 1,
  availableToWeekDay: 5,
  availableFromTime: "08:00:00",
  availableToTime: "18:00",
};

describe("upsertDoctorSchema", () => {
  it("accepts HH:mm:ss and HH:mm times", () => {
    expect(upsertDoctorSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses times that aren't a clock time", () => {
    for (const availableFromTime of ["8h", "25:00:00", "08:60", "ab:cd:ef"]) {
      expect(
        upsertDoctorSchema.safeParse({ ...valid, availableFromTime }).success,
      ).toBe(false);
    }
  });

  it("limits the name and the specialty to 120 characters", () => {
    const long = "a".repeat(121);
    expect(upsertDoctorSchema.safeParse({ ...valid, name: long }).success).toBe(
      false,
    );
    expect(
      upsertDoctorSchema.safeParse({ ...valid, specialty: long }).success,
    ).toBe(false);
    expect(
      upsertDoctorSchema.safeParse({ ...valid, name: "a".repeat(120) }).success,
    ).toBe(true);
  });
});
