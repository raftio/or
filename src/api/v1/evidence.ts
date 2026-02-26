import { Hono } from "hono";
import { EvidencePayloadSchema } from "../../schemas/evidence.js";

const app = new Hono();

app.post("/evidence/validate", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = EvidencePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  return c.json({
    valid: parsed.data.ci_status === "success",
    payload_id: parsed.data.id,
    ci_status: parsed.data.ci_status,
  });
});

export default app;
