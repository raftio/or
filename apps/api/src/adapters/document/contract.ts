/**
 * RFC-010: Document Provider Adapter contract
 */
import type { SpecDocumentDto } from "./types.js";

export interface DocumentProvider {
  getDocument(ref: string): Promise<SpecDocumentDto | null>;
}
