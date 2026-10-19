import { afterEach, describe, expect, it, vi } from "vitest";

import { isSupportAdmin } from "./admin";

describe("isSupportAdmin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts listed, confirmed e-mails, ignoring case and spaces", () => {
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", " Equipe@Avelliq.com , outra@x.com");
    expect(
      isSupportAdmin({ email: "equipe@avelliq.com", emailVerified: true }),
    ).toBe(true);
    expect(isSupportAdmin({ email: "OUTRA@x.com", emailVerified: true })).toBe(
      true,
    );
  });

  it("refuses everyone else, unconfirmed e-mails and an empty list", () => {
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "equipe@avelliq.com");
    expect(isSupportAdmin({ email: "x@y.com", emailVerified: true })).toBe(
      false,
    );
    expect(
      isSupportAdmin({ email: "equipe@avelliq.com", emailVerified: false }),
    ).toBe(false);
    expect(isSupportAdmin(null)).toBe(false);
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "");
    expect(
      isSupportAdmin({ email: "equipe@avelliq.com", emailVerified: true }),
    ).toBe(false);
  });
});
