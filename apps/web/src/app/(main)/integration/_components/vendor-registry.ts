import type { ComponentType } from "react";

import { JiraCard } from "./jira-card";
import { GitHubIssuesCard } from "./github-issues-card";
import { IdeCard } from "./ide-card";
import { NotionCard } from "./notion-card";

import { JiraForm } from "./jira-form";
import { GitHubIssuesForm } from "./github-issues-form";
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

export interface VendorConfig {
  id: string;
  title: string;
  sourceType: SourceType;
  /** Provider key in workspace_integrations. Undefined = no backend state. */
  integrationProvider?: string;
  cardComponent: ComponentType<{ connected: boolean; onClick: () => void }>;
  /** Form shown in the drawer. Receives IntegrationFormProps when integrationProvider is set. */
  formComponent?: ComponentType<any>;
}

export const VENDORS: VendorConfig[] = [
  {
    id: "jira",
    title: "Jira Cloud",
    sourceType: "tasks",
    integrationProvider: "jira",
    cardComponent: JiraCard,
    formComponent: JiraForm,
  },
  {
    id: "github",
    title: "GitHub Issues",
    sourceType: "tasks",
    integrationProvider: "github",
    cardComponent: GitHubIssuesCard,
    formComponent: GitHubIssuesForm,
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
    id: "ide",
    title: "IDE / Agent",
    sourceType: "code",
    cardComponent: IdeCard,
    formComponent: IdeSetup,
  },
];
