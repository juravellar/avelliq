import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

import { clinicWriteActionClient } from "./clinic-action";
import { TERMS_VERSION } from "./terms";

const write = clinicWriteActionClient.action(async () => "saved");

const user = (termsVersion: string | null) => ({
  plan: "essential",
  clinic: { id: "clinic_1" },
  termsVersion,
});

describe("clinicWriteActionClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("refuses writes until the current terms are accepted", async () => {
    mocks.getSession.mockResolvedValue({ user: user("2020-01-01") });
    expect((await write())?.serverError).toBe(
      "Aceite os novos Termos de Uso e a Política de Privacidade para continuar.",
    );

    mocks.getSession.mockResolvedValue({ user: user(null) });
    expect((await write())?.serverError).toContain("Aceite os novos Termos");
  });

  it("lets a user who accepted the current terms write", async () => {
    mocks.getSession.mockResolvedValue({ user: user(TERMS_VERSION) });
    expect((await write())?.data).toBe("saved");
  });
});
