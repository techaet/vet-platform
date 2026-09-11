import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  description: text("description"),
  ownerUserId: int("ownerUserId").notNull(),
  status: mysqlEnum("status", ["active", "suspended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const organizationMembers = mysqlTable("organizationMembers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["admin", "veterinarian", "collaborator"]).default("veterinarian").notNull(),
  status: mysqlEnum("status", ["active", "invited", "suspended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  organizationUserUnique: uniqueIndex("organization_members_org_user_unique").on(table.organizationId, table.userId),
  userIndex: index("organization_members_user_index").on(table.userId),
  organizationIndex: index("organization_members_organization_index").on(table.organizationId),
}));

export const veterinarianProfiles = mysqlTable("veterinarianProfiles", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  displayName: varchar("displayName", { length: 180 }),
  phone: varchar("phone", { length: 40 }),
  professionalRegistration: varchar("professionalRegistration", { length: 80 }),
  telegramChatId: varchar("telegramChatId", { length: 80 }),
  bio: text("bio"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  organizationUserUnique: uniqueIndex("veterinarian_profiles_org_user_unique").on(table.organizationId, table.userId),
}));

export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  monthlyAmountCents: int("monthlyAmountCents").notNull().default(0),
  includedVeterinarians: int("includedVeterinarians").notNull().default(1),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  planId: int("planId"),
  status: mysqlEnum("status", ["trialing", "active", "past_due", "suspended", "canceled"]).default("trialing").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  externalCustomerId: varchar("externalCustomerId", { length: 180 }),
  externalSubscriptionId: varchar("externalSubscriptionId", { length: 180 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  organizationIndex: index("subscriptions_organization_index").on(table.organizationId),
}));

export const subscriptionEvents = mysqlTable("subscriptionEvents", {
  id: int("id").autoincrement().primaryKey(),
  subscriptionId: int("subscriptionId").notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  externalEventId: varchar("externalEventId", { length: 180 }),
  payload: text("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const owners = mysqlTable("owners", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 320 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  organizationNameIndex: index("owners_org_name_index").on(table.organizationId, table.name),
}));

export const ownerAddresses = mysqlTable("ownerAddresses", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  ownerId: int("ownerId").notNull(),
  label: varchar("label", { length: 80 }).default("Residência").notNull(),
  postalCode: varchar("postalCode", { length: 20 }),
  state: varchar("state", { length: 80 }),
  city: varchar("city", { length: 120 }),
  neighborhood: varchar("neighborhood", { length: 120 }),
  street: varchar("street", { length: 180 }),
  number: varchar("number", { length: 30 }),
  complement: varchar("complement", { length: 120 }),
  reference: text("reference"),
  accessInstructions: text("accessInstructions"),
  isPrimary: mysqlEnum("isPrimary", ["yes", "no"]).default("yes").notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  ownerIndex: index("owner_addresses_owner_index").on(table.ownerId),
}));

export const patients = mysqlTable("patients", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  species: varchar("species", { length: 80 }),
  breed: varchar("breed", { length: 120 }),
  sex: mysqlEnum("sex", ["male", "female", "unknown"]),
  birthDate: timestamp("birthDate"),
  notes: text("notes"),
  importSource: varchar("importSource", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  ownerNameIndex: index("patients_owner_name_index").on(table.ownerId, table.name),
  organizationIndex: index("patients_organization_index").on(table.organizationId),
}));

export const medicalRecords = mysqlTable("medicalRecords", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  patientId: int("patientId").notNull(),
  veterinarianUserId: int("veterinarianUserId"),
  recordDate: timestamp("recordDate"),
  title: varchar("title", { length: 180 }),
  content: text("content").notNull(),
  sourceType: mysqlEnum("sourceType", ["veterinarian", "owner", "markdown_import"]).default("veterinarian").notNull(),
  originalContent: text("originalContent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  patientDateIndex: index("medical_records_patient_date_index").on(table.patientId, table.recordDate),
}));

export const patientAttachments = mysqlTable("patientAttachments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  patientId: int("patientId").notNull(),
  medicalRecordId: int("medicalRecordId"),
  uploadedByUserId: int("uploadedByUserId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  fileSize: int("fileSize").notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 700 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  patientIndex: index("patient_attachments_patient_index").on(table.patientId),
}));

export const markdownImports = mysqlTable("markdownImports", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  importedByUserId: int("importedByUserId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  sourceKey: varchar("sourceKey", { length: 500 }),
  sourceUrl: varchar("sourceUrl", { length: 700 }),
  ownersCreated: int("ownersCreated").default(0).notNull(),
  patientsCreated: int("patientsCreated").default(0).notNull(),
  recordsCreated: int("recordsCreated").default(0).notNull(),
  warnings: text("warnings"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const veterinarianAdminDocuments = mysqlTable("veterinarianAdminDocuments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  veterinarianUserId: int("veterinarianUserId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  content: text("content").notNull(),
  storageKey: varchar("storageKey", { length: 500 }),
  storageUrl: varchar("storageUrl", { length: 700 }),
  version: int("version").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  veterinarianIndex: index("vet_admin_documents_vet_index").on(table.veterinarianUserId, table.organizationId),
}));

export const prescriptionTemplates = mysqlTable("prescriptionTemplates", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  veterinarianUserId: int("veterinarianUserId").notNull(),
  businessName: varchar("businessName", { length: 180 }),
  professionalName: varchar("professionalName", { length: 180 }),
  registration: varchar("registration", { length: 80 }),
  phone: varchar("phone", { length: 40 }),
  professionalAddress: text("professionalAddress"),
  headerText: text("headerText"),
  footerText: text("footerText"),
  primaryColor: varchar("primaryColor", { length: 20 }).default("#087f70").notNull(),
  logoKey: varchar("logoKey", { length: 500 }),
  logoUrl: varchar("logoUrl", { length: 700 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  veterinarianUnique: uniqueIndex("prescription_templates_vet_unique").on(table.organizationId, table.veterinarianUserId),
}));

export const prescriptions = mysqlTable("prescriptions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  patientId: int("patientId").notNull(),
  veterinarianUserId: int("veterinarianUserId").notNull(),
  medicalRecordId: int("medicalRecordId"),
  notes: text("notes"),
  pdfKey: varchar("pdfKey", { length: 500 }),
  pdfUrl: varchar("pdfUrl", { length: 700 }),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  patientIndex: index("prescriptions_patient_index").on(table.patientId, table.createdAt),
}));

export const prescriptionItems = mysqlTable("prescriptionItems", {
  id: int("id").autoincrement().primaryKey(),
  prescriptionId: int("prescriptionId").notNull(),
  medication: varchar("medication", { length: 180 }).notNull(),
  concentration: varchar("concentration", { length: 120 }),
  presentation: varchar("presentation", { length: 120 }),
  dose: varchar("dose", { length: 160 }),
  route: varchar("route", { length: 100 }),
  frequency: varchar("frequency", { length: 120 }),
  duration: varchar("duration", { length: 120 }),
  quantity: varchar("quantity", { length: 80 }),
  instructions: text("instructions"),
});

export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  ownerId: int("ownerId").notNull(),
  patientId: int("patientId").notNull(),
  veterinarianUserId: int("veterinarianUserId").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  addressText: text("addressText"),
  notes: text("notes"),
  calendarEventId: varchar("calendarEventId", { length: 255 }),
  status: mysqlEnum("status", ["scheduled", "confirmed", "completed", "canceled"]).default("scheduled").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  vetDateIndex: index("appointments_vet_date_index").on(table.veterinarianUserId, table.scheduledAt),
}));

export const appointmentReminders = mysqlTable("appointmentReminders", {
  id: int("id").autoincrement().primaryKey(),
  appointmentId: int("appointmentId").notNull(),
  channel: mysqlEnum("channel", ["telegram", "whatsapp", "email"]).notNull(),
  reminderType: mysqlEnum("reminderType", ["vet_30m", "owner_1d"]).notNull(),
  scheduledFor: timestamp("scheduledFor").notNull(),
  sentAt: timestamp("sentAt"),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  dueIndex: index("appointment_reminders_due_index").on(table.status, table.scheduledFor),
}));

export const ownerObservations = mysqlTable("ownerObservations", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  patientId: int("patientId").notNull(),
  veterinarianUserId: int("veterinarianUserId").notNull(),
  content: text("content").notNull(),
  originalAudioKey: varchar("originalAudioKey", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const telegramMessages = mysqlTable("telegramMessages", {
  id: int("id").autoincrement().primaryKey(),
  telegramChatId: varchar("telegramChatId", { length: 80 }).notNull(),
  telegramMessageId: int("telegramMessageId"),
  organizationId: int("organizationId"),
  veterinarianUserId: int("veterinarianUserId"),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  messageType: varchar("messageType", { length: 40 }).notNull(),
  text: text("text"),
  rawPayload: text("rawPayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  chatIndex: index("telegram_messages_chat_index").on(table.telegramChatId, table.createdAt),
}));

export const telegramSessions = mysqlTable("telegramSessions", {
  id: int("id").autoincrement().primaryKey(),
  telegramChatId: varchar("telegramChatId", { length: 80 }).notNull().unique(),
  organizationId: int("organizationId"),
  veterinarianUserId: int("veterinarianUserId"),
  mode: mysqlEnum("mode", ["idle", "appointment", "record", "owner_observation"]).default("idle").notNull(),
  ownerId: int("ownerId"),
  patientId: int("patientId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
export type Owner = typeof owners.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type MedicalRecord = typeof medicalRecords.$inferSelect;
export type PatientAttachment = typeof patientAttachments.$inferSelect;
export type VeterinarianAdminDocument = typeof veterinarianAdminDocuments.$inferSelect;
export type PrescriptionTemplate = typeof prescriptionTemplates.$inferSelect;
export type Prescription = typeof prescriptions.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type AppointmentReminder = typeof appointmentReminders.$inferSelect;
