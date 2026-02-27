/**
 * RFC-009: GitHub Issues ticket provider (REST API)
 * Auth: Bearer token (PAT or fine-grained token)
 */
import type { TicketProvider } from "./contract.js";
import type { AcceptanceCriterionDto, TicketDto } from "./types.js";

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  updated_at: string;
  html_url: string;
  labels: Array<{ name: string }>;
  pull_request?: unknown;
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubIssue[];
}

function parseDescriptionForAC(description: string | null): AcceptanceCriterionDto[] {
  if (!description?.trim()) return [];
  const acs: AcceptanceCriterionDto[] = [];
  const lines = description.split(/\n/);
  let index = 0;
  for (const line of lines) {
    const match =
      line.match(/^(?:[-*]?\s*)(?:AC:?\s*)(.+)$/i) ||
      line.match(/^(\d+\.)\s*(.+)$/);
    if (match) {
      const desc = (match[2] ?? match[1]).trim();
      if (desc) acs.push({ id: `ac/${++index}`, description: desc });
    }
  }
  if (acs.length === 0 && description.trim()) {
    acs.push({ id: "ac/1", description: description.trim().slice(0, 500) });
  }
  return acs;
}

function mapIssueToDto(issue: GitHubIssue, owner: string, repo: string): TicketDto {
  const description = issue.body ?? "";
  const acs = parseDescriptionForAC(description);

  return {
    id: String(issue.id),
    key: `${owner}/${repo}#${issue.number}`,
    title: issue.title,
    description,
    status: issue.state,
    acceptance_criteria: acs.length ? acs : undefined,
    links: [issue.html_url],
    updated_at: issue.updated_at,
  };
}

export function createGitHubIssuesProvider(
  owner: string,
  repo: string,
  token: string,
): TicketProvider {
  const baseUrl = "https://api.github.com";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  return {
    async getTicket(id: string): Promise<TicketDto | null> {
      try {
        const issueNumber = id.includes("#") ? id.split("#").pop() : id;
        const res = await fetch(
          `${baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
          { headers },
        );
        if (!res.ok) return null;
        const issue = (await res.json()) as GitHubIssue;
        if (issue.pull_request) return null;
        return mapIssueToDto(issue, owner, repo);
      } catch {
        return null;
      }
    },

    async listTickets(query) {
      try {
        const q = query?.query
          ? `repo:${owner}/${repo} is:issue ${query.query}`
          : `repo:${owner}/${repo} is:issue is:open`;
        const res = await fetch(
          `${baseUrl}/search/issues?q=${encodeURIComponent(q)}&per_page=50`,
          { headers },
        );
        if (!res.ok) return [];
        const data = (await res.json()) as GitHubSearchResponse;
        return data.items.map((i) => mapIssueToDto(i, owner, repo));
      } catch {
        return [];
      }
    },
  };
}

/**
 * Verify GitHub credentials by calling GET /user.
 */
export async function testGitHubConnection(
  token: string,
): Promise<{ login: string; name: string | null }> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Invalid token — check your GitHub Personal Access Token"
        : `GitHub responded with ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { login: string; name: string | null };
  return { login: data.login, name: data.name };
}
