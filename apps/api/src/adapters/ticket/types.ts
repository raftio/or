/**
 * RFC-009: Ticket Provider Adapter – normalized DTOs
 */
export interface AcceptanceCriterionDto {
  id: string;
  description: string;
}

export interface SubTaskDto {
  id: string;
  key: string;
  title: string;
  status: string;
}

export interface TicketDto {
  id: string;
  key: string;
  title: string;
  description: string;
  status: string;
  acceptance_criteria?: AcceptanceCriterionDto[];
  subtasks?: SubTaskDto[];
  links?: string[];
  updated_at?: string;
}

export interface ListTicketsQuery {
  project?: string;
  filter?: string;
  query?: string;
}

export interface CreateTicketInput {
  title: string;
  description?: string;
  labels?: string[];
}
