import { describe, expect, it } from "vitest";

import { accountStatus } from "./account-status";

const NOW = new Date("2027-01-01T12:00:00Z");
const recentClinic = { id: "clinic_1" };
const recentStart = new Date("2026-12-20T12:00:00Z");

describe("accountStatus", () => {
  it("warns about a failed payment first", () => {
    expect(
      accountStatus(
        {
          plan: "essential",
          subscriptionStatus: "past_due",
          subscriptionEndsAt: "2027-01-20T03:00:00Z",
          clinic: recentClinic,
          freePeriodStartsAt: recentStart,
        },
        NOW,
      ),
    ).toEqual({ kind: "payment-failed", planName: "Essencial" });
  });

  it("shows nothing to Avelliq's team, even with a failed payment", () => {
    expect(
      accountStatus(
        {
          plan: "professional",
          subscriptionStatus: "past_due",
          subscriptionEndsAt: "2027-01-20T03:00:00Z",
          clinic: recentClinic,
          freePeriodStartsAt: recentStart,
          planExempt: true,
        },
        NOW,
      ),
    ).toBeNull();
  });

  it("says when a canceled subscription ends", () => {
    expect(
      accountStatus(
        {
          plan: "professional",
          subscriptionStatus: "active",
          subscriptionEndsAt: "2027-01-20T03:00:00Z",
          clinic: recentClinic,
          freePeriodStartsAt: recentStart,
        },
        NOW,
      ),
    ).toEqual({
      kind: "subscription-ending",
      planName: "Profissional",
      endsAt: new Date("2027-01-20T03:00:00Z"),
    });
  });

  it("shows nothing for a paid plan that renews normally", () => {
    expect(
      accountStatus(
        {
          plan: "essential",
          subscriptionStatus: "active",
          clinic: recentClinic,
          freePeriodStartsAt: recentStart,
        },
        NOW,
      ),
    ).toBeNull();
  });

  it("tells a Free clinic its period is over", () => {
    expect(
      accountStatus(
        {
          plan: null,
          clinic: { id: "clinic_1" },
          freePeriodStartsAt: "2026-11-15T12:00:00Z",
        },
        new Date("2027-03-01T12:00:00Z"),
      ),
    ).toEqual({ kind: "free-period-over" });
  });

  it("warns only in the last 14 free days", () => {
    const clinic = { id: "clinic_1" };
    const freePeriodStartsAt = "2026-11-15T12:00:00Z"; // ends 2027-02-15
    expect(
      accountStatus(
        { plan: null, clinic, freePeriodStartsAt },
        new Date("2027-01-15T12:00:00Z"),
      ),
    ).toBeNull();
    expect(
      accountStatus(
        { plan: null, clinic, freePeriodStartsAt },
        new Date("2027-02-05T12:00:00Z"),
      ),
    ).toEqual({ kind: "free-period-ending", daysLeft: 10 });
  });

  it("shows nothing before the user has a clinic", () => {
    expect(accountStatus({ plan: null }, NOW)).toBeNull();
  });

  it("warns when the open clinic is read-only on the plan", () => {
    expect(
      accountStatus(
        {
          plan: "essential",
          subscriptionStatus: "active",
          clinic: { id: "sul", writable: false },
          clinics: [{}, {}, {}],
          clinicLimit: 2,
          overClinicLimit: true,
          clinicChoiceMadeAt: "2026-12-01T00:00:00Z",
          freePeriodStartsAt: recentStart,
        },
        NOW,
      ),
    ).toEqual({ kind: "clinic-read-only", clinicLimit: 2 });
  });

  it("asks to choose clinics after a downgrade, even on Free", () => {
    expect(
      accountStatus(
        {
          plan: null,
          clinic: { id: "centro", writable: true },
          clinics: [{}, {}, {}],
          clinicLimit: 1,
          overClinicLimit: true,
          clinicChoiceMadeAt: null,
          freePeriodStartsAt: recentStart,
        },
        NOW,
      ),
    ).toEqual({ kind: "choose-clinics", clinicCount: 3, clinicLimit: 1 });
  });

  it("stops asking once the user has chosen", () => {
    expect(
      accountStatus(
        {
          plan: "essential",
          subscriptionStatus: "active",
          clinic: { id: "centro", writable: true },
          clinics: [{}, {}, {}],
          clinicLimit: 2,
          overClinicLimit: true,
          clinicChoiceMadeAt: "2026-12-01T00:00:00Z",
          freePeriodStartsAt: recentStart,
        },
        NOW,
      ),
    ).toBeNull();
  });
});
