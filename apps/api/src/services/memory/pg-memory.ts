import { query } from "../../db/index.js";
import type { MemoryProvider, MemoryEntry } from "./types.js";

interface MemoryRow {
  id: string;
  workspace_id: string;
  user_id: string;
  category: string;
  content: string;
  source_conversation_id: string | null;
  created_at: string;
}

function toEntry(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    category: row.category as MemoryEntry["category"],
    content: row.content,
    sourceConversationId: row.source_conversation_id ?? undefined,
    createdAt: row.created_at,
  };
}

export class PgMemoryProvider implements MemoryProvider {
  async save(entry: Omit<MemoryEntry, "id" | "createdAt">): Promise<MemoryEntry> {
    const result = await query<MemoryRow>(
      `INSERT INTO workspace_chat_memories
         (workspace_id, user_id, category, content, source_conversation_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        entry.workspaceId,
        entry.userId,
        entry.category,
        entry.content,
        entry.sourceConversationId ?? null,
      ],
    );
    return toEntry(result.rows[0]);
  }

  async getRecent(
    workspaceId: string,
    userId: string,
    limit = 20,
  ): Promise<MemoryEntry[]> {
    const result = await query<MemoryRow>(
      `SELECT * FROM workspace_chat_memories
       WHERE workspace_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [workspaceId, userId, limit],
    );
    return result.rows.map(toEntry);
  }

  async search(
    workspaceId: string,
    userId: string,
    searchQuery: string,
  ): Promise<MemoryEntry[]> {
    const result = await query<MemoryRow>(
      `SELECT * FROM workspace_chat_memories
       WHERE workspace_id = $1 AND user_id = $2
         AND content ILIKE '%' || $3 || '%'
       ORDER BY created_at DESC
       LIMIT 20`,
      [workspaceId, userId, searchQuery],
    );
    return result.rows.map(toEntry);
  }

  async delete(id: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM workspace_chat_memories WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
