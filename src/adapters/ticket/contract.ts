/**
 * RFC-009: Ticket Provider Adapter contract
 */
import type { ListTicketsQuery, TicketDto } from "./types.js";

export interface TicketProvider {
  getTicket(id: string): Promise<TicketDto | null>;
  listTickets?(query: ListTicketsQuery): Promise<TicketDto[]>;
}
