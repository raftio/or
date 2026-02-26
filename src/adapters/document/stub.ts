/**
 * Stub document provider – mock spec for any ref (no Confluence/Notion)
 */
import type { DocumentProvider } from "./contract.js";
import type { SpecDocumentDto } from "./types.js";

const MOCK_SPEC: SpecDocumentDto = {
  ref: "mock-spec",
  title: "Mock specification",
  sections: [
    { id: "s1", title: "Overview", body: "This is the overview section." },
    { id: "s2", title: "Requirements", body: "Functional and non-functional requirements." },
    { id: "s3", title: "Implementation notes", body: "Technical notes for implementation." },
  ],
  acceptance_criteria: [
    { id: "spec-ac/1", description: "Feature matches spec overview" },
    { id: "spec-ac/2", description: "All requirements are met" },
  ],
  updated_at: new Date().toISOString(),
};

export function createStubDocumentProvider(): DocumentProvider {
  return {
    async getDocument(ref: string): Promise<SpecDocumentDto | null> {
      return {
        ...MOCK_SPEC,
        ref,
        title: `Spec: ${ref}`,
      };
    },
  };
}
