import { Hono } from "hono";
import { z } from "zod";
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

const CreateTicketBodySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

app.post("/workspaces/:workspaceId/tickets", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateTicketBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const provider = await createTicketProviderForWorkspace(workspaceId);
  if (!provider.createTicket) {
    return c.json(
      { error: "Connected ticket provider does not support creating tickets" },
      501,
    );
  }

  try {
    const ticket = await provider.createTicket(parsed.data);
    return c.json({ ticket }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create ticket";
    return c.json({ error: msg }, 502);
  }
});

// ── Add comment to a ticket ──────────────────────────────────────────

const AddCommentBodySchema = z.object({
  body: z.string().min(1, "Comment body is required"),
});

app.post("/workspaces/:workspaceId/tickets/:ticketId/comments", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const ticketId = c.req.param("ticketId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = AddCommentBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const provider = await createTicketProviderForWorkspace(workspaceId);
  if (!provider.addComment) {
    return c.json(
      { error: "Connected ticket provider does not support adding comments" },
      501,
    );
  }

  try {
    const comment = await provider.addComment(ticketId, parsed.data.body);
    return c.json({ comment }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to add comment";
    return c.json({ error: msg }, 502);
  }
});

export default app;
