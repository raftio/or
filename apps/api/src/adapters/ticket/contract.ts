/**
 * RFC-009: Ticket Provider Adapter contract
 */
import type { CreateTicketInput, ListTicketsQuery, TicketDto } from "./types.js";

export interface TicketProvider {
  getTicket(id: string): Promise<TicketDto | null>;
  listTickets?(query: ListTicketsQuery): Promise<TicketDto[]>;
  createTicket?(input: CreateTicketInput): Promise<TicketDto>;
  addComment?(ticketId: string, body: string): Promise<{ id: string }>;
}
