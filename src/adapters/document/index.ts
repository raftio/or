import { createStubDocumentProvider } from "./stub.js";

export type { DocumentProvider } from "./contract.js";
export type { SpecDocumentDto, SpecSectionDto, SpecAcceptanceCriterionDto } from "./types.js";

export function createDocumentProvider(): ReturnType<typeof createStubDocumentProvider> {
  return createStubDocumentProvider();
}
