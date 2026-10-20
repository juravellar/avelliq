import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { usersTable } from "@/db/schema";
import { resolveClinicAccess } from "@/lib/clinic-access";
import {
  isEmailConfigured,
  resetPasswordEmail,
  sendEmail,
  verificationEmail,
} from "@/lib/email";
import { STAFF_PLAN } from "@/lib/plans";
import {
  loadSessionMemberships,
  sessionBranding,
} from "@/lib/session-memberships";
import { isPlanExempt } from "@/lib/support/admin";
import { ACCEPT_TERMS_HEADER, termsAcceptanceForNewUser } from "@/lib/terms";

export const auth = betterAuth({
  advanced: {
    // Emails are sent after the response. Awaiting them made a password reset
    // for an existing account answer later than one for an unknown email,
    // which told an attacker which emails have accounts.
    backgroundTasks: { handler: (task) => after(task) },
  },
  // Model names below are the exact schema keys (usersTable, ...), so no
  // pluralization: better-auth 1.7 would turn them into usersTables and fail
  // its schema check on every auth request.
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [
    customSession(async ({ user, session }) => {
      const [userData, memberships] = await Promise.all([
        db.query.usersTable.findFirst({
          where: eq(usersTable.id, user.id),
        }),
        loadSessionMemberships(user.id),
      ]);
      // With the cookie cache, a deleted account's cookie still looks valid
      // until it expires; the database has the final word. null is the same
      // "no session" answer as a request without cookies; `as never` keeps the
      // session type inferred from the branch below.
      if (!userData) {
        return null as never;
      }
      // `plan` is what sets the limits everywhere (actions, banners, free
      // period). Avelliq's team has none; what they really subscribe to stays
      // in subscribedPlan, for the billing pages.
      const planExempt = isPlanExempt(userData);
      const plan = planExempt ? STAFF_PLAN : userData.plan;
      const access = resolveClinicAccess(
        memberships.map((membership) => ({
          clinicId: membership.clinicId,
          name: membership.clinic.name,
          clinicCreatedAt: membership.clinic.createdAt,
          memberSince: membership.createdAt,
          keptInPlan: membership.keptInPlan,
        })),
        userData.activeClinicId,
        plan,
      );
      return {
        user: {
          ...user,
          plan,
          subscribedPlan: userData.plan,
          planExempt,
          subscriptionStatus: userData?.subscriptionStatus,
          subscriptionEndsAt: userData?.subscriptionEndsAt,
          clinic: access.active ?? undefined,
          clinics: access.clinics,
          clinicLimit: access.clinicLimit,
          overClinicLimit: access.overClinicLimit,
          freePeriodStartsAt: access.freePeriodStartsAt,
          clinicChoiceMadeAt: userData?.clinicChoiceMadeAt ?? null,
          clinicChoiceChangedAt: userData?.clinicChoiceChangedAt ?? null,
          termsVersion: userData?.termsVersion ?? null,
          staffRole: userData?.staffRole ?? null,
          branding: sessionBranding(memberships, access.active?.id),
        },
        session,
      };
    }),
  ],
  user: {
    modelName: "usersTable",
    // input: false on every field: Better Auth otherwise accepts them from
    // the browser at sign-up and in update-user, and anyone could give
    // themselves a paid plan. Only the Stripe webhook and checkout set them.
    additionalFields: {
      stripeCustomerId: {
        type: "string",
        fieldName: "stripeCustomerId",
        required: false,
        input: false,
      },
      stripeSubscriptionId: {
        type: "string",
        fieldName: "stripeSubscriptionId",
        required: false,
        input: false,
      },
      plan: {
        type: "string",
        fieldName: "plan",
        required: false,
        input: false,
      },
      termsAcceptedAt: {
        type: "date",
        fieldName: "termsAcceptedAt",
        required: false,
        input: false,
      },
      termsVersion: {
        type: "string",
        fieldName: "termsVersion",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          const acceptance = termsAcceptanceForNewUser(
            context?.path,
            context?.headers?.get(ACCEPT_TERMS_HEADER),
          );
          if (!acceptance) {
            throw new APIError("BAD_REQUEST", {
              message:
                "É preciso aceitar os Termos de Uso e a Política de Privacidade.",
            });
          }
          return { data: { ...user, ...acceptance } };
        },
      },
    },
  },
  session: {
    modelName: "sessionsTable",
    // Patient data: a session ends after 12 hours without use, instead of
    // Better Auth's 7 days renewed on every visit, which kept people signed
    // in for good. Using the system pushes the end back, at most once an hour.
    expiresIn: 12 * 60 * 60,
    updateAge: 60 * 60,
    // The session is validated from a signed cookie for up to 5 minutes
    // instead of a database lookup on every request. Plan, clinics and terms
    // still come from the database in customSession above, so they are never
    // stale; only a revoked session can outlive its revocation by 5 minutes.
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  account: {
    modelName: "accountsTable",
  },
  verification: {
    modelName: "verificationsTable",
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Without verification anyone could sign up with someone else's email
    // and enter patient data under that identity.
    requireEmailVerification: isEmailConfigured(),
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...resetPasswordEmail(url) });
    },
    // A new password signs out every other device, in case the old one leaked.
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendOnSignUp: isEmailConfigured(),
    // Accounts created before verification existed get a link when they
    // next sign in, instead of being locked out.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...verificationEmail(url) });
    },
  },
});
