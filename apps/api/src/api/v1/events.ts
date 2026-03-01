import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { requireWorkspaceMember } from "../../middleware/workspace-auth.js";
import { eventBus, type WorkspaceEvent } from "../../services/event-emitter.js";
import * as eventStore from "../../services/event-store.js";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
    apiTokenWorkspaceId?: string;
  };
};

const app = new Hono<Env>();

app.use("*", authMiddleware as never);

// ── SSE stream ────────────────────────────────────────────────────────────

let totalEventsEmitted = 0;
let peakConnections = 0;
const latencyHistogram: number[] = [];
const MAX_HISTOGRAM = 500;

function recordLatency(ms: number) {
  latencyHistogram.push(ms);
  if (latencyHistogram.length > MAX_HISTOGRAM) latencyHistogram.shift();
}

app.get("/workspaces/:workspaceId/events/stream", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const connectionId = crypto.randomUUID();
  eventBus.trackConnection(workspaceId, connectionId);

  const currentConns = eventBus.getConnectionCount();
  if (currentConns > peakConnections) peakConnections = currentConns;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string, event?: string) => {
        try {
          if (event) controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          cleanup();
        }
      };

      send(JSON.stringify({ type: "connected", connectionId }), "connected");

      const heartbeat = setInterval(() => {
        send("", "heartbeat");
      }, 30_000);

      const onEvent = (event: WorkspaceEvent) => {
        if (event.workspace_id !== workspaceId) return;
        const emitTime = Date.now();
        totalEventsEmitted++;
        send(JSON.stringify(event), "workspace_event");
        recordLatency(Date.now() - emitTime);
      };

      eventBus.on("event", onEvent);

      function cleanup() {
        clearInterval(heartbeat);
        eventBus.off("event", onEvent);
        eventBus.removeConnection(workspaceId, connectionId);
        try { controller.close(); } catch { /* already closed */ }
      }

      c.req.raw.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Connection-Id": connectionId,
    },
  });
});

// ── List events ───────────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  type: z.string().optional(),
  since: z.string().datetime().optional(),
});

app.get("/workspaces/:workspaceId/events", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const parsed = ListQuerySchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
    type: c.req.query("type"),
    since: c.req.query("since"),
  });
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const result = await eventStore.listEvents(workspaceId, parsed.data);
  return c.json(result);
});

// ── Create event ──────────────────────────────────────────────────────────

const CreateEventSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1).max(500),
  detail: z.record(z.unknown()).default({}),
});

app.post("/workspaces/:workspaceId/events", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const event = await eventStore.createEvent(
    workspaceId,
    parsed.data.type,
    parsed.data.title,
    parsed.data.detail,
    userId,
  );
  return c.json(event, 201);
});

// ── Performance metrics ───────────────────────────────────────────────────

app.get("/workspaces/:workspaceId/events/metrics", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const avgLatency = latencyHistogram.length > 0
    ? latencyHistogram.reduce((a, b) => a + b, 0) / latencyHistogram.length
    : 0;
  const p95Index = Math.floor(latencyHistogram.length * 0.95);
  const sorted = [...latencyHistogram].sort((a, b) => a - b);

  return c.json({
    connections: {
      workspace: eventBus.getConnectionCount(workspaceId),
      total: eventBus.getConnectionCount(),
      peak: peakConnections,
    },
    events: {
      totalEmitted: totalEventsEmitted,
    },
    latency: {
      avgMs: Math.round(avgLatency * 100) / 100,
      p95Ms: sorted[p95Index] ?? 0,
      maxMs: sorted[sorted.length - 1] ?? 0,
      samples: latencyHistogram.length,
    },
  });
});

export default app;
