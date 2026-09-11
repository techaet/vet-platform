import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertOrganization,
  InsertUser,
  medicalRecords,
  markdownImports,
  organizationMembers,
  organizations,
  ownerAddresses,
  owners,
  patientAttachments,
  patients,
  veterinarianProfiles,
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

async function requireOrganizationMember(userId: number, organizationId: number) {
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
