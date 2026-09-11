import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
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
} from "./db";
import { importMarkdownForOrganization } from "./markdownImportDb";

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
      if (!access) throw new Error("Organization access denied");
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
      const stored = await storagePut(`organizations/${input.organizationId}/imports/${safeName}`, input.content, "text/markdown");
      return importMarkdownForOrganization({ userId: ctx.user.id, organizationId: input.organizationId, fileName: input.fileName, content: input.content, sourceKey: stored.key, sourceUrl: stored.url });
    }),
  }),
});

export type AppRouter = typeof appRouter;
