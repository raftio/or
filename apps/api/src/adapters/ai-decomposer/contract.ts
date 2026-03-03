import type { DecompositionResult } from "@or/domain";
import type { DecomposeInput } from "./types.js";

export interface BundleDecomposer {
  decompose(input: DecomposeInput): Promise<DecompositionResult>;
}
