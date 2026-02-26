/**
 * RFC-011: Git Provider Adapter – normalized DTOs for PR metadata
 */
export type PullRequestState = "open" | "merged" | "closed";

export interface PullRequestDto {
  repo: string;
  pr_id: string;
  title: string;
  description: string;
  state: PullRequestState;
  source_branch: string;
  target_branch: string;
  head_sha: string;
  author?: string;
  updated_at?: string;
}
