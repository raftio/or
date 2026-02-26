/**
 * Stub Git provider – mock PR for dev without token
 */
import type { GitProvider } from "./contract.js";
import type { PullRequestDto } from "./types.js";
import { extractTicketIdFromText } from "./extract-ticket.js";

const MOCK_PR: Omit<PullRequestDto, "repo" | "pr_id"> = {
  title: "feat: Add login flow",
  description: "Implements PROJ-1. Adds email/password login.",
  state: "open",
  source_branch: "feature/PROJ-1-login",
  target_branch: "main",
  head_sha: "abc123def456",
  author: "dev@example.com",
  updated_at: new Date().toISOString(),
};

export function createStubGitProvider(): GitProvider {
  return {
    async getPullRequest(repo: string, prId: string): Promise<PullRequestDto | null> {
      return {
        ...MOCK_PR,
        repo,
        pr_id: prId,
        title: `PR #${prId} for ${repo}`,
      };
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
