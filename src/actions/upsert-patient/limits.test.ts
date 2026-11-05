import { describe, expect, it } from "vitest";

import { PATIENT_LIMITS, upsertPatientSchema } from "./schema";

const base = {
  name: "Ana",
  email: "ana@exemplo.com",
  phoneNumber: "11988887777",
  sex: "female" as const,
};

describe("patient field limits", () => {
  it("accepts each field at its limit and refuses one character more", () => {
    for (const [field, max] of Object.entries(PATIENT_LIMITS)) {
      if (field === "email") continue;
      const at = upsertPatientSchema.safeParse({
        ...base,
        [field]: "a".repeat(max),
      });
      const over = upsertPatientSchema.safeParse({
        ...base,
        [field]: "a".repeat(max + 1),
      });
      expect(at.success, `${field} at ${max}`).toBe(true);
      expect(over.success, `${field} over ${max}`).toBe(false);
    }
  });

  it("limits the e-mail to 254 characters", () => {
    const local = "a".repeat(64);
    const domain = `${"b".repeat(60)}.${"c".repeat(60)}.${"d".repeat(60)}.com`;
    expect(
      upsertPatientSchema.safeParse({ ...base, email: `${local}@${domain}` })
        .success,
    ).toBe(`${local}@${domain}`.length <= PATIENT_LIMITS.email);
  });
});
