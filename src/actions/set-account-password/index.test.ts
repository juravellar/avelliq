import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  setPassword: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: mocks.getSession, setPassword: mocks.setPassword },
  },
}));

import { setAccountPassword } from ".";

describe("setAccountPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "u1" } });
    mocks.setPassword.mockResolvedValue({ status: true });
  });

  it("sets the password for the signed-in user", async () => {
    const result = await setAccountPassword({ newPassword: "segredo123" });
    expect(result?.data).toEqual({ set: true });
    expect(mocks.setPassword).toHaveBeenCalledWith(
      expect.objectContaining({ body: { newPassword: "segredo123" } }),
    );
  });

  it("refuses short passwords before calling Better Auth", async () => {
    const result = await setAccountPassword({ newPassword: "curta" });
    expect(result?.validationErrors?.newPassword?._errors?.[0]).toBe(
      "Use pelo menos 8 caracteres.",
    );
    expect(mocks.setPassword).not.toHaveBeenCalled();
  });

  it("explains an old sign-in instead of a generic error", async () => {
    mocks.setPassword.mockRejectedValue(
      new APIError("FORBIDDEN", {
        code: "SESSION_NOT_FRESH",
        message: "Session is not fresh",
      }),
    );
    const result = await setAccountPassword({ newPassword: "segredo123" });
    expect(result?.serverError).toMatch(/saia e entre de novo/);
  });
});
