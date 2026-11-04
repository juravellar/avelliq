import { afterEach, describe, expect, it, vi } from "vitest";

import { isFreshSession } from "./fresh-session";

describe("isFreshSession", () => {
  afterEach(() => vi.useRealTimers());

  it("accepts a session created in the last 10 minutes", () => {
    vi.useFakeTimers({ now: new Date("2026-01-01T12:00:00Z") });
    expect(
      isFreshSession({ createdAt: new Date("2026-01-01T11:55:00Z") }),
    ).toBe(true);
  });

  it("refuses an older, missing or unreadable session", () => {
    vi.useFakeTimers({ now: new Date("2026-01-01T12:00:00Z") });
    expect(
      isFreshSession({ createdAt: new Date("2026-01-01T11:49:00Z") }),
    ).toBe(false);
    expect(isFreshSession({})).toBe(false);
    expect(isFreshSession(null)).toBe(false);
    expect(isFreshSession({ createdAt: "not a date" })).toBe(false);
  });
});
