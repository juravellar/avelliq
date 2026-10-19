import { afterEach, describe, expect, it, vi } from "vitest";

import { isOwnerEmail, isSupportAdmin, isSupportOwner } from "./admin";

describe("isSupportOwner", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts listed, confirmed e-mails, ignoring case and spaces", () => {
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", " Equipe@Avelliq.com , outra@x.com");
    expect(
      isSupportOwner({ email: "equipe@avelliq.com", emailVerified: true }),
    ).toBe(true);
    expect(isSupportOwner({ email: "OUTRA@x.com", emailVerified: true })).toBe(
      true,
    );
    expect(isOwnerEmail(" outra@X.com")).toBe(true);
  });

  it("refuses everyone else, unconfirmed e-mails and an empty list", () => {
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "equipe@avelliq.com");
    expect(isSupportOwner({ email: "x@y.com", emailVerified: true })).toBe(
      false,
    );
    expect(
      isSupportOwner({ email: "equipe@avelliq.com", emailVerified: false }),
    ).toBe(false);
    expect(isSupportOwner(null)).toBe(false);
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "");
    expect(
      isSupportOwner({ email: "equipe@avelliq.com", emailVerified: true }),
    ).toBe(false);
  });
});

describe("isSupportAdmin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts owners and confirmed accounts marked as admin", () => {
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "equipe@avelliq.com");
    expect(
      isSupportAdmin({ email: "equipe@avelliq.com", emailVerified: true }),
    ).toBe(true);
    expect(
      isSupportAdmin({
        email: "x@y.com",
        emailVerified: true,
        supportAdmin: true,
      }),
    ).toBe(true);
  });

  it("refuses admins with an unconfirmed e-mail and everyone else", () => {
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "");
    expect(
      isSupportAdmin({
        email: "x@y.com",
        emailVerified: false,
        supportAdmin: true,
      }),
    ).toBe(false);
    expect(
      isSupportAdmin({
        email: "x@y.com",
        emailVerified: true,
        supportAdmin: false,
      }),
    ).toBe(false);
    expect(isSupportAdmin(undefined)).toBe(false);
  });
});
