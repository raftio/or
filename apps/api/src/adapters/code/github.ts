/**
 * GitHub code provider — fetches repository files via GitHub REST API.
 * Auth: Bearer token (PAT or fine-grained token).
 */
import type { CodeProvider } from "./contract.js";
import type { ListFilesOptions } from "./types.js";

const GITHUB_API = "https://api.github.com";

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface GitHubContentResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  content?: string;
  encoding?: string;
}

interface GitHubRepoResponse {
  full_name: string;
  name: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  description: string | null;
}

export interface GitHubRepoSummary {
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
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
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export function createGitHubCodeProvider(
  owner: string,
  repo: string,
  token: string,
  defaultBranch = "main",
): CodeProvider {
  const headers = makeHeaders(token);

  async function fetchJson<T>(url: string): Promise<T | null> {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return (await res.json()) as T;
  }

  return {
    async getFile(path, ref = defaultBranch) {
      const url =
        `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
        `/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`;

      const data = await fetchJson<GitHubContentResponse>(url);
      if (!data?.content) return null;

      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return {
        path: data.path,
        content,
        sha: data.sha,
        size: data.size,
        language: inferLanguage(data.path),
      };
    },

    async getTree(ref = defaultBranch) {
      const url =
        `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
        `/git/trees/${encodeURIComponent(ref)}?recursive=1`;

      const data = await fetchJson<GitHubTreeResponse>(url);
      if (!data) return [];

      return data.tree
        .filter((item) => item.type === "blob" || item.type === "tree")
        .map((item) => ({
          path: item.path,
          type: item.type,
          sha: item.sha,
          size: item.size,
        }));
    },

    async *listFiles(options?: ListFilesOptions) {
      const ref = options?.ref ?? defaultBranch;
      const tree = await this.getTree(ref);
      const blobs = tree.filter((e) => e.type === "blob");

      for (const blob of blobs) {
        if (options?.pathPrefix && !blob.path.startsWith(options.pathPrefix)) {
          continue;
        }
        if (options?.extensions?.length) {
          const ext = blob.path.slice(blob.path.lastIndexOf(".")).toLowerCase();
          if (!options.extensions.includes(ext)) continue;
        }
        if (options?.maxFileSize && blob.size && blob.size > options.maxFileSize) {
          continue;
        }

        const file = await this.getFile(blob.path, ref);
        if (file) yield file;
      }
    },

    async testConnection() {
      const url =
        `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
      const data = await fetchJson<GitHubRepoResponse>(url);
      if (!data) throw new Error("Could not reach repository — check owner/repo and token");
      return { name: data.full_name };
    },

    async getHeadSha(ref = defaultBranch) {
      const res = await fetch(
        `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}`,
        { headers: { ...headers, Accept: "application/vnd.github.sha" } },
      );
      if (!res.ok) return null;
      return (await res.text()).trim();
    },
  };
}

/**
 * Verify GitHub code access by fetching the repository metadata.
 */
export async function testGitHubCodeConnection(
  owner: string,
  repo: string,
  token: string,
): Promise<{ fullName: string; defaultBranch: string }> {
  const res = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers: makeHeaders(token) },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Invalid token — check your GitHub Personal Access Token"
        : res.status === 404
          ? "Repository not found — check owner and repo name"
          : `GitHub responded with ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as GitHubRepoResponse;
  return { fullName: data.full_name, defaultBranch: data.default_branch };
}

/**
 * List repositories accessible to the token for a given owner (user or org).
 * Tries the org endpoint first, falls back to the user endpoint.
 */
export async function listGitHubRepos(
  owner: string,
  token: string,
): Promise<GitHubRepoSummary[]> {
  const headers = makeHeaders(token);
  const repos: GitHubRepoSummary[] = [];
  const perPage = 100;

  async function fetchPage(url: string): Promise<GitHubRepoResponse[]> {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    return (await res.json()) as GitHubRepoResponse[];
  }

  // Try org endpoint first, fall back to user endpoint
  const baseUrls = [
    `${GITHUB_API}/orgs/${encodeURIComponent(owner)}/repos`,
    `${GITHUB_API}/users/${encodeURIComponent(owner)}/repos`,
  ];

  for (const baseUrl of baseUrls) {
    for (let page = 1; ; page++) {
      const url = `${baseUrl}?per_page=${perPage}&page=${page}&sort=full_name`;
      const batch = await fetchPage(url);
      if (batch.length === 0 && page === 1 && baseUrl.includes("/orgs/")) break;
      for (const r of batch) {
        repos.push({
          name: r.name,
          full_name: r.full_name,
          default_branch: r.default_branch,
          private: r.private,
          archived: r.archived,
          description: r.description,
        });
      }
      if (batch.length < perPage) break;
    }
    if (repos.length > 0) break;
  }

  return repos;
}

/**
 * Get the default branch for a specific repo.
 */
export async function getRepoDefaultBranch(
  owner: string,
  repo: string,
  token: string,
): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers: makeHeaders(token) },
  );
  if (!res.ok) return "main";
  const data = (await res.json()) as GitHubRepoResponse;
  return data.default_branch;
}
