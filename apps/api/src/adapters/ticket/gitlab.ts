/**
 * GitLab Issues ticket provider (REST API v4)
 * Auth: PRIVATE-TOKEN header (Personal Access Token)
 */
import type { TicketProvider } from "./contract.js";
import type { AcceptanceCriterionDto, CreateTicketInput, TicketDto } from "./types.js";

interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: string;
  updated_at: string;
  web_url: string;
  labels: string[];
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

function mapIssueToDto(issue: GitLabIssue, projectId: string): TicketDto {
  const description = issue.description ?? "";
  const acs = parseDescriptionForAC(description);

  return {
    id: String(issue.id),
    key: `${projectId}#${issue.iid}`,
    title: issue.title,
    description,
    status: issue.state,
    acceptance_criteria: acs.length ? acs : undefined,
    links: [issue.web_url],
    updated_at: issue.updated_at,
  };
}

export function createGitLabIssuesProvider(
  projectId: string,
  token: string,
  baseUrl = "https://gitlab.com",
): TicketProvider {
  const apiBase = `${baseUrl.replace(/\/+$/, "")}/api/v4`;
  const encodedProject = encodeURIComponent(projectId);
  const headers: Record<string, string> = {
    "PRIVATE-TOKEN": token,
    "Content-Type": "application/json",
  };

  return {
    async getTicket(id: string): Promise<TicketDto | null> {
      try {
        const iid = id.includes("#") ? id.split("#").pop() : id;
        const res = await fetch(
          `${apiBase}/projects/${encodedProject}/issues/${iid}`,
          { headers },
        );
        if (!res.ok) return null;
        const issue = (await res.json()) as GitLabIssue;
        return mapIssueToDto(issue, projectId);
      } catch {
        return null;
      }
    },

    async listTickets(query) {
      try {
        const search = query?.query ? `&search=${encodeURIComponent(query.query)}` : "";
        const res = await fetch(
          `${apiBase}/projects/${encodedProject}/issues?state=opened&per_page=50${search}`,
          { headers },
        );
        if (!res.ok) return [];
        const issues = (await res.json()) as GitLabIssue[];
        return issues.map((i) => mapIssueToDto(i, projectId));
      } catch {
        return [];
      }
    },

    async createTicket(input: CreateTicketInput): Promise<TicketDto> {
      const res = await fetch(
        `${apiBase}/projects/${encodedProject}/issues`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: input.title,
            description: input.description ?? "",
            labels: input.labels?.join(",") ?? "",
          }),
        },
      );

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `GitLab responded with ${res.status}: ${body.slice(0, 300)}`,
        );
      }

      const issue = (await res.json()) as GitLabIssue;
      return mapIssueToDto(issue, projectId);
    },
  };
}

/**
 * Verify GitLab credentials by calling GET /user.
 */
export async function testGitLabConnection(
  accessToken: string,
  baseUrl = "https://gitlab.com",
): Promise<{ username: string; name: string }> {
  const apiBase = `${baseUrl.replace(/\/+$/, "")}/api/v4`;
  const res = await fetch(`${apiBase}/user`, {
    headers: { "PRIVATE-TOKEN": accessToken },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Invalid token — check your GitLab Personal Access Token"
        : `GitLab responded with ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { username: string; name: string };
  return { username: data.username, name: data.name };
}
