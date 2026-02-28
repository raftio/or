export type MemoryCategory = "decision" | "preference" | "context" | "summary";

export interface MemoryEntry {
  id: string;
  workspaceId: string;
  userId: string;
  category: MemoryCategory;
  content: string;
  sourceConversationId?: string;
  createdAt: string;
}

export interface MemoryProvider {
  save(entry: Omit<MemoryEntry, "id" | "createdAt">): Promise<MemoryEntry>;
  getRecent(workspaceId: string, userId: string, limit?: number): Promise<MemoryEntry[]>;
  search(workspaceId: string, userId: string, query: string): Promise<MemoryEntry[]>;
  delete(id: string): Promise<boolean>;
}
