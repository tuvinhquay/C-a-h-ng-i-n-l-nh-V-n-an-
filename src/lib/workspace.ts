import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

const deviceSchema = z.object({
  id: z.string().min(8).max(80),
  name: z.string().max(60),
});

const documentSchema = z.object({
  snapshot: z.unknown(),
  tombstones: z.array(
    z.object({
      collection: z.enum(["parts", "moves", "customers", "repairs", "quotes", "invoices"]),
      id: z.string().min(1).max(200),
      deletedAt: z.string().min(1).max(80),
    }),
  ),
});

export const getWorkspace = createServerFn({ method: "GET" })
  .validator(deviceSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { fetchWorkspace } = await import("@/lib/workspace.server");
    return fetchWorkspace(context.userId, data);
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(1).max(80),
      document: documentSchema,
      device: deviceSchema,
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { createWorkspace: create } = await import("@/lib/workspace.server");
    return create(context.userId, data.name, data.document, data.device);
  });

export const createWorkspaceInvite = createServerFn({ method: "POST" })
  .validator(deviceSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { createInvite } = await import("@/lib/workspace.server");
    return createInvite(context.userId, data);
  });

export const joinWorkspace = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().trim().min(20).max(100),
      device: deviceSchema,
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { joinWorkspace: join } = await import("@/lib/workspace.server");
    return join(context.userId, data.token, data.device);
  });

export const revokeWorkspaceInvite = createServerFn({ method: "POST" })
  .validator(z.object({ inviteId: z.string().min(1).max(100) }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { revokeInvite } = await import("@/lib/workspace.server");
    return revokeInvite(context.userId, data.inviteId);
  });

export const removeWorkspaceMember = createServerFn({ method: "POST" })
  .validator(z.object({ memberUserId: z.string().min(1).max(200) }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { removeWorkspaceMember: remove } = await import("@/lib/workspace.server");
    return remove(context.userId, data.memberUserId);
  });

export const syncWorkspace = createServerFn({ method: "POST" })
  .validator(
    z.object({
      document: documentSchema,
      device: deviceSchema,
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { syncWorkspace: sync } = await import("@/lib/workspace.server");
    return sync(context.userId, data.document, data.device);
  });
