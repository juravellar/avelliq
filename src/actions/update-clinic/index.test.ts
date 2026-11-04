import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const where = vi.fn();
  return {
    getSession: vi.fn(),
    set: vi.fn(() => ({ where })),
    where,
    findFirst: vi.fn(),
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
  const tx = {
    update: () => ({ set: mocks.set }),
    query: { clinicsTable: { findFirst: mocks.findFirst } },
  };
  return {
    db: { transaction: async (fn: (tx: unknown) => unknown) => fn(tx) },
  };
});

import { TERMS_VERSION } from "@/lib/terms";

import { updateClinic } from ".";

describe("updateClinic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getSession.mockResolvedValue({
      user: {
        termsVersion: TERMS_VERSION,
        id: "user_1",
        plan: "essential",
        freePeriodStartsAt: new Date(),
        clinic: { id: "clinic_1", writable: true },
      },
    });
  });

  it("updates the active clinic's details", async () => {
    const result = await updateClinic({
      name: "Clínica Centro",
      address: "Rua A, 10",
      phoneNumber: "11999999999",
    });

    expect(result?.serverError).toBeUndefined();
    expect(mocks.set).toHaveBeenCalledWith({
      name: "Clínica Centro",
      address: "Rua A, 10",
      phoneNumber: "11999999999",
      brandColor: undefined,
      logoDataUrl: undefined,
      logoUpdatedAt: undefined,
    });
  });

  it("stores empty optional fields as null", async () => {
    await updateClinic({
      name: "Centro",
      address: "",
      phoneNumber: "",
      brandColor: "",
      logoDataUrl: "",
    });

    expect(mocks.set).toHaveBeenCalledWith({
      name: "Centro",
      address: null,
      phoneNumber: null,
      brandColor: null,
      logoDataUrl: null,
      logoUpdatedAt: expect.any(Date),
    });
  });

  it("keeps the branding when a call leaves it out", async () => {
    await updateClinic({ name: "Centro" });

    // Drizzle leaves undefined columns out of the UPDATE.
    expect(mocks.set).toHaveBeenCalledWith({
      name: "Centro",
      address: undefined,
      phoneNumber: undefined,
      brandColor: undefined,
      logoDataUrl: undefined,
      logoUpdatedAt: undefined,
    });
  });

  it("refuses to edit a clinic that is read-only on the plan", async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        termsVersion: TERMS_VERSION,
        id: "user_1",
        plan: "essential",
        freePeriodStartsAt: new Date(),
        clinic: { id: "clinic_3", writable: false },
      },
    });

    const result = await updateClinic({ name: "Sul" });

    expect(result?.serverError).toContain("só leitura");
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("stores the brand color and logo", async () => {
    const result = await updateClinic({
      name: "Centro",
      brandColor: "#16A34A",
      logoDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    });

    expect(result?.serverError).toBeUndefined();
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        brandColor: "#16a34a",
        logoDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      }),
    );
  });

  it("refuses an SVG logo and a malformed color", async () => {
    const svg = await updateClinic({
      name: "Centro",
      logoDataUrl: "data:image/svg+xml;base64,PHN2Zz4=",
    });
    const color = await updateClinic({ name: "Centro", brandColor: "red" });

    expect(svg?.validationErrors?.logoDataUrl).toBeDefined();
    expect(color?.validationErrors?.brandColor).toBeDefined();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("keeps accepting an incomplete phone saved before the check existed", async () => {
    mocks.findFirst.mockResolvedValue({ phoneNumber: "1199" });

    const result = await updateClinic({ name: "Centro", phoneNumber: "1199" });

    expect(result?.serverError).toBeUndefined();
    expect(mocks.set).toHaveBeenCalled();
  });

  it("refuses a new incomplete phone", async () => {
    mocks.findFirst.mockResolvedValue({ phoneNumber: "1199" });

    const result = await updateClinic({ name: "Centro", phoneNumber: "1198" });

    expect(result?.serverError).toBe("Telefone inválido.");
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
