import { Hono } from "hono";
import { z } from "zod";
import * as bundleStore from "../../services/bundle-store.js";

const app = new Hono();

const CreateBundleBodySchema = z.object({
  ticket_ref: z.string().min(1),
  spec_ref: z.string().optional(),
  tasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
  dependencies: z
    .array(
      z.object({
        taskId: z.string(),
        dependsOn: z.string(),
      })
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

app.post("/bundles", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateBundleBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  const bundle = bundleStore.createBundle(parsed.data);
  return c.json(bundle, 201);
});

app.get("/bundles/:id", (c) => {
  const id = c.req.param("id");
  const bundle = bundleStore.getBundle(id);
  if (!bundle) {
    return c.json({ error: "Bundle not found" }, 404);
  }
  return c.json(bundle);
});

app.get("/bundles", (c) => {
  const ticketId = c.req.query("ticketId");
  if (!ticketId) {
    return c.json({ error: "ticketId query required" }, 400);
  }
  const bundles = bundleStore.getBundlesByTicket(ticketId);
  return c.json({ bundles });
});

export default app;
