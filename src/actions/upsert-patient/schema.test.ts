import { describe, expect, it } from "vitest";

import { upsertPatientSchema } from "./schema";

const valid = {
  name: "Ana",
  email: "ana@clinica.com",
  phoneNumber: "11999999999",
  sex: "female",
};

describe("upsertPatientSchema", () => {
  it("limits the name to 120 characters", () => {
    expect(
      upsertPatientSchema.safeParse({ ...valid, name: "a".repeat(120) })
        .success,
    ).toBe(true);
    expect(
      upsertPatientSchema.safeParse({ ...valid, name: "a".repeat(121) })
        .success,
    ).toBe(false);
  });
});
