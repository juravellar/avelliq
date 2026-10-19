import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { auth } from "./auth";

describe("auth user fields", () => {
  it("accepts none of the extra user fields from the browser", () => {
    const fields = auth.options.user.additionalFields;
    for (const [name, field] of Object.entries(fields)) {
      expect({ name, input: field.input }).toEqual({ name, input: false });
    }
  });
});
