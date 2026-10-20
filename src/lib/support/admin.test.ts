import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canChangeRole,
  canManageAccounts,
  isSupportOwner,
  isSupportStaff,
  rolesManagedBy,
} from "./admin";

const owner = { email: "equipe@avelliq.com", emailVerified: true };
const admin = { email: "a@y.com", emailVerified: true, staffRole: "admin" };
const support = { email: "s@y.com", emailVerified: true, staffRole: "support" };
const customer = { email: "c@y.com", emailVerified: true, staffRole: null };

describe("isSupportOwner", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts listed, confirmed e-mails, ignoring case and spaces", () => {
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", " Equipe@Avelliq.com , outra@x.com");
    expect(isSupportOwner(owner)).toBe(true);
    expect(isSupportOwner({ email: "OUTRA@x.com", emailVerified: true })).toBe(
      true,
    );
  });

  it("refuses everyone else, unconfirmed e-mails and an empty list", () => {
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "equipe@avelliq.com");
    expect(isSupportOwner(admin)).toBe(false);
    expect(isSupportOwner({ ...owner, emailVerified: false })).toBe(false);
    expect(isSupportOwner(null)).toBe(false);
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "");
    expect(isSupportOwner(owner)).toBe(false);
  });
});

describe("team roles", () => {
  beforeEach(() => vi.stubEnv("SUPPORT_ADMIN_EMAILS", "equipe@avelliq.com"));
  afterEach(() => vi.unstubAllEnvs());

  it("lets the whole team answer support mail", () => {
    expect([owner, admin, support, customer].map(isSupportStaff)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("shows the accounts to owners and admins only", () => {
    expect([owner, admin, support, customer].map(canManageAccounts)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("lets owners choose admins and support, admins only support", () => {
    expect(rolesManagedBy(owner)).toEqual(["support", "admin"]);
    expect(rolesManagedBy(admin)).toEqual(["support"]);
    expect(rolesManagedBy(support)).toEqual([]);
    expect(rolesManagedBy(customer)).toEqual([]);
    expect(rolesManagedBy(undefined)).toEqual([]);
  });

  it("lets owners change anyone but owners, admins only support and others", () => {
    const otherAdmin = { ...admin, email: "b@y.com" };
    expect(canChangeRole(owner, admin)).toBe(true);
    expect(canChangeRole(owner, support)).toBe(true);
    expect(canChangeRole(owner, customer)).toBe(true);
    expect(canChangeRole(owner, owner)).toBe(false);

    expect(canChangeRole(admin, support)).toBe(true);
    expect(canChangeRole(admin, customer)).toBe(true);
    expect(canChangeRole(admin, otherAdmin)).toBe(false);
    expect(canChangeRole(admin, admin)).toBe(false);
    expect(canChangeRole(admin, owner)).toBe(false);

    expect(canChangeRole(support, customer)).toBe(false);
    expect(canChangeRole(customer, customer)).toBe(false);
    expect(canChangeRole(undefined, customer)).toBe(false);
  });

  it("ignores roles of unconfirmed e-mails and unknown roles", () => {
    expect(isSupportStaff({ ...admin, emailVerified: false })).toBe(false);
    expect(canManageAccounts({ ...admin, emailVerified: false })).toBe(false);
    expect(isSupportStaff({ ...customer, staffRole: "root" })).toBe(false);
  });
});
