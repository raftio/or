import type { CodeFileDto, ListFilesOptions, RepoTreeEntry } from "./types.js";

export interface CodeProvider {
  getFile(path: string, ref?: string): Promise<CodeFileDto | null>;
  getTree(ref?: string): Promise<RepoTreeEntry[]>;
  listFiles(options?: ListFilesOptions): AsyncGenerator<CodeFileDto>;
  testConnection(): Promise<{ name: string }>;
  getHeadSha?(ref?: string): Promise<string | null>;
}
