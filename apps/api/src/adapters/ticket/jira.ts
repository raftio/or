/**
 * RFC-009: Jira Cloud ticket provider (REST API v3)
 * Auth: Basic (email:apiToken) per Jira Cloud convention.
 */
import type { TicketProvider } from "./contract.js";
import type { AcceptanceCriterionDto, TicketDto } from "./types.js";

interface JiraIssueFields {
  summary: string;
  description: unknown;
  status?: { name: string };
  updated?: string;
}

interface JiraIssue {
  id: string;
  key: string;
  fields: JiraIssueFields;
}

interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
}

/**
 * Jira Cloud uses Atlassian Document Format (ADF) for descriptions.
 * Extract plain text recursively from an ADF node tree.
 */
function adfToPlainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) {
    return (n.content as unknown[])
      .map(adfToPlainText)
      .join(n.type === "paragraph" || n.type === "heading" ? "\n" : "");
  }
  return "";
}

function parseDescriptionForAC(description: string): AcceptanceCriterionDto[] {
  if (!description.trim()) return [];
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

function mapIssueToDto(issue: JiraIssue): TicketDto {
  const descriptionText =
    typeof issue.fields.description === "string"
      ? issue.fields.description
      : adfToPlainText(issue.fields.description);

  const acs = parseDescriptionForAC(descriptionText);

  return {
    id: issue.id,
    key: issue.key,
    title: issue.fields.summary ?? "",
    description: descriptionText,
    status: issue.fields.status?.name ?? "Unknown",
    acceptance_criteria: acs.length ? acs : undefined,
    links: [],
    updated_at: issue.fields.updated,
  };
}

export function createJiraTicketProvider(
  baseUrl: string,
  email: string,
  apiToken: string,
): TicketProvider {
  const origin = baseUrl.replace(/\/+$/, "");
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  return {
    async getTicket(id: string): Promise<TicketDto | null> {
      try {
        const res = await fetch(
          `${origin}/rest/api/3/issue/${encodeURIComponent(id)}?fields=summary,description,status,updated`,
          { headers },
        );
        if (!res.ok) return null;
        const issue = (await res.json()) as JiraIssue;
        return mapIssueToDto(issue);
      } catch {
        return null;
      }
    },

    async listTickets(query) {
      const jql = query?.query || query?.project
        ? `project = "${query.project}"${query.filter ? ` AND ${query.filter}` : ""}`
        : undefined;
      if (!jql) return [];

      try {
        const res = await fetch(
          `${origin}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,description,status,updated`,
          { headers },
        );
        if (!res.ok) return [];
        const data = (await res.json()) as JiraSearchResponse;
        return data.issues.map(mapIssueToDto);
      } catch {
        return [];
      }
    },
  };
}

/**
 * Verify Jira credentials by calling GET /rest/api/3/myself.
 * Returns the display name on success, or throws on failure.
 */
export async function testJiraConnection(
  baseUrl: string,
  email: string,
  apiToken: string,
): Promise<{ displayName: string; emailAddress: string }> {
  const origin = baseUrl.replace(/\/+$/, "");
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  const res = await fetch(`${origin}/rest/api/3/myself`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Invalid credentials — check your email and API token"
        : `Jira responded with ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    displayName: string;
    emailAddress: string;
  };
  return { displayName: data.displayName, emailAddress: data.emailAddress };
}
