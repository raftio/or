import { Hono } from "hono";
import { z } from "zod";
import * as bundleStore from "../../services/bundle-store.js";
import { buildBundle } from "../../services/bundling-engine.js";
import { createTicketProviderForWorkspace } from "../../adapters/ticket/index.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireWorkspaceMember } from "../../middleware/workspace-auth.js";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
    apiTokenWorkspaceId?: string;
  };
};

const app = new Hono<Env>();

app.use("*", authMiddleware as never);

// ── Schemas ──────────────────────────────────────────────────────────────

const CreateBundleBodySchema = z.object({
  ticket_ref: z.string().min(1),
  spec_ref: z.string().optional(),
  build_from_ticket: z.boolean().optional(),
  use_ai: z.boolean().optional(),
  tasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  dependencies: z
    .array(
      z.object({
        taskId: z.string(),
        dependsOn: z.string(),
      }),
    )
    .optional(),
  acceptance_criteria_refs: z.array(z.string()).optional(),
  context: z
    .object({
      excerpts: z.array(z.string()).optional(),
      related_ticket_ids: z.array(z.string()).optional(),
    })
    .optional(),
});

// ── Workspace-scoped bundle endpoints ────────────────────────────────────

app.post("/workspaces/:workspaceId/bundles", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateBundleBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }
  const data = parsed.data;

  if (data.build_from_ticket) {
    const bundle = await buildBundle({
      workspace_id: workspaceId,
      ticket_id: data.ticket_ref,
      spec_ref: data.spec_ref,
      use_ai: data.use_ai,
    });
    if (!bundle) {
      return c.json({ error: "Ticket not found or bundling failed" }, 404);
    }
    return c.json(bundle, 201);
  }

  const bundle = await bundleStore.createBundle({
    workspace_id: workspaceId,
    ...data,
  });
  return c.json(bundle, 201);
});

app.get("/workspaces/:workspaceId/bundles/:id", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const id = c.req.param("id");
  const bundle = await bundleStore.getBundle(id);
  if (!bundle) {
    return c.json({ error: "Bundle not found" }, 404);
  }
  return c.json(bundle);
});

app.get("/workspaces/:workspaceId/bundles", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const ticketRef = c.req.query("ticketRef");
  if (ticketRef) {
    const bundles = await bundleStore.getBundlesByTicket(workspaceId, ticketRef);
    return c.json({ bundles });
  }

  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;
  const result = await bundleStore.listBundles(workspaceId, { limit, offset });
  return c.json(result);
});

app.get("/workspaces/:workspaceId/bundles/:ticketRef/history", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const ticketRef = decodeURIComponent(c.req.param("ticketRef"));
  const bundles = await bundleStore.getBundleHistory(workspaceId, ticketRef);
  return c.json({ bundles });
});

// ── Legacy endpoints (backward-compatible, no workspace scope) ───────────

app.post("/bundles", async (c) => {
  const workspaceId = c.get("apiTokenWorkspaceId");
  if (!workspaceId) {
    return c.json({ error: "Workspace context required. Use workspace-scoped endpoint or API token." }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateBundleBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }
  const data = parsed.data;

  if (data.build_from_ticket) {
    const bundle = await buildBundle({
      workspace_id: workspaceId,
      ticket_id: data.ticket_ref,
      spec_ref: data.spec_ref,
      use_ai: data.use_ai,
    });
    if (!bundle) {
      return c.json({ error: "Ticket not found or bundling failed" }, 404);
    }
    return c.json(bundle, 201);
  }

  const bundle = await bundleStore.createBundle({
    workspace_id: workspaceId,
    ...data,
  });
  return c.json(bundle, 201);
});

app.get("/bundles/:id", async (c) => {
  const id = c.req.param("id");
  const bundle = await bundleStore.getBundle(id);
  if (!bundle) {
    return c.json({ error: "Bundle not found" }, 404);
  }
  return c.json(bundle);
});

app.get("/bundles", async (c) => {
  const workspaceId = c.get("apiTokenWorkspaceId");
  if (!workspaceId) {
    return c.json({ error: "Workspace context required. Use workspace-scoped endpoint or API token." }, 400);
  }

  const ticketId = c.req.query("ticketId");
  if (ticketId) {
    const bundles = await bundleStore.getBundlesByTicket(workspaceId, ticketId);
    return c.json({ bundles });
  }

  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;
  const result = await bundleStore.listBundles(workspaceId, { limit, offset });
  return c.json(result);
});

app.post("/bundles/sync", async (c) => {
  const workspaceId = c.get("apiTokenWorkspaceId");
  if (!workspaceId) {
    return c.json({ error: "Workspace context required. Use API token." }, 400);
  }

  const provider = await createTicketProviderForWorkspace(workspaceId);
  if (!provider.listTickets) {
    return c.json({ error: "Ticket provider does not support listing" }, 400);
  }

  const tickets = await provider.listTickets({});
  const ticketRefs = tickets.map((t) => t.key);
  const latestBundles = await bundleStore.getLatestBundlesByTickets(workspaceId, ticketRefs);

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const ticket of tickets) {
    try {
      if (ticket.updated_at) {
        const latest = latestBundles.get(ticket.key);
        if (latest && new Date(ticket.updated_at) <= new Date(latest.updated_at)) {
          skipped++;
          continue;
        }
      }

      const bundle = await buildBundle({
        workspace_id: workspaceId,
        ticket_id: ticket.key,
      });
      if (bundle) synced++;
    } catch (err) {
      errors.push(`${ticket.key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return c.json({ total: tickets.length, synced, skipped, errors });
});

export default app;
