import { z } from "zod";

export const ChatMessageRoleSchema = z.enum(["user", "assistant", "system"]);

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: ChatMessageRoleSchema,
  content: z.string(),
  createdAt: z.string().datetime(),
});

export const ChatConversationSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  title: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatConversation = z.infer<typeof ChatConversationSchema>;
