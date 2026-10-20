import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// "support" answers the Atendimento; "qa" tests the product; "admin" also sees
// every account and chooses support and QA. None of them needs a plan.
export const staffRoleEnum = pgEnum("staff_role", ["support", "qa", "admin"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan"),
  // Mirrors the Stripe subscription that grants the plan, for the UI: its
  // status and, once canceled, when access ends.
  subscriptionStatus: text("subscription_status"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  // The clinic the user is working in; must be one of their memberships.
  activeClinicId: uuid("active_clinic_id").references(() => clinicsTable.id, {
    onDelete: "set null",
  }),
  // When the user first chose which clinics stay usable on a smaller plan,
  // and when they last changed that choice (one change per 30 days).
  clinicChoiceMadeAt: timestamp("clinic_choice_made_at"),
  clinicChoiceChangedAt: timestamp("clinic_choice_changed_at"),
  // Which version of the terms of use and privacy policy the user accepted,
  // and when; a newer version asks again.
  termsAcceptedAt: timestamp("terms_accepted_at"),
  termsVersion: text("terms_version"),
  // Replaced by staffRole. Kept while the previous version may still be
  // running during a deploy; a later migration drops it.
  supportAdmin: boolean("support_admin").notNull().default(false),
  // Avelliq's own team, chosen in the Contas page (see lib/support/admin.ts).
  // The main accounts themselves come from SUPPORT_ADMIN_EMAILS.
  staffRole: staffRoleEnum("staff_role"),
  // The plan a QA account tests with instead of its own, without paying.
  // Ignored for anyone else; null means its real plan.
  qaPlan: text("qa_plan"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const usersTableRelations = relations(usersTable, ({ many }) => ({
  usersToClinics: many(usersToClinicsTable),
}));

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
});

export const accountsTable = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verificationsTable = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const clinicsTable = pgTable("clinics", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  phoneNumber: text("phone_number"),
  // White label: the clinic's color (#rrggbb) and logo, a small raster image
  // stored as a data URL (resized in the browser; SVG is refused).
  brandColor: text("brand_color"),
  logoDataUrl: text("logo_data_url"),
  // When the logo last changed: its URL's version, so other edits to the
  // clinic don't make every member download it again.
  logoUpdatedAt: timestamp("logo_updated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const usersToClinicsTable = pgTable(
  "users_to_clinics",
  {
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    // Chosen by the user to stay usable when they have more clinics than
    // their plan allows.
    keptInPlan: boolean("kept_in_plan").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_to_clinics_user_clinic_unique").on(
      table.userId,
      table.clinicId,
    ),
  ],
);

export const usersToClinicsTableRelations = relations(
  usersToClinicsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [usersToClinicsTable.userId],
      references: [usersTable.id],
    }),
    clinic: one(clinicsTable, {
      fields: [usersToClinicsTable.clinicId],
      references: [clinicsTable.id],
    }),
  }),
);

export const clinicsTableRelations = relations(clinicsTable, ({ many }) => ({
  doctors: many(doctorsTable),
  patients: many(patientsTable),
  appointments: many(appointmentsTable),
  usersToClinics: many(usersToClinicsTable),
}));

export const doctorsTable = pgTable("doctors", {
  id: uuid("id").defaultRandom().primaryKey(),
  clinicId: uuid("clinic_id")
    .notNull()
    .references(() => clinicsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  avatarImageUrl: text("avatar_image_url"),
  // 1 - Monday, 2 - Tuesday, 3 - Wednesday, 4 - Thursday, 5 - Friday, 6 - Saturday, 0 - Sunday
  availableFromWeekDay: integer("available_from_week_day").notNull(),
  availableToWeekDay: integer("available_to_week_day").notNull(),
  availableFromTime: time("available_from_time").notNull(),
  availableToTime: time("available_to_time").notNull(),
  specialty: text("specialty").notNull(),
  appointmentPriceInCents: integer("appointment_price_in_cents").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const doctorsTableRelations = relations(
  doctorsTable,
  ({ many, one }) => ({
    clinic: one(clinicsTable, {
      fields: [doctorsTable.clinicId],
      references: [clinicsTable.id],
    }),
    appointments: many(appointmentsTable),
  }),
);

export const patientSexEnum = pgEnum("patient_sex", ["male", "female"]);

export const patientsTable = pgTable(
  "patients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phoneNumber: text("phone_number").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    sex: patientSexEnum("sex").notNull(),
    // Registration details, all optional. Clinical information (diagnoses,
    // exams, prescriptions) deliberately has no place here: that would be a
    // medical record, with its own legal requirements.
    birthDate: date("birth_date"),
    cpf: text("cpf"),
    healthInsurance: text("health_insurance"),
    healthInsuranceNumber: text("health_insurance_number"),
    addressZip: text("address_zip"),
    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    addressDistrict: text("address_district"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    notes: text("notes"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // A CPF identifies one person: no two patients of a clinic share it.
    uniqueIndex("patients_clinic_cpf_unique")
      .on(table.clinicId, table.cpf)
      .where(sql`${table.cpf} is not null`),
  ],
);

export const patientsTableRelations = relations(
  patientsTable,
  ({ one, many }) => ({
    clinic: one(clinicsTable, {
      fields: [patientsTable.clinicId],
      references: [clinicsTable.id],
    }),
    appointments: many(appointmentsTable),
  }),
);

export const appointmentsTable = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: timestamp("date").notNull(),
    appointmentPriceInCents: integer("appointment_price_in_cents").notNull(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patientsTable.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctorsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // A doctor can only be booked once per slot, even under concurrent requests.
  (table) => [
    uniqueIndex("appointments_doctor_id_date_unique").on(
      table.doctorId,
      table.date,
    ),
  ],
);

export const appointmentsTableRelations = relations(
  appointmentsTable,
  ({ one }) => ({
    clinic: one(clinicsTable, {
      fields: [appointmentsTable.clinicId],
      references: [clinicsTable.id],
    }),
    patient: one(patientsTable, {
      fields: [appointmentsTable.patientId],
      references: [patientsTable.id],
    }),
    doctor: one(doctorsTable, {
      fields: [appointmentsTable.doctorId],
      references: [doctorsTable.id],
    }),
  }),
);

// Who changed what in a clinic, for accountability (LGPD arts. 6-X and 37).
// Holds ids only, never names or contact details, so it doesn't become another
// copy of the patients' data. Rows outlive deleted users and clinics.
export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    userId: text("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    clinicId: uuid("clinic_id").references(() => clinicsTable.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityId: text("entity_id"),
  },
  (table) => [
    index("audit_logs_clinic_created_idx").on(table.clinicId, table.createdAt),
  ],
);
