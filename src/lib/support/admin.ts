import { STAFF_PLAN } from "@/lib/plans";

// Avelliq owners, by the e-mail they sign in with. Listed in
// SUPPORT_ADMIN_EMAILS (comma-separated) on the server, never in the code: the
// repository is public.
const supportOwners = () =>
  (process.env.SUPPORT_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

// In the order the Contas page offers them.
export const STAFF_ROLES = ["support", "qa", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_NAMES: Record<StaffRole, string> = {
  support: "Suporte",
  qa: "QA",
  admin: "Admin",
};

interface StaffCandidate {
  email: string;
  emailVerified?: boolean | null;
  staffRole?: string | null;
}

const isOwnerEmail = (email: string) =>
  supportOwners().includes(email.trim().toLowerCase());

const isStaffRole = (value: unknown): value is StaffRole =>
  STAFF_ROLES.includes(value as StaffRole);

// Only a confirmed address counts, so nobody can claim an owner's e-mail by
// signing up with it before the owner does.
export const isSupportOwner = (user: StaffCandidate | null | undefined) =>
  !!user && user.emailVerified === true && isOwnerEmail(user.email);

// The role an account works with: owners count as admins and more.
const roleOf = (
  user: StaffCandidate | null | undefined,
): StaffRole | "owner" | null => {
  if (!user || user.emailVerified !== true) {
    return null;
  }
  if (isOwnerEmail(user.email)) {
    return "owner";
  }
  return isStaffRole(user.staffRole) ? user.staffRole : null;
};

// Owners, admins and support use the whole system without a plan. They can
// still subscribe; the limits just don't apply to them. QA lives by the plan
// like a customer, since testing the plans is part of the job.
export const isPlanExempt = (user: StaffCandidate | null | undefined) => {
  const role = roleOf(user);
  return role !== null && role !== "qa";
};

// QA picks which plan to test with, without paying (see sessionPlans).
export const canSimulatePlan = (user: StaffCandidate | null | undefined) =>
  roleOf(user) === "qa";

// The session's plans: `plan` sets the limits everywhere (actions, banners,
// free period), and for the team it is the unlimited one; subscribedPlan is
// the one the billing pages show. For QA both are the simulated plan, so the
// whole system behaves as it would for a customer on it.
export const sessionPlans = (
  user: StaffCandidate & { plan?: string | null; qaPlan?: string | null },
) => {
  const planExempt = isPlanExempt(user);
  const simulatedPlan = canSimulatePlan(user) ? (user.qaPlan ?? null) : null;
  const subscribedPlan = simulatedPlan ?? user.plan ?? null;
  return {
    plan: planExempt ? STAFF_PLAN : subscribedPlan,
    subscribedPlan,
    simulatedPlan,
    planExempt,
  };
};

// Who opens the Atendimento: the whole team. QA only looks.
export const canSeeSupportInbox = (user: StaffCandidate | null | undefined) =>
  roleOf(user) !== null;

// Who answers customers: everyone but QA, whose replies would reach real
// people.
export const canAnswerSupport = (user: StaffCandidate | null | undefined) => {
  const role = roleOf(user);
  return role !== null && role !== "qa";
};

// Who opens the Contas page: owners, admins and QA. Changing roles is
// rolesManagedBy's, and QA manages none.
export const canSeeAccounts = (user: StaffCandidate | null | undefined) => {
  const role = roleOf(user);
  return role === "owner" || role === "admin" || role === "qa";
};

// The roles someone may give or take away: owners choose every role, admins
// all but admin.
export const rolesManagedBy = (
  user: StaffCandidate | null | undefined,
): StaffRole[] => {
  const role = roleOf(user);
  if (role === "owner") {
    return [...STAFF_ROLES];
  }
  return role === "admin" ? ["support", "qa"] : [];
};

// Whether `viewer` may change `account`'s role at all: never an owner's, and
// an admin's only when the viewer is an owner.
export const canChangeRole = (
  viewer: StaffCandidate | null | undefined,
  account: StaffCandidate,
) => {
  if (isSupportOwner(account)) {
    return false;
  }
  const managed = rolesManagedBy(viewer);
  const current = account.staffRole;
  return (
    managed.length > 0 && (!isStaffRole(current) || managed.includes(current))
  );
};
