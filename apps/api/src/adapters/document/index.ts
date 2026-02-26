import type { DocumentProvider } from "./contract.js";
import { createConfluenceDocumentProvider } from "./confluence.js";
import { createNotionDocumentProvider } from "./notion.js";
import { createStubDocumentProvider } from "./stub.js";
import {
  getDocumentProvider,
  getConfluenceBaseUrl,
  getConfluenceEmail,
  getConfluenceApiToken,
  getNotionApiKey,
} from "../../config.js";

export type { DocumentProvider } from "./contract.js";
export type { SpecDocumentDto, SpecSectionDto, SpecAcceptanceCriterionDto } from "./types.js";

export function createDocumentProvider(): DocumentProvider {
  const kind = getDocumentProvider();
  if (kind === "confluence") {
    const baseUrl = getConfluenceBaseUrl();
    const email = getConfluenceEmail();
    const apiToken = getConfluenceApiToken();
    if (baseUrl && email && apiToken)
      return createConfluenceDocumentProvider({ baseUrl, email, apiToken });
  }
  if (kind === "notion") {
    const apiKey = getNotionApiKey();
    if (apiKey) return createNotionDocumentProvider({ apiKey });
  }
  return createStubDocumentProvider();
}
