import type { ComponentType } from "react";

import { JiraCard } from "./jira-card";
import { GitHubIssuesCard } from "./github-issues-card";
import { GitHubCodeCard } from "./github-code-card";
import { GitLabIssuesCard } from "./gitlab-issues-card";
import { GitLabCodeCard } from "./gitlab-code-card";
import { IdeCard } from "./ide-card";
import { NotionCard } from "./notion-card";

import { JiraForm } from "./jira-form";
import { GitHubIssuesForm } from "./github-issues-form";
import { GitHubCodeForm } from "./github-code-form";
import { GitLabIssuesForm } from "./gitlab-issues-form";
import { GitLabCodeForm } from "./gitlab-code-form";
import { IdeSetup } from "./ide-setup";
import { NotionForm } from "./notion-form";

export interface IntegrationFormProps {
  workspaceId: string;
  token: string;
  integration: any;
  isAdmin: boolean;
  onUpdate: () => void;
}

export type SourceType = "tasks" | "docs" | "code" | "evidence" | "cicd";

export interface VendorCardProps {
  connected: boolean;
  onClick: () => void;
  /** Short human-readable summary of the connection (e.g. "raftio/or"). */
  detail?: string;
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
}

export const VENDORS: VendorConfig[] = [
  {
    id: "jira",
    title: "Jira Cloud",
    sourceType: "tasks",
    integrationProvider: "jira",
    cardComponent: JiraCard,
    formComponent: JiraForm,
    describeConnection: (i) => i?.config?.base_url,
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
    id: "github_code",
    title: "GitHub Code",
    sourceType: "code",
    integrationProvider: "github_code",
    cardComponent: GitHubCodeCard,
    formComponent: GitHubCodeForm,
    describeConnection: (i) =>
      i?.config?.owner && i?.config?.repo
        ? `${i.config.owner}/${i.config.repo}`
        : undefined,
  },
  {
    id: "gitlab_code",
    title: "GitLab Code",
    sourceType: "code",
    integrationProvider: "gitlab_code",
    cardComponent: GitLabCodeCard,
    formComponent: GitLabCodeForm,
    describeConnection: (i) => i?.config?.project_id,
  },
  {
    id: "ide",
    title: "IDE / Agent",
    sourceType: "code",
    cardComponent: IdeCard,
    formComponent: IdeSetup,
  },
];
