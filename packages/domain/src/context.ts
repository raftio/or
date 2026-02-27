/**
 * RFC-008: Synthesized context shape for bundling and API
 */
export interface SynthesizedContextAc {
  id: string;
  description: string;
}

export interface SynthesizedContextSection {
  id: string;
  title: string;
  body: string;
}

export interface SynthesizedContext {
  ticket_id: string;
  /** Canonical key from the ticket provider (e.g. "owner/repo#42"). */
  ticket_key: string;
  ticket_title: string;
  ticket_description: string;
  acceptance_criteria: SynthesizedContextAc[];
  sections?: SynthesizedContextSection[];
  excerpts?: string[];
  related_ticket_ids?: string[];
}

export interface ContextSynthesisInput {
  ticket_id: string;
  spec_ref?: string;
}
