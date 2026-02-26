/**
 * RFC-010: Document Provider Adapter – normalized DTOs for spec/docs
 */
export interface SpecSectionDto {
  id: string;
  title: string;
  body: string;
}

export interface SpecAcceptanceCriterionDto {
  id: string;
  description: string;
}

export interface SpecDocumentDto {
  ref: string;
  title: string;
  sections: SpecSectionDto[];
  acceptance_criteria?: SpecAcceptanceCriterionDto[];
  updated_at?: string;
}
