import { describe, expect, it } from "vitest";

import { allowSupportRequest, SUPPORT_LIMIT } from "./rate-limit";

describe("allowSupportRequest", () => {
  it("allows a few messages an hour per sender, then waits", () => {
    const start = 1_000_000;
    for (let i = 0; i < SUPPORT_LIMIT.max; i++) {
      expect(allowSupportRequest("a", start + i)).toBe(true);
    }
    expect(allowSupportRequest("a", start + 10)).toBe(false);
    expect(allowSupportRequest("b", start + 10)).toBe(true);
    expect(allowSupportRequest("a", start + SUPPORT_LIMIT.windowMs + 1)).toBe(
      true,
    );
  });
});
