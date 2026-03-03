/**
 * RFC-009: Jira Cloud ticket provider (REST API v3)
 * Auth: Basic (email:apiToken) per Jira Cloud convention.
 */
import type { TicketProvider } from "./contract.js";
import type { AcceptanceCriterionDto, SubTaskDto, TicketDto } from "./types.js";

interface JiraSubTask {
  id: string;
  key: string;
  fields: { summary: string; status?: { name: string } };
}

interface JiraIssueFields {
  summary: string;
  description: unknown;
  status?: { name: string };
  updated?: string;
  subtasks?: JiraSubTask[];
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

function mapSubTasks(raw?: JiraSubTask[]): SubTaskDto[] | undefined {
  if (!raw?.length) return undefined;
  return raw.map((s) => ({
    id: s.id,
    key: s.key,
    title: s.fields.summary ?? "",
    status: s.fields.status?.name ?? "Unknown",
  }));
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
    subtasks: mapSubTasks(issue.fields.subtasks),
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

  const issueFields = "summary,description,status,updated,subtasks";

  return {
    async getTicket(id: string): Promise<TicketDto | null> {
      try {
        const res = await fetch(
          `${origin}/rest/api/3/issue/${encodeURIComponent(id)}?fields=${issueFields}`,
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
          `${origin}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=${issueFields}`,
          { headers },
        );
        if (!res.ok) return [];
        const data = (await res.json()) as JiraSearchResponse;
        return data.issues.map(mapIssueToDto);
      } catch {
        return [];
      }
    },

    async addComment(ticketId: string, body: string) {
      const adf = {
        version: 1,
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: body }] }],
      };

      const res = await fetch(
        `${origin}/rest/api/3/issue/${encodeURIComponent(ticketId)}/comment`,
        { method: "POST", headers, body: JSON.stringify({ body: adf }) },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to add comment (${res.status}): ${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as { id: string };
      return { id: data.id };
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

export interface JiraProjectInfo {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  style: string;
}

/**
 * List all Jira projects accessible with the given credentials.
 * Uses GET /rest/api/3/project (paginated, returns up to 200).
 */
export async function listJiraProjects(
  baseUrl: string,
  email: string,
  apiToken: string,
): Promise<JiraProjectInfo[]> {
  const origin = baseUrl.replace(/\/+$/, "");
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  const res = await fetch(
    `${origin}/rest/api/3/project?maxResults=200&orderBy=name`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to list projects: ${res.status} ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as JiraProjectInfo[];
  return data.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    projectTypeKey: p.projectTypeKey,
    style: p.style,
  }));
}
