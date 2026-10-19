import { describe, expect, it } from "vitest";

import {
  senderKey,
  SUPPORT_LIMIT,
  takeSupportSlot,
  trackedSenders,
} from "./rate-limit";

describe("takeSupportSlot", () => {
  it("allows a few messages an hour per sender, then waits", () => {
    const start = 1_000_000;
    for (let i = 0; i < SUPPORT_LIMIT.max; i++) {
      expect(takeSupportSlot("a", start + i)).not.toBeNull();
    }
    expect(takeSupportSlot("a", start + 10)).toBeNull();
    expect(takeSupportSlot("b", start + 10)).not.toBeNull();
    expect(
      takeSupportSlot("a", start + SUPPORT_LIMIT.windowMs + 1),
    ).not.toBeNull();
  });

  it("gives the slot back when the message wasn't sent", () => {
    const start = 2_000_000;
    for (let i = 0; i < SUPPORT_LIMIT.max; i++) {
      takeSupportSlot("c", start + i)?.();
    }
    expect(takeSupportSlot("c", start + 10)).not.toBeNull();
  });

  it("forgets senders whose messages expired", () => {
    const start = 3_000_000;
    for (let i = 0; i < 1000; i++) {
      takeSupportSlot(`ip-${i}`, start);
    }
    takeSupportSlot("late", start + SUPPORT_LIMIT.windowMs + 1);
    expect(trackedSenders()).toBeLessThan(10);
  });
});

describe("senderKey", () => {
  it("prefers the account, then the proxy's IP, then forwarded-for", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.1",
      "x-forwarded-for": "6.6.6.6, 198.51.100.1",
    });
    expect(senderKey("user_1", headers)).toBe("user_1");
    expect(senderKey(undefined, headers)).toBe("198.51.100.1");
    expect(
      senderKey(undefined, new Headers({ "x-forwarded-for": "203.0.113.7" })),
    ).toBe("203.0.113.7");
    expect(senderKey(undefined, new Headers())).toBe("anonymous");
  });
});
