import type { SynthesizedContextAc, SynthesizedContextSection } from "@or/domain";

export interface CodeContextEntry {
  file: string;
  lines: string;
  language: string | null;
  code: string;
}

export interface DecomposeInput {
  ticket_title: string;
  ticket_description: string;
  sections?: SynthesizedContextSection[];
  acceptance_criteria: SynthesizedContextAc[];
  code_context?: CodeContextEntry[];
}
