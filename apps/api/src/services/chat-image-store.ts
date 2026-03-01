import { query } from "../db/index.js";

export interface ImageRow {
  id: string;
  workspace_id: string;
  user_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  data: Buffer;
  created_at: string;
}

export type ImageMetadataRow = Omit<ImageRow, "data">;

const ALLOWED_TYPES = ["image/jpeg", "image/png"] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateImage(
  contentType: string,
  sizeBytes: number,
): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_TYPES.includes(contentType as (typeof ALLOWED_TYPES)[number])) {
    return { ok: false, error: "Only JPEG and PNG images are allowed" };
  }
  if (sizeBytes > MAX_SIZE_BYTES) {
    return { ok: false, error: `Image exceeds the 5 MB limit (${(sizeBytes / 1024 / 1024).toFixed(1)} MB)` };
  }
  return { ok: true };
}

export async function saveImage(
  workspaceId: string,
  userId: string,
  filename: string,
  contentType: string,
  data: Buffer,
): Promise<ImageMetadataRow> {
  const result = await query<ImageRow>(
    `INSERT INTO workspace_chat_images (workspace_id, user_id, filename, content_type, size_bytes, data)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, workspace_id, user_id, filename, content_type, size_bytes, created_at`,
    [workspaceId, userId, filename, contentType, data.length, data],
  );
  return result.rows[0];
}

export async function getImage(imageId: string): Promise<ImageRow | null> {
  const result = await query<ImageRow>(
    `SELECT id, workspace_id, user_id, filename, content_type, size_bytes, data, created_at
     FROM workspace_chat_images
     WHERE id = $1`,
    [imageId],
  );
  return result.rows[0] ?? null;
}

export async function getImageMetadata(imageId: string): Promise<ImageMetadataRow | null> {
  const result = await query<ImageMetadataRow>(
    `SELECT id, workspace_id, user_id, filename, content_type, size_bytes, created_at
     FROM workspace_chat_images
     WHERE id = $1`,
    [imageId],
  );
  return result.rows[0] ?? null;
}
