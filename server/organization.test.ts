import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("organization routes", () => {
  it("requires authentication to list organizations", async () => {
    const caller = appRouter.createCaller(createUnauthenticatedContext());

    await expect(caller.organization.mine()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("requires authentication to access an organization", async () => {
    const caller = appRouter.createCaller(createUnauthenticatedContext());

    await expect(caller.organization.get({ organizationId: 1 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
