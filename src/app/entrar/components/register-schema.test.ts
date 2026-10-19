import { describe, expect, it } from "vitest";

import { registerSchema } from "./register-schema";

const valid = {
  username: "Ana",
  email: "ana@example.com",
  password: "senha-forte-1",
  confirmPassword: "senha-forte-1",
  acceptTerms: true as const,
};

describe("registerSchema", () => {
  it("accepts matching passwords", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("flags a confirmation that differs, on the confirmation field", () => {
    const result = registerSchema.safeParse({
      ...valid,
      confirmPassword: "senha-forte-2",
    });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["confirmPassword"],
      message: "As senhas não são iguais",
    });
  });

  it("treats spaces as part of the password", () => {
    expect(
      registerSchema.safeParse({ ...valid, confirmPassword: "senha-forte-1 " })
        .success,
    ).toBe(false);
  });
});
