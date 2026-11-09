import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findPatient: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/db", () => ({
  db: { query: { patientsTable: { findFirst: mocks.findPatient } } },
}));

import { getPatient } from ".";

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const PATIENT_ID = "33333333-3333-4333-8333-333333333333";

describe("getPatient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getSession.mockResolvedValue({
      user: { clinic: { id: CLINIC_ID } },
    });
  });

  it("returns the patient of the signed-in clinic", async () => {
    const patient = { id: PATIENT_ID, clinicId: CLINIC_ID, cpf: "123" };
    mocks.findPatient.mockResolvedValue(patient);

    const result = await getPatient({ id: PATIENT_ID });

    expect(result?.data).toEqual(patient);
  });

  it("refuses a patient from another clinic", async () => {
    mocks.findPatient.mockResolvedValue({
      id: PATIENT_ID,
      clinicId: "other",
      cpf: "123",
    });

    const result = await getPatient({ id: PATIENT_ID });

    expect(result?.data).toBeUndefined();
    expect(result?.serverError).toBe(
      "Paciente não encontrado. Atualize a página.",
    );
  });

  it("reports a patient that does not exist", async () => {
    mocks.findPatient.mockResolvedValue(undefined);

    const result = await getPatient({ id: PATIENT_ID });

    expect(result?.serverError).toBe(
      "Paciente não encontrado. Atualize a página.",
    );
  });
});
