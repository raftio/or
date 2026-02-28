import type { ToolSet } from "ai";

export interface ToolContext {
  workspaceId: string;
  userId: string;
  conversationId?: string;
}

export type ToolFactory = (ctx: ToolContext) => ToolSet;
