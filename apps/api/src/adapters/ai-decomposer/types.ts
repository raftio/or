import type { SynthesizedContextAc, SynthesizedContextSection } from "@orqestra/domain";

export interface DecomposeInput {
  ticket_title: string;
  ticket_description: string;
  sections?: SynthesizedContextSection[];
  acceptance_criteria: SynthesizedContextAc[];
}
