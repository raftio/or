import { Hono } from "hono";
import { EvidencePayloadSchema } from "@orca/domain";
import * as evidenceStore from "../../services/evidence-store.js";
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

// ── Workspace-scoped evidence endpoints ──────────────────────────────────

app.post("/workspaces/:workspaceId/evidence", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = EvidencePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const stored = await evidenceStore.ingestEvidence(workspaceId, parsed.data);
  return c.json(stored, 201);
});

app.get("/workspaces/:workspaceId/evidence/status", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const ticketId = c.req.query("ticketId");
  if (!ticketId) {
    return c.json({ error: "ticketId query required" }, 400);
  }
  const status = await evidenceStore.getEvidenceStatus(workspaceId, ticketId);
  return c.json(status);
});

app.get("/workspaces/:workspaceId/evidence/:id", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const id = c.req.param("id");
  const evidence = await evidenceStore.getEvidenceById(id);
  if (!evidence) {
    return c.json({ error: "Evidence not found" }, 404);
  }
  return c.json(evidence);
});

app.get("/workspaces/:workspaceId/evidence", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const ticketId = c.req.query("ticketId");
  const repo = c.req.query("repo");
  const prId = c.req.query("prId");
  const bundleId = c.req.query("bundleId");

  if (ticketId) {
    const payloads = await evidenceStore.getEvidenceByTicket(workspaceId, ticketId);
    return c.json({ evidence: payloads });
  }
  if (repo && prId) {
    const payloads = await evidenceStore.getEvidenceByRepoPr(workspaceId, repo, prId);
    return c.json({ evidence: payloads });
  }
  if (bundleId) {
    const payloads = await evidenceStore.getEvidenceByBundle(workspaceId, bundleId);
    return c.json({ evidence: payloads });
  }

  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;
  const result = await evidenceStore.listEvidence(workspaceId, { limit, offset });
  return c.json(result);
});

app.post("/workspaces/:workspaceId/evidence/validate", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = EvidencePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }
  return c.json({
    valid: parsed.data.ci_status === "success",
    payload_id: parsed.data.id,
    ci_status: parsed.data.ci_status,
  });
});

// ── Legacy endpoints (backward-compatible, no workspace scope) ───────────

app.post("/evidence", async (c) => {
  const workspaceId = c.get("apiTokenWorkspaceId");
  if (!workspaceId) {
    return c.json({ error: "Workspace context required. Use workspace-scoped endpoint or API token." }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = EvidencePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const stored = await evidenceStore.ingestEvidence(workspaceId, parsed.data);
  return c.json(stored, 201);
});

app.get("/evidence/status", async (c) => {
  const workspaceId = c.get("apiTokenWorkspaceId");
  if (!workspaceId) {
    return c.json({ error: "Workspace context required. Use workspace-scoped endpoint or API token." }, 400);
  }

  const ticketId = c.req.query("ticketId");
  if (!ticketId) {
    return c.json({ error: "ticketId query required" }, 400);
  }
  const status = await evidenceStore.getEvidenceStatus(workspaceId, ticketId);
  return c.json(status);
});

app.get("/evidence/:id", async (c) => {
  const id = c.req.param("id");
  const evidence = await evidenceStore.getEvidenceById(id);
  if (!evidence) {
    return c.json({ error: "Evidence not found" }, 404);
  }
  return c.json(evidence);
});

app.get("/evidence", async (c) => {
  const workspaceId = c.get("apiTokenWorkspaceId");
  if (!workspaceId) {
    return c.json({ error: "Workspace context required. Use workspace-scoped endpoint or API token." }, 400);
  }

  const ticketId = c.req.query("ticketId");
  const repo = c.req.query("repo");
  const prId = c.req.query("prId");

  if (ticketId) {
    const payloads = await evidenceStore.getEvidenceByTicket(workspaceId, ticketId);
    return c.json({ evidence: payloads });
  }
  if (repo && prId) {
    const payloads = await evidenceStore.getEvidenceByRepoPr(workspaceId, repo, prId);
    return c.json({ evidence: payloads });
  }

  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;
  const result = await evidenceStore.listEvidence(workspaceId, { limit, offset });
  return c.json(result);
});

export default app;
