/**
 * RFC-009: Linear ticket provider (GraphQL)
 * Requires LINEAR_API_KEY env.
 */
import type { TicketProvider } from "./contract.js";
import type { AcceptanceCriterionDto, TicketDto } from "./types.js";

const LINEAR_GRAPHQL = "https://api.linear.app/graphql";

interface LinearIssue {
  id: string;
  identifier: string;
  title: string | null;
  description: string | null;
  state?: { name: string } | null;
  updatedAt: string;
}

function parseDescriptionForAC(description: string | null): AcceptanceCriterionDto[] {
  if (!description?.trim()) return [];
  const acs: AcceptanceCriterionDto[] = [];
  const lines = description.split(/\n/);
  let index = 0;
  for (const line of lines) {
    const match = line.match(/^(?:[-*]?\s*)(?:AC:?\s*)(.+)$/i) || line.match(/^(\d+\.)\s*(.+)$/);
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

export function createLinearTicketProvider(apiKey: string): TicketProvider {
  return {
    async getTicket(id: string): Promise<TicketDto | null> {
      try {
        const res = await fetch(LINEAR_GRAPHQL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: apiKey,
          },
          body: JSON.stringify({
            query: `
              query FindIssue($identifier: String!) {
                issues(filter: { identifier: { eq: $identifier } }, first: 1) {
                  nodes {
                    id
                    identifier
                    title
                    description
                    state { name }
                    updatedAt
                  }
                }
              }
            `,
            variables: { identifier: id },
          }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as {
          data?: { issues?: { nodes?: LinearIssue[] } };
          errors?: unknown[];
        };
        if (json.errors?.length) return null;
        const nodes = json.data?.issues?.nodes;
        if (!nodes?.length) return null;
        const issue = nodes[0];
        const acs = parseDescriptionForAC(issue.description ?? null);
        const dto: TicketDto = {
          id: issue.id,
          key: issue.identifier,
          title: issue.title ?? "",
          description: issue.description ?? "",
          status: issue.state?.name ?? "Unknown",
          acceptance_criteria: acs.length ? acs : undefined,
          links: [],
          updated_at: issue.updatedAt,
        };
        return dto;
      } catch {
        return null;
      }
    },
  };
}
