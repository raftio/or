import { Hono } from "hono";
import { authMiddleware } from "../../../middleware/auth.js";
import { requireWorkspaceMember } from "../../../middleware/workspace-auth.js";
import * as chatImageStore from "../../../services/chat-image-store.js";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
    apiTokenWorkspaceId?: string;
  };
};

const app = new Hono<Env>();

app.use("*", authMiddleware as never);

app.post("/workspaces/:workspaceId/chat/images", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const body = await c.req.parseBody();
  const file = body["file"];

  if (!(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  const validation = chatImageStore.validateImage(file.type, file.size);
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const meta = await chatImageStore.saveImage(
    workspaceId,
    userId,
    file.name || "image",
    file.type,
    buffer,
  );

  return c.json({
    id: meta.id,
    url: `/v1/workspaces/${workspaceId}/chat/images/${meta.id}`,
    filename: meta.filename,
    contentType: meta.content_type,
    size: meta.size_bytes,
  });
});

export default app;

// Public image serve (no auth — UUID is unguessable)
export const chatImages = new Hono();

chatImages.get("/workspaces/:workspaceId/chat/images/:imageId", async (c) => {
  const workspaceId = c.req.param("workspaceId");
  const imageId = c.req.param("imageId");

  const image = await chatImageStore.getImage(imageId);
  if (!image || image.workspace_id !== workspaceId) {
    return c.json({ error: "Image not found" }, 404);
  }

  return new Response(image.data, {
    headers: {
      "Content-Type": image.content_type,
      "Content-Length": String(image.size_bytes),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
