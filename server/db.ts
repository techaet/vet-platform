import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertOrganization,
  InsertUser,
  medicalRecords,
  markdownImports,
  prescriptionItems,
  prescriptions,
  prescriptionTemplates,
  veterinarianAdminDocuments,
  organizationMembers,
  organizations,
  ownerAddresses,
  owners,
  patientAttachments,
  patients,
  appointments,
  appointmentReminders,
  ownerObservations,
  telegramMessages,
  telegramSessions,
  veterinarianProfiles,
  googleConnections,
  users,
} from "../drizzle/schema";
import { parseMarkdown } from "./markdownImport";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    const value = user[field];
    if (value !== undefined) { values[field] = value ?? null; updateSet[field] = value ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  values.lastSignedIn ||= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getOrganizationsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, description: organizations.description, status: organizations.status, role: organizationMembers.role, memberStatus: organizationMembers.status, createdAt: organizations.createdAt })
    .from(organizationMembers).innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, "active")))
    .orderBy(desc(organizations.createdAt));
}

export async function createOrganizationForUser(input: { userId: number; name: string; slug: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const result = await tx.insert(organizations).values({ name: input.name, slug: input.slug, description: input.description || null, ownerUserId: input.userId });
    const organizationId = Number(result[0].insertId);
    await tx.insert(organizationMembers).values({ organizationId, userId: input.userId, role: "admin", status: "active" });
    await tx.insert(veterinarianProfiles).values({ organizationId, userId: input.userId, displayName: input.name });
    const created = await tx.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    return created[0];
  });
}

export async function getOrganizationForUser(userId: number, organizationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, description: organizations.description, status: organizations.status, role: organizationMembers.role })
    .from(organizationMembers).innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.status, "active"))).limit(1);
  return result[0];
}

export async function requireOrganizationMember(userId: number, organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(organizationMembers).where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.status, "active"))).limit(1);
  if (!result[0]) throw new Error("Organization access denied");
  return result[0];
}

export async function listOwners(userId: number, organizationId: number) {
  await requireOrganizationMember(userId, organizationId);
  const db = await getDb();
  if (!db) return [];
  return db.select().from(owners).where(eq(owners.organizationId, organizationId)).orderBy(asc(owners.name));
}

export async function createOwner(userId: number, input: { organizationId: number; name: string; phone?: string; email?: string; notes?: string }) {
  await requireOrganizationMember(userId, input.organizationId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(owners).where(and(eq(owners.organizationId, input.organizationId), eq(owners.name, input.name))).limit(1);
  if (existing[0]) return existing[0];
  const result = await db.insert(owners).values({ organizationId: input.organizationId, name: input.name, phone: input.phone || null, email: input.email || null, notes: input.notes || null });
  const created = await db.select().from(owners).where(eq(owners.id, Number(result[0].insertId))).limit(1);
  return created[0];
}

export async function listPatients(userId: number, organizationId: number) {
  await requireOrganizationMember(userId, organizationId);
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: patients.id, name: patients.name, species: patients.species, breed: patients.breed, sex: patients.sex, birthDate: patients.birthDate, notes: patients.notes, ownerId: owners.id, ownerName: owners.name, ownerPhone: owners.phone })
    .from(patients).innerJoin(owners, eq(owners.id, patients.ownerId)).where(eq(patients.organizationId, organizationId)).orderBy(asc(patients.name));
}

export async function getPatient(userId: number, organizationId: number, patientId: number) {
  await requireOrganizationMember(userId, organizationId);
  const db = await getDb();
  if (!db) return undefined;
  const patient = await db.select({ id: patients.id, name: patients.name, species: patients.species, breed: patients.breed, sex: patients.sex, birthDate: patients.birthDate, notes: patients.notes, ownerId: owners.id, ownerName: owners.name, ownerPhone: owners.phone, ownerEmail: owners.email })
    .from(patients).innerJoin(owners, eq(owners.id, patients.ownerId)).where(and(eq(patients.id, patientId), eq(patients.organizationId, organizationId))).limit(1);
  if (!patient[0]) return undefined;
  const [records, addresses, attachments] = await Promise.all([
    db.select().from(medicalRecords).where(eq(medicalRecords.patientId, patientId)).orderBy(desc(medicalRecords.recordDate), desc(medicalRecords.createdAt)),
    db.select().from(ownerAddresses).where(eq(ownerAddresses.ownerId, patient[0].ownerId)).orderBy(desc(ownerAddresses.isPrimary)),
    db.select().from(patientAttachments).where(eq(patientAttachments.patientId, patientId)).orderBy(desc(patientAttachments.createdAt)),
  ]);
  return { ...patient[0], records, addresses, attachments };
}

export async function createOwnerAddress(userId: number, input: { organizationId: number; ownerId: number; label?: string; postalCode?: string; state?: string; city?: string; neighborhood?: string; street?: string; number?: string; complement?: string; reference?: string; accessInstructions?: string }) {
  await requireOrganizationMember(userId, input.organizationId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(ownerAddresses).values({ organizationId: input.organizationId, ownerId: input.ownerId, label: input.label || "Residência", postalCode: input.postalCode || null, state: input.state || null, city: input.city || null, neighborhood: input.neighborhood || null, street: input.street || null, number: input.number || null, complement: input.complement || null, reference: input.reference || null, accessInstructions: input.accessInstructions || null });
  const created = await db.select().from(ownerAddresses).where(eq(ownerAddresses.id, Number(result[0].insertId))).limit(1);
  return created[0];
}

export async function createPatient(userId: number, input: { organizationId: number; ownerId: number; name: string; species?: string; breed?: string; sex?: "male" | "female" | "unknown"; birthDate?: Date; notes?: string }) {
  await requireOrganizationMember(userId, input.organizationId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(patients).values({ organizationId: input.organizationId, ownerId: input.ownerId, name: input.name, species: input.species || null, breed: input.breed || null, sex: input.sex || null, birthDate: input.birthDate || null, notes: input.notes || null });
  const created = await db.select().from(patients).where(eq(patients.id, Number(result[0].insertId))).limit(1);
  return created[0];
}

export async function createMedicalRecord(userId: number, input: { organizationId: number; patientId: number; recordDate?: Date; title?: string; content: string; sourceType?: "veterinarian" | "owner" | "markdown_import"; originalContent?: string }) {
  await requireOrganizationMember(userId, input.organizationId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(medicalRecords).values({ organizationId: input.organizationId, patientId: input.patientId, veterinarianUserId: userId, recordDate: input.recordDate || new Date(), title: input.title || "Atendimento", content: input.content, sourceType: input.sourceType || "veterinarian", originalContent: input.originalContent || null });
  const created = await db.select().from(medicalRecords).where(eq(medicalRecords.id, Number(result[0].insertId))).limit(1);
  return created[0];
}

export async function updateMedicalRecord(userId: number, input: { organizationId: number; recordId: number; content: string; title?: string; recordDate?: Date }) {
  await requireOrganizationMember(userId, input.organizationId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(medicalRecords).set({ content: input.content, title: input.title || "Atendimento", recordDate: input.recordDate || undefined, updatedAt: new Date() }).where(and(eq(medicalRecords.id, input.recordId), eq(medicalRecords.organizationId, input.organizationId)));
  const updated = await db.select().from(medicalRecords).where(eq(medicalRecords.id, input.recordId)).limit(1);
  return updated[0];
}

export async function createAttachment(userId: number, input: { organizationId: number; patientId: number; medicalRecordId?: number; fileName: string; mimeType: string; fileSize: number; storageKey: string; storageUrl: string; description?: string }) {
  await requireOrganizationMember(userId, input.organizationId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(patientAttachments).values({ ...input, uploadedByUserId: userId, medicalRecordId: input.medicalRecordId || null, description: input.description || null });
  const created = await db.select().from(patientAttachments).where(eq(patientAttachments.id, Number(result[0].insertId))).limit(1);
  return created[0];
}

export async function listAdminDocuments(userId: number, organizationId: number) {
  await requireOrganizationMember(userId, organizationId);
  const db = await getDb();
  if (!db) return [];
  return db.select().from(veterinarianAdminDocuments)
    .where(and(eq(veterinarianAdminDocuments.organizationId, organizationId), eq(veterinarianAdminDocuments.veterinarianUserId, userId)))
    .orderBy(desc(veterinarianAdminDocuments.updatedAt));
}

export async function saveAdminDocument(userId: number, input: { organizationId: number; fileName: string; content: string; storageKey?: string; storageUrl?: string }) {
  await requireOrganizationMember(userId, input.organizationId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const previous = await db.select().from(veterinarianAdminDocuments)
    .where(and(eq(veterinarianAdminDocuments.organizationId, input.organizationId), eq(veterinarianAdminDocuments.veterinarianUserId, userId)))
    .orderBy(desc(veterinarianAdminDocuments.version)).limit(1);
  if (previous[0]) {
    await db.update(veterinarianAdminDocuments).set({ fileName: input.fileName, content: input.content, storageKey: input.storageKey || null, storageUrl: input.storageUrl || null, version: previous[0].version + 1, updatedAt: new Date() }).where(eq(veterinarianAdminDocuments.id, previous[0].id));
    const updated = await db.select().from(veterinarianAdminDocuments).where(eq(veterinarianAdminDocuments.id, previous[0].id)).limit(1);
    return updated[0];
  }
  const result = await db.insert(veterinarianAdminDocuments).values({ organizationId: input.organizationId, veterinarianUserId: userId, fileName: input.fileName, content: input.content, storageKey: input.storageKey || null, storageUrl: input.storageUrl || null });
  const created = await db.select().from(veterinarianAdminDocuments).where(eq(veterinarianAdminDocuments.id, Number(result[0].insertId))).limit(1);
  return created[0];
}

export async function getPrescriptionTemplate(userId: number, organizationId: number) {
  await requireOrganizationMember(userId, organizationId);
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(prescriptionTemplates).where(and(eq(prescriptionTemplates.organizationId, organizationId), eq(prescriptionTemplates.veterinarianUserId, userId))).limit(1);
  return rows[0];
}

export async function savePrescriptionTemplate(userId: number, input: { organizationId: number; businessName?: string; professionalName?: string; registration?: string; phone?: string; professionalAddress?: string; headerText?: string; footerText?: string; primaryColor?: string }) {
  await requireOrganizationMember(userId, input.organizationId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await getPrescriptionTemplate(userId, input.organizationId);
  if (existing) {
    await db.update(prescriptionTemplates).set({ ...input, veterinarianUserId: undefined, updatedAt: new Date() }).where(eq(prescriptionTemplates.id, existing.id));
    const updated = await db.select().from(prescriptionTemplates).where(eq(prescriptionTemplates.id, existing.id)).limit(1);
    return updated[0];
  }
  const result = await db.insert(prescriptionTemplates).values({ ...input, veterinarianUserId: userId });
  const created = await db.select().from(prescriptionTemplates).where(eq(prescriptionTemplates.id, Number(result[0].insertId))).limit(1);
  return created[0];
}

export async function createPrescription(userId: number, input: { organizationId: number; patientId: number; medicalRecordId?: number; notes?: string; items: Array<{ medication: string; concentration?: string; presentation?: string; dose?: string; route?: string; frequency?: string; duration?: string; quantity?: string; instructions?: string }> }) {
  await requireOrganizationMember(userId, input.organizationId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(prescriptions).values({ organizationId: input.organizationId, patientId: input.patientId, veterinarianUserId: userId, medicalRecordId: input.medicalRecordId || null, notes: input.notes || null });
  const prescriptionId = Number(result[0].insertId);
  if (input.items.length) await db.insert(prescriptionItems).values(input.items.map(item => ({ ...item, prescriptionId })));
  const created = await db.select().from(prescriptions).where(eq(prescriptions.id, prescriptionId)).limit(1);
  const items = await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, prescriptionId));
  return { prescription: created[0], items };
}


export async function setPrescriptionPdf(userId: number, input: { organizationId: number; prescriptionId: number; pdfKey: string; pdfUrl: string }) {
  await requireOrganizationMember(userId, input.organizationId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(prescriptions).set({ pdfKey: input.pdfKey, pdfUrl: input.pdfUrl, updatedAt: new Date() }).where(and(eq(prescriptions.id, input.prescriptionId), eq(prescriptions.organizationId, input.organizationId), eq(prescriptions.veterinarianUserId, userId)));
  const updated = await db.select().from(prescriptions).where(eq(prescriptions.id, input.prescriptionId)).limit(1);
  return updated[0];
}

export async function getVeterinarianByTelegramChat(telegramChatId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ userId: veterinarianProfiles.userId, organizationId: veterinarianProfiles.organizationId, displayName: veterinarianProfiles.displayName, chatId: veterinarianProfiles.telegramChatId })
    .from(veterinarianProfiles).where(eq(veterinarianProfiles.telegramChatId, telegramChatId)).limit(1);
  return rows[0];
}

export async function setVeterinarianTelegramChat(userId: number, organizationId: number, telegramChatId: string) {
  await requireOrganizationMember(userId, organizationId);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(veterinarianProfiles).set({ telegramChatId, updatedAt: new Date() }).where(and(eq(veterinarianProfiles.userId, userId), eq(veterinarianProfiles.organizationId, organizationId)));
  const rows = await db.select().from(veterinarianProfiles).where(and(eq(veterinarianProfiles.userId, userId), eq(veterinarianProfiles.organizationId, organizationId))).limit(1);
  return rows[0];
}

export async function saveTelegramMessage(input: { telegramChatId: string; telegramMessageId?: number; organizationId?: number; veterinarianUserId?: number; direction: "inbound" | "outbound"; messageType: string; text?: string; rawPayload?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(telegramMessages).values({ ...input, telegramMessageId: input.telegramMessageId || null, organizationId: input.organizationId || null, veterinarianUserId: input.veterinarianUserId || null, text: input.text || null, rawPayload: input.rawPayload || null });
}

export async function getTelegramSession(telegramChatId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(telegramSessions).where(eq(telegramSessions.telegramChatId, telegramChatId)).limit(1);
  return rows[0];
}

export async function saveTelegramSession(input: { telegramChatId: string; organizationId?: number; veterinarianUserId?: number; mode: "idle" | "appointment" | "record" | "owner_observation"; ownerId?: number; patientId?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(telegramSessions).values({ ...input, organizationId: input.organizationId || null, veterinarianUserId: input.veterinarianUserId || null, ownerId: input.ownerId || null, patientId: input.patientId || null }).onDuplicateKeyUpdate({ set: { organizationId: input.organizationId || null, veterinarianUserId: input.veterinarianUserId || null, mode: input.mode, ownerId: input.ownerId || null, patientId: input.patientId || null, updatedAt: new Date() } });
}

export async function findOwnerByName(organizationId: number, name: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(owners).where(and(eq(owners.organizationId, organizationId), eq(owners.name, name))).limit(5);
}

export async function listOwnerPatients(organizationId: number, ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(patients).where(and(eq(patients.organizationId, organizationId), eq(patients.ownerId, ownerId))).orderBy(asc(patients.name));
}

export async function createTelegramAppointment(input: { organizationId: number; ownerId: number; patientId: number; veterinarianUserId: number; scheduledAt: Date; addressText?: string; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(appointments).values({ ...input, addressText: input.addressText || null, notes: input.notes || null });
  const appointmentId = Number(result[0].insertId);
  const reminderAt = new Date(input.scheduledAt.getTime() - 30 * 60 * 1000);
  await db.insert(appointmentReminders).values({ appointmentId, channel: "telegram", reminderType: "vet_30m", scheduledFor: reminderAt, status: "pending" });
  const rows = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  return rows[0];
}

export async function listDueTelegramReminders(now = new Date()) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ reminder: appointmentReminders, appointment: appointments, patientName: patients.name, ownerName: owners.name, chatId: veterinarianProfiles.telegramChatId, veterinarianName: veterinarianProfiles.displayName })
    .from(appointmentReminders)
    .innerJoin(appointments, eq(appointmentReminders.appointmentId, appointments.id))
    .innerJoin(veterinarianProfiles, eq(appointments.veterinarianUserId, veterinarianProfiles.userId))
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(owners, eq(appointments.ownerId, owners.id))
    .where(and(eq(appointmentReminders.channel, "telegram"), eq(appointmentReminders.status, "pending"), lte(appointmentReminders.scheduledFor, now)));
}

export async function markReminderSent(reminderId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(appointmentReminders).set({ status: "sent", sentAt: new Date() }).where(eq(appointmentReminders.id, reminderId));
}

export async function getGoogleConnection(userId: number, organizationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ id: googleConnections.id, googleEmail: googleConnections.googleEmail, scopes: googleConnections.scopes, updatedAt: googleConnections.updatedAt })
    .from(googleConnections)
    .where(and(eq(googleConnections.userId, userId), eq(googleConnections.organizationId, organizationId)))
    .limit(1);
  return rows[0];
}

export async function saveGoogleConnection(input: { userId: number; organizationId: number; googleEmail: string; accessTokenEncrypted: string; refreshTokenEncrypted?: string | null; expiresAt?: Date | null; scopes?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select({ id: googleConnections.id }).from(googleConnections).where(and(eq(googleConnections.userId, input.userId), eq(googleConnections.organizationId, input.organizationId))).limit(1);
  if (existing[0]) {
    await db.update(googleConnections).set({ googleEmail: input.googleEmail, accessTokenEncrypted: input.accessTokenEncrypted, refreshTokenEncrypted: input.refreshTokenEncrypted || null, expiresAt: input.expiresAt || null, scopes: input.scopes || null, updatedAt: new Date() }).where(eq(googleConnections.id, existing[0].id));
  } else {
    await db.insert(googleConnections).values({ ...input, refreshTokenEncrypted: input.refreshTokenEncrypted || null, expiresAt: input.expiresAt || null, scopes: input.scopes || null });
  }
  return getGoogleConnection(input.userId, input.organizationId);
}

export async function listAppointments(userId: number, organizationId: number, from?: Date, to?: Date) {
  await requireOrganizationMember(userId, organizationId);
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(appointments.organizationId, organizationId)];
  if (from) conditions.push(gte(appointments.scheduledAt, from));
  if (to) conditions.push(lte(appointments.scheduledAt, to));
  return db.select({ appointment: appointments, patientName: patients.name, ownerName: owners.name })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(owners, eq(appointments.ownerId, owners.id))
    .where(and(...conditions))
    .orderBy(asc(appointments.scheduledAt));
}

export async function createOwnerObservation(input: { organizationId: number; patientId: number; veterinarianUserId: number; content: string; originalAudioKey?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(ownerObservations).values({ ...input, originalAudioKey: input.originalAudioKey || null });
  const rows = await db.select().from(ownerObservations).where(eq(ownerObservations.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}
