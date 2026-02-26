/**
 * RFC-011: Git Provider Adapter contract
 */
import type { PullRequestDto } from "./types.js";

export interface GitProvider {
  getPullRequest(repo: string, prId: string): Promise<PullRequestDto | null>;
  extractTicketId(pr: PullRequestDto): string | null;
}
