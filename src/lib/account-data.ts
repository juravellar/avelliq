import { and, eq, inArray, ne } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import type { Transaction } from "@/db/clinic-lock";
import {
  appointmentsTable,
  clinicsTable,
  doctorsTable,
  patientsTable,
  usersTable,
  usersToClinicsTable,
} from "@/db/schema";
import { stripeClient } from "@/lib/stripe-client";
import type { StripeMode } from "@/lib/stripe-mode";
import { listCustomerSubscriptions } from "@/lib/stripe-subscription-sync";

/**
 * Everything the app stores about the user and their clinics, for the
 * portability right (LGPD art. 18, V). Internal ids are kept so the records
 * can be related; secrets (password hashes, tokens) are not part of it.
 */
export const collectAccountData = async (userId: string) => {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });
  if (!user) {
    return null;
  }
  const memberships = await db.query.usersToClinicsTable.findMany({
    where: eq(usersToClinicsTable.userId, userId),
    with: { clinic: true },
  });
  const clinicIds = memberships.map(({ clinicId }) => clinicId);
  const [doctors, patients, appointments] = clinicIds.length
    ? await Promise.all([
        db.query.doctorsTable.findMany({
          where: inArray(doctorsTable.clinicId, clinicIds),
        }),
        db.query.patientsTable.findMany({
          where: inArray(patientsTable.clinicId, clinicIds),
        }),
        db.query.appointmentsTable.findMany({
          where: inArray(appointmentsTable.clinicId, clinicIds),
        }),
      ])
    : [[], [], []];

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionEndsAt: user.subscriptionEndsAt,
      termsVersion: user.termsVersion,
      termsAcceptedAt: user.termsAcceptedAt,
      createdAt: user.createdAt,
    },
    clinics: memberships.map(({ clinic }) => ({
      ...clinic,
      doctors: doctors.filter(({ clinicId }) => clinicId === clinic.id),
      patients: patients.filter(({ clinicId }) => clinicId === clinic.id),
      appointments: appointments.filter(
        ({ clinicId }) => clinicId === clinic.id,
      ),
    })),
  };
};

// Statuses that still bill or could bill again; the rest are already over.
const BILLABLE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

/** Cancels, immediately, every subscription that could still charge. */
export const cancelBillableSubscriptions = async (
  customerId: string,
  mode: StripeMode = "live",
) => {
  const stripe = stripeClient(mode);
  const subscriptions = await listCustomerSubscriptions(stripe, customerId);
  for (const subscription of subscriptions) {
    if (BILLABLE_STATUSES.has(subscription.status)) {
      await stripe.subscriptions.cancel(subscription.id);
    }
  }
};

/**
 * Deletes the user and the clinics no one else belongs to. Doctors, patients
 * and appointments go with their clinic (on delete cascade), sessions and
 * linked logins with the user. Returns how many clinics were deleted.
 */
export const deleteAccountData = async (tx: Transaction, userId: string) => {
  const memberships = await tx.query.usersToClinicsTable.findMany({
    where: eq(usersToClinicsTable.userId, userId),
  });
  const clinicIds = memberships.map(({ clinicId }) => clinicId);
  const sharedClinics = clinicIds.length
    ? await tx
        .selectDistinct({ clinicId: usersToClinicsTable.clinicId })
        .from(usersToClinicsTable)
        .where(
          and(
            inArray(usersToClinicsTable.clinicId, clinicIds),
            ne(usersToClinicsTable.userId, userId),
          ),
        )
    : [];
  const ownClinicIds = clinicIds.filter(
    (id) => !sharedClinics.some(({ clinicId }) => clinicId === id),
  );
  if (ownClinicIds.length) {
    await tx.delete(clinicsTable).where(inArray(clinicsTable.id, ownClinicIds));
  }
  await tx.delete(usersTable).where(eq(usersTable.id, userId));
  return ownClinicIds.length;
};
