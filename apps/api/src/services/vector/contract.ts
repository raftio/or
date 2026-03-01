/**
 * Vector store and embedding abstractions.
 *
 * All indexing/search code depends on these interfaces — never on a
 * concrete store (pgvector) or embedding API (OpenAI) directly.
 * Swap implementations by changing the factory in index.ts.
 */

// ── Vector Store ─────────────────────────────────────────────────────────

export interface VectorEntry {
  id: string;
  workspaceId: string;
  repo: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  language: string | null;
  startLine: number;
  endLine: number;
  fileSha: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  workspaceId: string;
  repo?: string;
  limit?: number;
  threshold?: number;
}

export interface SearchResult {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string | null;
  score: number;
}

export interface VectorStore {
  upsert(entries: VectorEntry[]): Promise<void>;
  search(queryEmbedding: number[], options: SearchOptions): Promise<SearchResult[]>;
  deleteByFile(workspaceId: string, repo: string, filePath: string): Promise<void>;
  deleteByRepo(workspaceId: string, repo: string): Promise<void>;
  /** Return the set of (filePath, fileSha) pairs currently stored for a repo. */
  getIndexedFiles(workspaceId: string, repo: string): Promise<Map<string, string>>;
}

// ── Embedding Provider ───────────────────────────────────────────────────

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}
