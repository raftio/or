/**
 * RFC-009: Ticket Provider Adapter – normalized DTOs
 */
export interface AcceptanceCriterionDto {
  id: string;
  description: string;
}

export interface TicketDto {
  id: string;
  key: string;
  title: string;
  description: string;
  status: string;
  acceptance_criteria?: AcceptanceCriterionDto[];
  links?: string[];
  updated_at?: string;
}

export interface ListTicketsQuery {
  project?: string;
  filter?: string;
  query?: string;
}
