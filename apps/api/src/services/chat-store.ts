import { query } from "../db/index.js";

export interface ConversationRow {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  image_ids: string[];
  created_at: string;
}

export async function createConversation(
  workspaceId: string,
  userId: string,
  title?: string,
): Promise<ConversationRow> {
  const result = await query<ConversationRow>(
    `INSERT INTO workspace_chat_conversations (workspace_id, user_id, title)
     VALUES ($1, $2, $3)
     RETURNING id, workspace_id, user_id, title, created_at, updated_at`,
    [workspaceId, userId, title || "New conversation"],
  );
  return result.rows[0];
}

export async function getConversation(conversationId: string): Promise<ConversationRow | null> {
  const result = await query<ConversationRow>(
    `SELECT id, workspace_id, user_id, title, created_at, updated_at
     FROM workspace_chat_conversations
     WHERE id = $1`,
    [conversationId],
  );
  return result.rows[0] ?? null;
}

export async function listConversations(
  workspaceId: string,
  userId: string,
  limit = 50,
  offset = 0,
): Promise<{ conversations: ConversationRow[]; total: number }> {
  const countResult = await query<{ count: string }>(
    `SELECT count(*)::text FROM workspace_chat_conversations
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query<ConversationRow>(
    `SELECT id, workspace_id, user_id, title, created_at, updated_at
     FROM workspace_chat_conversations
     WHERE workspace_id = $1 AND user_id = $2
     ORDER BY updated_at DESC
     LIMIT $3 OFFSET $4`,
    [workspaceId, userId, limit, offset],
  );
  return { conversations: result.rows, total };
}

export async function updateConversationTitle(
  conversationId: string,
  title: string,
): Promise<void> {
  await query(
    `UPDATE workspace_chat_conversations SET title = $1, updated_at = now() WHERE id = $2`,
    [title, conversationId],
  );
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM workspace_chat_conversations WHERE id = $1`,
    [conversationId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function addMessage(
  conversationId: string,
  role: string,
  content: string,
  imageIds?: string[],
): Promise<MessageRow> {
  const ids = imageIds?.length ? imageIds : [];
  const result = await query<MessageRow>(
    `INSERT INTO workspace_chat_messages (conversation_id, role, content, image_ids)
     VALUES ($1, $2, $3, $4)
     RETURNING id, conversation_id, role, content, image_ids, created_at`,
    [conversationId, role, content, ids],
  );
  await query(
    `UPDATE workspace_chat_conversations SET updated_at = now() WHERE id = $1`,
    [conversationId],
  );
  return result.rows[0];
}

export async function getMessages(conversationId: string): Promise<MessageRow[]> {
  const result = await query<MessageRow>(
    `SELECT id, conversation_id, role, content, image_ids, created_at
     FROM workspace_chat_messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId],
  );
  return result.rows;
}
