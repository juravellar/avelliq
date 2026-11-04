import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const onConflictDoUpdate = vi.fn(() => ({
    returning: async () => [{ id: "saved_id" }],
  }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  return {
    execute: vi.fn(),
    getSession: vi.fn(),
    findPatient: vi.fn(),
    countPatients: vi.fn(),
    values,
    onConflictDoUpdate,
  };
});

const audit = vi.hoisted(() => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/audit", () => audit);
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/db", () => {
  const db: Record<string, unknown> = {
    query: { patientsTable: { findFirst: mocks.findPatient } },
    $count: mocks.countPatients,
    insert: () => ({ values: mocks.values }),
  };
  db.transaction = async (fn: (tx: unknown) => unknown) =>
    fn({ ...db, execute: mocks.execute });
  return { db };
});

import { upsertPatient } from ".";

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const PATIENT_ID = "33333333-3333-4333-8333-333333333333";

const input = {
  name: "João Silva",
  email: "joao@example.com",
  phoneNumber: "11999999999",
  sex: "male" as const,
};

describe("upsertPatient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getSession.mockResolvedValue({
      user: { plan: null, clinic: { id: CLINIC_ID } },
    });
    mocks.findPatient.mockResolvedValue(undefined);
    mocks.countPatients.mockResolvedValue(0);
  });

  it("creates a patient within the Free limit", async () => {
    mocks.countPatients.mockResolvedValue(19);

    const result = await upsertPatient(input);

    expect(result?.serverError).toBeUndefined();
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: CLINIC_ID }),
    );
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ setWhere: expect.anything() }),
    );
    const [entry] = audit.recordAudit.mock.calls[0];
    expect(entry).toEqual({
      userId: undefined,
      clinicId: CLINIC_ID,
      action: "patient.created",
      entityId: "saved_id",
    });
    // Only ids: the patient's name and contact never reach the audit log.
    expect(JSON.stringify(entry)).not.toMatch(/João|joao@|11999999999/);
  });

  it("blocks the 21st patient on the Free plan", async () => {
    mocks.countPatients.mockResolvedValue(20);

    const result = await upsertPatient(input);

    expect(result?.serverError).toBe(
      "Seu plano permite até 20 pacientes. Faça upgrade em Assinatura para continuar.",
    );
    expect(mocks.values).not.toHaveBeenCalled();
  });

  it("refuses to overwrite a patient from another clinic", async () => {
    mocks.findPatient.mockResolvedValue({ id: PATIENT_ID, clinicId: "other" });

    const result = await upsertPatient({ ...input, id: PATIENT_ID });

    expect(result?.serverError).toBeDefined();
    expect(mocks.values).not.toHaveBeenCalled();
  });

  it("doesn't recreate a patient that was deleted meanwhile", async () => {
    const result = await upsertPatient({ ...input, id: PATIENT_ID });

    expect(result?.serverError).toBe(
      "Paciente não encontrado. Atualize a página.",
    );
    expect(mocks.values).not.toHaveBeenCalled();
  });

  it("locks the clinic before counting its patients", async () => {
    await upsertPatient(input);

    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.execute.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.countPatients.mock.invocationCallOrder[0],
    );
  });

  it("stores optional details normalized: digits only, empty as null", async () => {
    mocks.countPatients.mockResolvedValue(0);

    const result = await upsertPatient({
      ...input,
      cpf: "529.982.247-25",
      addressZip: "01310-100",
      emergencyContactPhone: "(11) 98888-7777",
      healthInsurance: "",
      birthDate: "1990-05-20",
    });

    expect(result?.serverError).toBeUndefined();
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        cpf: "52998224725",
        addressZip: "01310100",
        emergencyContactPhone: "11988887777",
        healthInsurance: null,
        notes: null,
        birthDate: "1990-05-20",
      }),
    );
  });

  it("refuses an invalid CPF before touching the database", async () => {
    const result = await upsertPatient({ ...input, cpf: "529.982.247-24" });

    expect(result?.validationErrors?.cpf).toBeDefined();
    expect(mocks.values).not.toHaveBeenCalled();
  });

  it("refuses a birth date in the future", async () => {
    const result = await upsertPatient({ ...input, birthDate: "2999-01-01" });

    expect(result?.validationErrors?.birthDate).toBeDefined();
    expect(mocks.values).not.toHaveBeenCalled();
  });

  it("refuses a birth date that doesn't exist", async () => {
    const result = await upsertPatient({ ...input, birthDate: "1990-02-31" });

    expect(result?.validationErrors?.birthDate).toBeDefined();
    expect(mocks.values).not.toHaveBeenCalled();
  });

  it("explains a CPF already used in the clinic", async () => {
    mocks.onConflictDoUpdate.mockImplementationOnce(() => ({
      returning: async () => {
        throw Object.assign(new Error("duplicate key"), {
          code: "23505",
          constraint: "patients_clinic_cpf_unique",
        });
      },
    }));

    const result = await upsertPatient({ ...input, cpf: "52998224725" });

    expect(result?.serverError).toBe(
      "Já existe um paciente com este CPF nesta clínica.",
    );
  });

  it("doesn't blame the CPF for another unique key", async () => {
    mocks.onConflictDoUpdate.mockImplementationOnce(() => ({
      returning: async () => {
        throw Object.assign(new Error("duplicate key"), {
          code: "23505",
          constraint: "patients_pkey",
        });
      },
    }));

    const result = await upsertPatient(input);

    expect(result?.serverError).not.toBe(
      "Já existe um paciente com este CPF nesta clínica.",
    );
  });

  it("keeps accepting an incomplete phone saved before the check existed", async () => {
    mocks.findPatient.mockResolvedValue({
      id: PATIENT_ID,
      clinicId: CLINIC_ID,
      phoneNumber: "1199",
    });

    const result = await upsertPatient({
      ...input,
      id: PATIENT_ID,
      phoneNumber: "1199",
    });

    expect(result?.serverError).toBeUndefined();
  });

  it("refuses an incomplete phone that wasn't saved before", async () => {
    const result = await upsertPatient({ ...input, phoneNumber: "119" });

    expect(result?.serverError).toBe("Telefone inválido.");
    expect(mocks.values).not.toHaveBeenCalled();
  });
});
