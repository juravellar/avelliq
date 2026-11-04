import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getSession: vi.fn(),
  findPatient: vi.fn(),
  computeAvailableTimes: vi.fn(),
  insertValues: vi.fn(),
  countAppointments: vi.fn(),
  findAppointment: vi.fn(),
  updateSet: vi.fn(() => ({ where: vi.fn() })),
}));

const audit = vi.hoisted(() => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/audit", () => audit);
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/db", () => {
  const db: Record<string, unknown> = {
    query: {
      patientsTable: { findFirst: mocks.findPatient },
      appointmentsTable: { findFirst: mocks.findAppointment },
    },
    $count: mocks.countAppointments,
    update: () => ({ set: mocks.updateSet }),
    insert: () => ({
      values: (row: unknown) => ({
        returning: async () =>
          (await mocks.insertValues(row)) ?? [{ id: "appointment_new" }],
      }),
    }),
  };
  db.transaction = async (fn: (tx: unknown) => unknown) =>
    fn({ ...db, execute: mocks.execute });
  return { db };
});
vi.mock("@/lib/available-times", () => ({
  computeAvailableTimes: mocks.computeAvailableTimes,
}));

import { upsertAppointment } from ".";

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const DOCTOR_ID = "22222222-2222-4222-8222-222222222222";
const PATIENT_ID = "33333333-3333-4333-8333-333333333333";

// Midnight in São Paulo, as the browser date picker sends it.
const MONDAY_IN_CLINIC = new Date("2026-10-12T03:00:00.000Z");

const input = {
  patientId: PATIENT_ID,
  doctorId: DOCTOR_ID,
  date: MONDAY_IN_CLINIC,
  time: "08:00:00",
  appointmentPriceInCents: 20000,
};

describe("upsertAppointment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getSession.mockResolvedValue({
      user: { plan: null, clinic: { id: CLINIC_ID } },
    });
    mocks.countAppointments.mockResolvedValue(0);
    mocks.findPatient.mockResolvedValue({
      id: PATIENT_ID,
      clinicId: CLINIC_ID,
    });
    mocks.computeAvailableTimes.mockResolvedValue([
      { value: "08:00:00", available: true },
    ]);
  });

  it.each([
    ["negative", -500000],
    ["fractional", 1500.5],
    ["absurdly high", 100_000_000],
  ])("refuses a %s price before touching the database", async (_, price) => {
    const result = await upsertAppointment({
      ...input,
      appointmentPriceInCents: price,
    });

    expect(result?.validationErrors?.appointmentPriceInCents).toBeDefined();
    expect(mocks.findPatient).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("stores the appointment at the clinic-time instant", async () => {
    const result = await upsertAppointment(input);

    expect(result?.serverError).toBeUndefined();
    expect(mocks.computeAvailableTimes).toHaveBeenCalledWith(
      expect.objectContaining({ execute: mocks.execute }),
      { clinicId: CLINIC_ID, doctorId: DOCTOR_ID, date: "2026-10-12" },
    );
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: CLINIC_ID,
        date: new Date("2026-10-12T11:00:00.000Z"),
      }),
    );
  });

  it("refuses a patient from another clinic", async () => {
    mocks.findPatient.mockResolvedValue({ id: PATIENT_ID, clinicId: "other" });

    const result = await upsertAppointment(input);

    expect(result?.serverError).toBeDefined();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("refuses a slot that is not available", async () => {
    mocks.computeAvailableTimes.mockResolvedValue([
      { value: "08:00:00", available: false },
    ]);

    const result = await upsertAppointment(input);

    expect(result?.serverError).toBeDefined();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("blocks new appointments past the Free monthly limit", async () => {
    mocks.countAppointments.mockResolvedValue(40);

    const result = await upsertAppointment(input);

    expect(result?.serverError).toBe(
      "Seu plano permite até 40 agendamentos por mês. Faça upgrade em Assinatura para continuar.",
    );
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("does not limit appointments on paid plans", async () => {
    mocks.getSession.mockResolvedValue({
      user: { plan: "professional", clinic: { id: CLINIC_ID } },
    });
    mocks.countAppointments.mockResolvedValue(5000);

    const result = await upsertAppointment(input);

    expect(result?.serverError).toBeUndefined();
    expect(mocks.insertValues).toHaveBeenCalledOnce();
  });

  it("lets an appointment be saved again at its own time", async () => {
    const APPOINTMENT_ID = "44444444-4444-4444-8444-444444444444";
    mocks.findAppointment.mockResolvedValue({
      id: APPOINTMENT_ID,
      clinicId: CLINIC_ID,
      date: new Date("2026-10-12T11:00:00.000Z"),
    });

    const result = await upsertAppointment({ ...input, id: APPOINTMENT_ID });

    expect(result?.serverError).toBeUndefined();
    expect(mocks.computeAvailableTimes).toHaveBeenCalledWith(
      expect.objectContaining({ execute: mocks.execute }),
      {
        clinicId: CLINIC_ID,
        doctorId: DOCTOR_ID,
        date: "2026-10-12",
        ignoreAppointmentId: APPOINTMENT_ID,
      },
    );
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ date: new Date("2026-10-12T11:00:00.000Z") }),
    );
    expect(mocks.countAppointments).not.toHaveBeenCalled();
  });

  it("refuses moving an appointment into a month that is already full", async () => {
    const APPOINTMENT_ID = "44444444-4444-4444-8444-444444444444";
    mocks.findAppointment.mockResolvedValue({
      id: APPOINTMENT_ID,
      clinicId: CLINIC_ID,
      date: new Date("2026-09-14T11:00:00.000Z"),
    });
    mocks.countAppointments.mockResolvedValue(40);

    const result = await upsertAppointment({ ...input, id: APPOINTMENT_ID });

    expect(result?.serverError).toBe(
      "Seu plano permite até 40 agendamentos por mês. Faça upgrade em Assinatura para continuar.",
    );
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it("allows an edit inside the same month even at the limit", async () => {
    const APPOINTMENT_ID = "44444444-4444-4444-8444-444444444444";
    mocks.findAppointment.mockResolvedValue({
      id: APPOINTMENT_ID,
      clinicId: CLINIC_ID,
      date: new Date("2026-10-20T11:00:00.000Z"),
    });
    mocks.countAppointments.mockResolvedValue(40);

    const result = await upsertAppointment({ ...input, id: APPOINTMENT_ID });

    expect(result?.serverError).toBeUndefined();
    expect(mocks.updateSet).toHaveBeenCalledOnce();
    expect(mocks.countAppointments).not.toHaveBeenCalled();
  });

  it("checks the slot and the monthly limit while holding the clinic lock", async () => {
    await upsertAppointment(input);

    const lockedAt = mocks.execute.mock.invocationCallOrder[0];
    expect(lockedAt).toBeLessThan(
      mocks.computeAvailableTimes.mock.invocationCallOrder[0],
    );
    expect(lockedAt).toBeLessThan(
      mocks.countAppointments.mock.invocationCallOrder[0],
    );
  });

  it("explains a slot taken at the same instant by another request", async () => {
    mocks.insertValues.mockRejectedValue(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    );

    const result = await upsertAppointment(input);

    expect(result?.serverError).toBe(
      "Este horário não está mais disponível. Escolha outro horário.",
    );
  });
});
