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
