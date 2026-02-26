/**
 * RFC-011: GitHub Git provider (REST API)
 * Requires GITHUB_TOKEN env.
 */
import type { GitProvider } from "./contract.js";
import type { PullRequestDto, PullRequestState } from "./types.js";
import { extractTicketIdFromText } from "./extract-ticket.js";

const GITHUB_API = "https://api.github.com";

function mapState(state: string, merged: boolean | null): PullRequestState {
  if (merged === true) return "merged";
  if (state === "open") return "open";
  return "closed";
}

export function createGitHubGitProvider(token: string): GitProvider {
  return {
    async getPullRequest(
      repo: string,
      prId: string
    ): Promise<PullRequestDto | null> {
      try {
        const res = await fetch(
          `${GITHUB_API}/repos/${repo}/pulls/${prId}`,
          {
            headers: {
              Accept: "application/vnd.github.v3+json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (res.status === 404) return null;
        if (!res.ok) return null;
        const data = (await res.json()) as {
          title: string;
          body: string | null;
          state: string;
          merged_at: string | null;
          head: { ref: string; sha: string };
          base: { ref: string };
          user?: { login?: string };
          updated_at?: string;
        };
        const dto: PullRequestDto = {
          repo,
          pr_id: String(prId),
          title: data.title ?? "",
          description: data.body ?? "",
          state: mapState(data.state, data.merged_at != null),
          source_branch: data.head.ref,
          target_branch: data.base.ref,
          head_sha: data.head.sha,
          author: data.user?.login,
          updated_at: data.updated_at,
        };
        return dto;
      } catch {
        return null;
      }
    },
    extractTicketId(pr: PullRequestDto): string | null {
      return extractTicketIdFromText(
        pr.title,
        pr.description,
        pr.source_branch
      );
    },
  };
}
