import type { DecompositionResult } from "@orqestra/domain";
import type { DecomposeInput } from "./types.js";

export interface BundleDecomposer {
  decompose(input: DecomposeInput): Promise<DecompositionResult>;
}
