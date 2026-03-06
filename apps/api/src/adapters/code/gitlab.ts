/**
 * GitLab code provider — fetches repository files via GitLab REST API v4.
 * Auth: PRIVATE-TOKEN header (Personal Access Token).
 */
import type { CodeProvider } from "./contract.js";
import type { ListFilesOptions, RepoTreeEntry } from "./types.js";

const DEFAULT_GITLAB_URL = "https://gitlab.com";

interface GitLabTreeItem {
  id: string;
  name: string;
  type: "blob" | "tree";
  path: string;
  mode: string;
}

interface GitLabFileResponse {
  file_name: string;
  file_path: string;
  size: number;
  content: string;
  content_sha256: string;
  ref: string;
  blob_id: string;
  last_commit_id: string;
}

export interface GitLabProjectSummary {
  id: number;
  name: string;
  path_with_namespace: string;
  default_branch: string;
  visibility: string;
  archived: boolean;
  description: string | null;
}

interface GitLabProjectResponse {
  id: number;
  name: string;
  path_with_namespace: string;
  default_branch: string;
  visibility: string;
  archived: boolean;
  description: string | null;
}

const LANGUAGE_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".kt": "kotlin",
  ".rb": "ruby",
  ".php": "php",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".c": "c",
  ".h": "c",
  ".swift": "swift",
  ".sql": "sql",
  ".sh": "shell",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".scss": "scss",
  ".html": "html",
  ".vue": "vue",
  ".svelte": "svelte",
};

function inferLanguage(filePath: string): string | null {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return LANGUAGE_MAP[ext] ?? null;
}

function makeHeaders(token: string): Record<string, string> {
  return { "PRIVATE-TOKEN": token };
}

function apiBase(baseUrl?: string): string {
  return `${(baseUrl || DEFAULT_GITLAB_URL).replace(/\/+$/, "")}/api/v4`;
}

export function createGitLabCodeProvider(
  projectId: string,
  token: string,
  defaultBranch = "main",
  baseUrl?: string,
): CodeProvider {
  const headers = makeHeaders(token);
  const api = apiBase(baseUrl);
  const encodedProject = encodeURIComponent(projectId);

  async function fetchJson<T>(url: string): Promise<T | null> {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return (await res.json()) as T;
  }

  return {
    async getFile(path, ref = defaultBranch) {
      const url =
        `${api}/projects/${encodedProject}/repository/files/${encodeURIComponent(path)}` +
        `?ref=${encodeURIComponent(ref)}`;
      const data = await fetchJson<GitLabFileResponse>(url);
      if (!data?.content) return null;

      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return {
        path: data.file_path,
        content,
        sha: data.blob_id,
        size: data.size,
        language: inferLanguage(data.file_path),
      };
    },

    async getTree(ref = defaultBranch) {
      const entries: RepoTreeEntry[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const url =
          `${api}/projects/${encodedProject}/repository/tree` +
          `?ref=${encodeURIComponent(ref)}&recursive=true&per_page=${perPage}&page=${page}`;
        const batch = await fetchJson<GitLabTreeItem[]>(url);
        if (!batch || batch.length === 0) break;

        for (const item of batch) {
          entries.push({
            path: item.path,
            type: item.type,
            sha: item.id,
          });
        }
        if (batch.length < perPage) break;
        page++;
      }

      return entries;
    },

    async *listFiles(options?: ListFilesOptions) {
      const ref = options?.ref ?? defaultBranch;
      const tree = await this.getTree(ref);
      const blobs = tree.filter((e) => e.type === "blob");

      for (const blob of blobs) {
        if (options?.pathPrefix && !blob.path.startsWith(options.pathPrefix)) continue;
        if (options?.extensions?.length) {
          const ext = blob.path.slice(blob.path.lastIndexOf(".")).toLowerCase();
          if (!options.extensions.includes(ext)) continue;
        }

        const file = await this.getFile(blob.path, ref);
        if (file) {
          if (options?.maxFileSize && file.size > options.maxFileSize) continue;
          yield file;
        }
      }
    },

    async testConnection() {
      const url = `${api}/projects/${encodedProject}`;
      const data = await fetchJson<GitLabProjectResponse>(url);
      if (!data) throw new Error("Could not reach project — check project ID and token");
      return { name: data.path_with_namespace };
    },

    async getHeadSha(ref = defaultBranch) {
      const url =
        `${api}/projects/${encodedProject}/repository/commits/${encodeURIComponent(ref)}`;
      const data = await fetchJson<{ id: string }>(url);
      return data?.id ?? null;
    },
  };
}

/**
 * List projects in a GitLab group (or user namespace).
 * Tries the group endpoint first, falls back to user projects.
 */
export async function listGitLabProjects(
  group: string,
  token: string,
  baseUrl?: string,
): Promise<GitLabProjectSummary[]> {
  const headers = makeHeaders(token);
  const api = apiBase(baseUrl);
  const projects: GitLabProjectSummary[] = [];
  const perPage = 100;

  async function fetchPage(url: string): Promise<GitLabProjectResponse[]> {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    return (await res.json()) as GitLabProjectResponse[];
  }

  // Try group endpoint first
  const encodedGroup = encodeURIComponent(group);
  for (let page = 1; ; page++) {
    const url = `${api}/groups/${encodedGroup}/projects?per_page=${perPage}&page=${page}&include_subgroups=true&order_by=name&sort=asc`;
    const batch = await fetchPage(url);
    if (batch.length === 0 && page === 1) break;
    for (const p of batch) {
      projects.push({
        id: p.id,
        name: p.name,
        path_with_namespace: p.path_with_namespace,
        default_branch: p.default_branch,
        visibility: p.visibility,
        archived: p.archived,
        description: p.description,
      });
    }
    if (batch.length < perPage) break;
  }

  if (projects.length > 0) return projects;

  // Fall back to user projects
  for (let page = 1; ; page++) {
    const url = `${api}/users/${encodedGroup}/projects?per_page=${perPage}&page=${page}&order_by=name&sort=asc`;
    const batch = await fetchPage(url);
    if (batch.length === 0) break;
    for (const p of batch) {
      projects.push({
        id: p.id,
        name: p.name,
        path_with_namespace: p.path_with_namespace,
        default_branch: p.default_branch,
        visibility: p.visibility,
        archived: p.archived,
        description: p.description,
      });
    }
    if (batch.length < perPage) break;
  }

  return projects;
}

/**
 * Get the default branch for a specific GitLab project.
 */
export async function getGitLabProjectDefaultBranch(
  projectId: string,
  token: string,
  baseUrl?: string,
): Promise<string> {
  const api = apiBase(baseUrl);
  const res = await fetch(
    `${api}/projects/${encodeURIComponent(projectId)}`,
    { headers: makeHeaders(token) },
  );
  if (!res.ok) return "main";
  const data = (await res.json()) as GitLabProjectResponse;
  return data.default_branch || "main";
}
