import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import {
  createMedicalRecord,
  createOrganizationForUser,
  createOwner,
  createOwnerAddress,
  createPatient,
  createAttachment,
  getOrganizationForUser,
  getOrganizationsForUser,
  getPatient,
  listOwners,
  listPatients,
  updateMedicalRecord,
  createPrescription,
  getPrescriptionTemplate,
  listAdminDocuments,
  saveAdminDocument,
  savePrescriptionTemplate,
  setPrescriptionPdf,
  setVeterinarianTelegramChat,
  listAppointments,
  getGoogleConnection,
  createTelegramLinkCode,
  deleteOrganizationAsAdmin,
} from "./db";
import { importMarkdownForOrganization } from "./markdownImportDb";
import { buildPrescriptionPdf } from "./prescriptionPdf";
import { getTelegramBotInfo } from "./telegram";

const orgId = z.object({ organizationId: z.number().int().positive() });
const organizationInput = z.object({ name: z.string().trim().min(2).max(180), slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().trim().max(1000).optional() });
const patientInput = orgId.extend({ ownerId: z.number().int().positive(), name: z.string().trim().min(1).max(160), species: z.string().trim().max(80).optional(), breed: z.string().trim().max(120).optional(), sex: z.enum(["male", "female", "unknown"]).optional(), birthDate: z.coerce.date().optional(), notes: z.string().max(5000).optional() });
const addressInput = orgId.extend({ ownerId: z.number().int().positive(), label: z.string().max(80).optional(), postalCode: z.string().max(20).optional(), state: z.string().max(80).optional(), city: z.string().max(120).optional(), neighborhood: z.string().max(120).optional(), street: z.string().max(180).optional(), number: z.string().max(30).optional(), complement: z.string().max(120).optional(), reference: z.string().max(3000).optional(), accessInstructions: z.string().max(3000).optional() });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  organization: router({
    mine: protectedProcedure.query(({ ctx }) => getOrganizationsForUser(ctx.user.id)),
    get: protectedProcedure.input(orgId).query(({ ctx, input }) => getOrganizationForUser(ctx.user.id, input.organizationId)),
    create: protectedProcedure.input(organizationInput).mutation(({ ctx, input }) => createOrganizationForUser({ userId: ctx.user.id, ...input })),
    delete: adminProcedure.input(orgId.extend({ confirmation: z.literal("EXCLUIR ORGANIZAÇÃO") })).mutation(({ input }) => deleteOrganizationAsAdmin(input.organizationId)),
  }),
  owner: router({
    list: protectedProcedure.input(orgId).query(({ ctx, input }) => listOwners(ctx.user.id, input.organizationId)),
    create: protectedProcedure.input(orgId.extend({ name: z.string().trim().min(1).max(180), phone: z.string().max(40).optional(), email: z.string().email().optional(), notes: z.string().max(5000).optional() })).mutation(({ ctx, input }) => createOwner(ctx.user.id, input)),
    addAddress: protectedProcedure.input(addressInput).mutation(({ ctx, input }) => createOwnerAddress(ctx.user.id, input)),
  }),
  patient: router({
    list: protectedProcedure.input(orgId).query(({ ctx, input }) => listPatients(ctx.user.id, input.organizationId)),
    get: protectedProcedure.input(orgId.extend({ patientId: z.number().int().positive() })).query(({ ctx, input }) => getPatient(ctx.user.id, input.organizationId, input.patientId)),
    create: protectedProcedure.input(patientInput).mutation(({ ctx, input }) => createPatient(ctx.user.id, input)),
    addAttachment: protectedProcedure.input(orgId.extend({ patientId: z.number().int().positive(), medicalRecordId: z.number().int().positive().optional(), fileName: z.string().max(255), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "application/pdf", "audio/mpeg", "audio/ogg", "audio/wav"]), fileData: z.string().max(28_000_000), description: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const match = input.fileData.match(/^data:[^;]+;base64,(.+)$/);
      if (!match) throw new Error("Arquivo inválido");
      const buffer = Buffer.from(match[1], "base64");
      if (buffer.byteLength > 20 * 1024 * 1024) throw new Error("Arquivo acima de 20 MB");
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
      const stored = await storagePut(`organizations/${input.organizationId}/patients/${input.patientId}/${safeName}`, buffer, input.mimeType);
      return createAttachment(ctx.user.id, { organizationId: input.organizationId, patientId: input.patientId, medicalRecordId: input.medicalRecordId, fileName: input.fileName, mimeType: input.mimeType, fileSize: buffer.byteLength, storageKey: stored.key, storageUrl: stored.url, description: input.description });
    }),
  }),
  medicalRecord: router({
    create: protectedProcedure.input(orgId.extend({ patientId: z.number().int().positive(), recordDate: z.coerce.date().optional(), title: z.string().max(180).optional(), content: z.string().min(1).max(30000), sourceType: z.enum(["veterinarian", "owner", "markdown_import"]).optional(), originalContent: z.string().max(30000).optional() })).mutation(({ ctx, input }) => createMedicalRecord(ctx.user.id, input)),
    update: protectedProcedure.input(orgId.extend({ recordId: z.number().int().positive(), title: z.string().max(180).optional(), content: z.string().min(1).max(30000), recordDate: z.coerce.date().optional() })).mutation(({ ctx, input }) => updateMedicalRecord(ctx.user.id, input)),
  }),
  markdown: router({
    import: protectedProcedure.input(orgId.extend({ fileName: z.string().max(255), content: z.string().min(1).max(5_000_000) })).mutation(async ({ ctx, input }) => {
      const access = await getOrganizationForUser(ctx.user.id, input.organizationId);
      if (!access) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso à organização negado" });
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
      const stored = await storagePut(`organizations/${input.organizationId}/imports/${safeName}`, input.content, "text/markdown");
      return importMarkdownForOrganization({ userId: ctx.user.id, organizationId: input.organizationId, fileName: input.fileName, content: input.content, sourceKey: stored.key, sourceUrl: stored.url });
    }),
  }),
  adminDocument: router({
    list: protectedProcedure.input(orgId).query(({ ctx, input }) => listAdminDocuments(ctx.user.id, input.organizationId)),
    save: protectedProcedure.input(orgId.extend({ fileName: z.string().max(255), content: z.string().min(1).max(2_000_000) })).mutation(async ({ ctx, input }) => {
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
      const stored = await storagePut(`organizations/${input.organizationId}/veterinarians/${ctx.user.id}/admin/${safeName}`, input.content, "text/markdown");
      return saveAdminDocument(ctx.user.id, { ...input, storageKey: stored.key, storageUrl: stored.url });
    }),
  }),
  prescription: router({
    template: protectedProcedure.input(orgId).query(({ ctx, input }) => getPrescriptionTemplate(ctx.user.id, input.organizationId)),
    saveTemplate: protectedProcedure.input(orgId.extend({ businessName: z.string().max(180).optional(), professionalName: z.string().max(180).optional(), registration: z.string().max(80).optional(), phone: z.string().max(40).optional(), professionalAddress: z.string().max(1000).optional(), headerText: z.string().max(2000).optional(), footerText: z.string().max(2000).optional(), primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), letterheadKey: z.string().max(500).optional(), letterheadUrl: z.string().max(700).optional() })).mutation(({ ctx, input }) => savePrescriptionTemplate(ctx.user.id, input)),
    uploadLetterhead: protectedProcedure.input(orgId.extend({ fileName: z.string().max(255), fileData: z.string().max(14_000_000) })).mutation(async ({ ctx, input }) => {
      if (!input.fileName.toLowerCase().endsWith(".pdf")) throw new Error("A folha timbrada deve ser um PDF");
      const match = input.fileData.match(/^data:application\/pdf;base64,(.+)$/);
      if (!match) throw new Error("PDF inválido");
      const buffer = Buffer.from(match[1], "base64");
      const stored = await storagePut(`organizations/${input.organizationId}/veterinarians/${ctx.user.id}/letterhead.pdf`, buffer, "application/pdf");
      return savePrescriptionTemplate(ctx.user.id, { organizationId: input.organizationId, letterheadKey: stored.key, letterheadUrl: stored.url });
    }),
    create: protectedProcedure.input(orgId.extend({ patientId: z.number().int().positive(), medicalRecordId: z.number().int().positive().optional(), issuedAt: z.coerce.date().optional(), content: z.string().max(12000).optional(), notes: z.string().max(3000).optional(), items: z.array(z.object({ medication: z.string().min(1).max(180), concentration: z.string().max(120).optional(), presentation: z.string().max(120).optional(), dose: z.string().max(160).optional(), route: z.string().max(100).optional(), frequency: z.string().max(120).optional(), duration: z.string().max(120).optional(), quantity: z.string().max(80).optional(), instructions: z.string().max(2000).optional() })).default([]) })).mutation(async ({ ctx, input }) => {
      const result = await createPrescription(ctx.user.id, input);
      const patient = await getPatient(ctx.user.id, input.organizationId, input.patientId);
      if (!patient) throw new Error("Paciente não encontrado");
      const template = await getPrescriptionTemplate(ctx.user.id, input.organizationId);
      const pdf = await buildPrescriptionPdf({ letterheadUrl: template?.letterheadUrl, patientName: patient.name, ownerName: patient.ownerName, issuedAt: result.prescription.issuedAt, content: input.content, notes: input.notes, items: result.items });
      const stored = await storagePut(`organizations/${input.organizationId}/patients/${input.patientId}/prescriptions/receita-${result.prescription.id}.pdf`, pdf, "application/pdf");
      const updated = await setPrescriptionPdf(ctx.user.id, { organizationId: input.organizationId, prescriptionId: result.prescription.id, pdfKey: stored.key, pdfUrl: stored.url });
      return { ...result, prescription: updated };
    }),
  }),
  telegram: router({
    botInfo: protectedProcedure.query(() => getTelegramBotInfo()),
    connect: protectedProcedure.input(orgId.extend({ chatId: z.string().min(1).max(80) })).mutation(({ ctx, input }) => setVeterinarianTelegramChat(ctx.user.id, input.organizationId, input.chatId)),
    linkCode: protectedProcedure.input(orgId).mutation(({ ctx, input }) => createTelegramLinkCode(ctx.user.id, input.organizationId)),
  }),
  appointment: router({
    list: protectedProcedure.input(orgId.extend({ from: z.coerce.date().optional(), to: z.coerce.date().optional() })).query(({ ctx, input }) => listAppointments(ctx.user.id, input.organizationId, input.from, input.to)),
  }),
  google: router({
    status: protectedProcedure.input(orgId).query(({ ctx, input }) => getGoogleConnection(ctx.user.id, input.organizationId)),
  }),
});

export type AppRouter = typeof appRouter;
