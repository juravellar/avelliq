import { freePeriodDaysLeft, isReadOnly } from "@/lib/free-period";
import { isPaidPlan, resolvePlan } from "@/lib/plans";

// Remaining free days are only highlighted near the end, to avoid nagging.
const WARNING_DAYS = 14;

export type AccountStatus =
  | { kind: "payment-failed"; planName: string }
  | { kind: "clinic-read-only"; clinicLimit: number }
  | { kind: "choose-clinics"; clinicCount: number; clinicLimit: number }
  | { kind: "subscription-ending"; planName: string; endsAt: Date }
  | { kind: "free-period-over" }
  | { kind: "free-period-ending"; daysLeft: number }
  | null;

// The most urgent thing the user should know about their plan, if any.
export const accountStatus = (
  user: {
    plan?: string | null;
    subscriptionStatus?: string | null;
    subscriptionEndsAt?: Date | string | null;
    freePeriodStartsAt?: Date | string | null;
    clinic?: { id?: string; writable?: boolean } | null;
    clinics?: unknown[];
    clinicLimit?: number | null;
    overClinicLimit?: boolean;
    clinicChoiceMadeAt?: Date | string | null;
    planExempt?: boolean;
  },
  now: Date = new Date(),
): AccountStatus => {
  // Avelliq's team doesn't depend on a plan, so no plan warning applies. The
  // session's plan isn't the one they pay for either.
  if (!user.clinic || user.planExempt) {
    return null;
  }
  const paid = isPaidPlan(user.plan);
  if (paid && user.subscriptionStatus === "past_due") {
    return { kind: "payment-failed", planName: resolvePlan(user.plan).name };
  }
  const clinicLimit = user.clinicLimit ?? null;
  if (clinicLimit !== null && user.clinic.writable === false) {
    return { kind: "clinic-read-only", clinicLimit };
  }
  if (
    clinicLimit !== null &&
    user.overClinicLimit &&
    !user.clinicChoiceMadeAt
  ) {
    return {
      kind: "choose-clinics",
      clinicCount: user.clinics?.length ?? 0,
      clinicLimit,
    };
  }
  if (paid) {
    const planName = resolvePlan(user.plan).name;
    if (user.subscriptionEndsAt) {
      return {
        kind: "subscription-ending",
        planName,
        endsAt: new Date(user.subscriptionEndsAt),
      };
    }
    return null;
  }
  const freePeriodStartsAt = user.freePeriodStartsAt ?? undefined;
  if (isReadOnly(user.plan, freePeriodStartsAt, now)) {
    return { kind: "free-period-over" };
  }
  const daysLeft = freePeriodDaysLeft(freePeriodStartsAt, now);
  return daysLeft <= WARNING_DAYS
    ? { kind: "free-period-ending", daysLeft }
    : null;
};
