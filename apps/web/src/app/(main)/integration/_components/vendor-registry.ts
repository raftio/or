import type { ComponentType } from "react";

import { JiraCard } from "./jira-card";
import { GitHubIssuesCard } from "./github-issues-card";
import { GitHubCodeCard } from "./github-code-card";
import { GitLabIssuesCard } from "./gitlab-issues-card";
import { GitLabCodeCard } from "./gitlab-code-card";
import { IdeCard } from "./ide-card";
import { NotionCard } from "./notion-card";
import { ConfluenceCard } from "./confluence-card";

import { JiraForm } from "./jira-form";
import { GitHubIssuesForm } from "./github-issues-form";
import { GitHubCodeForm } from "./github-code-form";
import { GitLabIssuesForm } from "./gitlab-issues-form";
import { GitLabCodeForm } from "./gitlab-code-form";
import { IdeSetup } from "./ide-setup";
import { NotionForm } from "./notion-form";
import { ConfluenceForm } from "./confluence-form";

export interface IntegrationFormProps {
  workspaceId: string;
  token: string;
  integration: any;
  isAdmin: boolean;
  onUpdate: () => void;
}

export type SourceType = "tasks" | "docs" | "code" | "evidence" | "cicd";

export interface IndexStatus {
  repo: string;
  status: "pending" | "indexing" | "ready" | "failed";
  total_files: number;
  indexed_files: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface VendorCardProps {
  connected: boolean;
  onClick: () => void;
  /** Vendor type label (e.g. "Jira Cloud", "GitLab Code"). Passed automatically by VendorList. */
  vendorTitle?: string;
  /** Short human-readable summary of the connection scope (e.g. "raftio/or", "All projects"). */
  detail?: string;
  /** Index statuses for code integrations, shown on the card. */
  indexStatuses?: IndexStatus[];
}

export interface VendorConfig {
  id: string;
  title: string;
  sourceType: SourceType;
  /** Provider key in workspace_integrations. Undefined = no backend state. */
  integrationProvider?: string;
  cardComponent: ComponentType<VendorCardProps>;
  /** Form shown in the drawer. Receives IntegrationFormProps when integrationProvider is set. */
  formComponent?: ComponentType<any>;
  /** Extract a displayable connection summary from the stored integration config. */
  describeConnection?: (integration: any) => string | undefined;
  /** API path segment for fetching index status (e.g. "github-code"). */
  statusEndpoint?: string;
}

export const VENDORS: VendorConfig[] = [
  {
    id: "jira",
    title: "Jira Cloud",
    sourceType: "tasks",
    integrationProvider: "jira",
    cardComponent: JiraCard,
    formComponent: JiraForm,
    describeConnection: (i) => {
      const url = i?.config?.base_url as string | undefined;
      const site = url?.replace(/^https?:\/\//, "").replace(/\.atlassian\.net\/?$/, "");
      const scope = (i?.config?.project_key as string) || "All projects";
      return site ? `${site} / ${scope}` : scope;
    },
  },
  {
    id: "github",
    title: "GitHub Issues",
    sourceType: "tasks",
    integrationProvider: "github",
    cardComponent: GitHubIssuesCard,
    formComponent: GitHubIssuesForm,
    describeConnection: (i) =>
      i?.config?.owner && i?.config?.repo
        ? `${i.config.owner}/${i.config.repo}`
        : undefined,
  },
  {
    id: "gitlab",
    title: "GitLab Issues",
    sourceType: "tasks",
    integrationProvider: "gitlab",
    cardComponent: GitLabIssuesCard,
    formComponent: GitLabIssuesForm,
    describeConnection: (i) => i?.config?.project_id,
  },
  {
    id: "notion",
    title: "Notion",
    sourceType: "docs",
    integrationProvider: "notion",
    cardComponent: NotionCard,
    formComponent: NotionForm,
  },
  {
    id: "confluence",
    title: "Confluence",
    sourceType: "docs",
    integrationProvider: "confluence",
    cardComponent: ConfluenceCard,
    formComponent: ConfluenceForm,
    describeConnection: (i) => {
      const url = i?.config?.base_url as string | undefined;
      return url?.replace(/^https?:\/\//, "").replace(/\/wiki\/?$/, "").replace(/\.atlassian\.net\/?$/, "") || undefined;
    },
  },
  {
    id: "github_code",
    title: "GitHub Code",
    sourceType: "code",
    integrationProvider: "github_code",
    cardComponent: GitHubCodeCard,
    formComponent: GitHubCodeForm,
    describeConnection: (i) => {
      const owner = i?.config?.owner;
      const repos: unknown[] = Array.isArray(i?.config?.repos)
        ? i.config.repos
        : i?.config?.repo
          ? [i.config.repo]
          : [];
      if (repos.length === 1) return `${owner}/${repos[0]}`;
      if (repos.length > 1) return "Multiple repositories";
      return owner || undefined;
    },
    statusEndpoint: "github-code",
  },
  {
    id: "gitlab_code",
    title: "GitLab Code",
    sourceType: "code",
    integrationProvider: "gitlab_code",
    cardComponent: GitLabCodeCard,
    formComponent: GitLabCodeForm,
    describeConnection: (i) => {
      const projects: unknown[] = Array.isArray(i?.config?.projects)
        ? i.config.projects
        : i?.config?.project_id
          ? [i.config.project_id]
          : [];
      if (projects.length === 1) return String(projects[0]);
      if (projects.length > 1) return "Multiple projects";
      return i?.config?.group || undefined;
    },
    statusEndpoint: "gitlab-code",
  },
  {
    id: "ide",
    title: "IDE / Agent",
    sourceType: "code",
    cardComponent: IdeCard,
    formComponent: IdeSetup,
  },
];
