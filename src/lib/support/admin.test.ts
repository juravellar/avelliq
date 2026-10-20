import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canAnswerSupport,
  canChangeRole,
  canSeeAccounts,
  canSeeSupportInbox,
  canSimulatePlan,
  isPlanExempt,
  isSupportOwner,
  rolesManagedBy,
  sessionPlans,
} from "./admin";

const owner = { email: "equipe@avelliq.com", emailVerified: true };
const admin = { email: "a@y.com", emailVerified: true, staffRole: "admin" };
const support = { email: "s@y.com", emailVerified: true, staffRole: "support" };
const qa = { email: "q@y.com", emailVerified: true, staffRole: "qa" };
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

  const everyone = [owner, admin, support, qa, customer];

  it("shows the Atendimento to the whole team, but QA doesn't answer", () => {
    expect(everyone.map(canSeeSupportInbox)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(everyone.map(canAnswerSupport)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it("frees the team from plan limits, except QA, who simulates plans", () => {
    expect(everyone.map(isPlanExempt)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(everyone.map(canSimulatePlan)).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(isPlanExempt({ ...support, emailVerified: false })).toBe(false);
    expect(canSimulatePlan({ ...qa, emailVerified: false })).toBe(false);
  });

  it("shows the accounts to owners, admins and QA", () => {
    expect(everyone.map(canSeeAccounts)).toEqual([
      true,
      true,
      false,
      true,
      false,
    ]);
  });

  it("lets owners choose every role, admins support and QA", () => {
    expect(rolesManagedBy(owner)).toEqual(["support", "qa", "admin"]);
    expect(rolesManagedBy(admin)).toEqual(["support", "qa"]);
    expect(rolesManagedBy(support)).toEqual([]);
    expect(rolesManagedBy(qa)).toEqual([]);
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
    expect(canChangeRole(admin, qa)).toBe(true);
    expect(canChangeRole(admin, customer)).toBe(true);
    expect(canChangeRole(admin, otherAdmin)).toBe(false);
    expect(canChangeRole(admin, admin)).toBe(false);
    expect(canChangeRole(admin, owner)).toBe(false);

    expect(canChangeRole(support, customer)).toBe(false);
    expect(canChangeRole(qa, customer)).toBe(false);
    expect(canChangeRole(customer, customer)).toBe(false);
    expect(canChangeRole(undefined, customer)).toBe(false);
  });

  it("gives the team the unlimited plan and keeps the one they pay for", () => {
    expect(sessionPlans({ ...owner, plan: "essential" })).toEqual({
      plan: "professional",
      subscribedPlan: "essential",
      simulatedPlan: null,
      planExempt: true,
    });
    expect(sessionPlans({ ...customer, plan: "essential" })).toEqual({
      plan: "essential",
      subscribedPlan: "essential",
      simulatedPlan: null,
      planExempt: false,
    });
    expect(
      sessionPlans({ ...support, emailVerified: false, plan: null }),
    ).toEqual({
      plan: null,
      subscribedPlan: null,
      simulatedPlan: null,
      planExempt: false,
    });
  });

  it("gives QA the simulated plan everywhere, or its real one", () => {
    expect(sessionPlans({ ...qa, plan: null, qaPlan: "essential" })).toEqual({
      plan: "essential",
      subscribedPlan: "essential",
      simulatedPlan: "essential",
      planExempt: false,
    });
    expect(sessionPlans({ ...qa, plan: "professional", qaPlan: null })).toEqual(
      {
        plan: "professional",
        subscribedPlan: "professional",
        simulatedPlan: null,
        planExempt: false,
      },
    );
    // A simulated plan left behind after the QA role was removed is ignored.
    expect(
      sessionPlans({ ...customer, plan: null, qaPlan: "professional" }),
    ).toMatchObject({ plan: null, simulatedPlan: null });
  });

  it("ignores roles of unconfirmed e-mails and unknown roles", () => {
    expect(canSeeSupportInbox({ ...admin, emailVerified: false })).toBe(false);
    expect(canSeeAccounts({ ...admin, emailVerified: false })).toBe(false);
    expect(canSeeSupportInbox({ ...customer, staffRole: "root" })).toBe(false);
  });
});
