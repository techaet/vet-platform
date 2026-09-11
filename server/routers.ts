import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createOrganizationForUser,
  getOrganizationForUser,
  getOrganizationsForUser,
} from "./db";

const organizationInput = z.object({
  name: z.string().trim().min(2, "Informe o nome da organização").max(180),
  slug: z
    .string()
    .trim()
    .min(2, "Informe um identificador curto")
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens"),
  description: z.string().trim().max(1000).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  organization: router({
    mine: protectedProcedure.query(({ ctx }) => getOrganizationsForUser(ctx.user.id)),
    get: protectedProcedure
      .input(z.object({ organizationId: z.number().int().positive() }))
      .query(({ ctx, input }) => getOrganizationForUser(ctx.user.id, input.organizationId)),
    create: protectedProcedure.input(organizationInput).mutation(({ ctx, input }) =>
      createOrganizationForUser({
        userId: ctx.user.id,
        name: input.name,
        slug: input.slug,
        description: input.description,
      }),
    ),
  }),
});

export type AppRouter = typeof appRouter;
