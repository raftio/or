import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { BundleDecomposer } from "./contract.js";
import { createRuleBasedDecomposer } from "./rule-based.js";
import { createLlmDecomposer } from "./llm.js";
import {
  getAiDecomposerProvider,
  getAiDecomposerModel,
  getOpenAiApiKey,
  getAnthropicApiKey,
  type AiDecomposerProvider,
} from "../../config.js";
import { query } from "../../db/index.js";

export type { BundleDecomposer } from "./contract.js";
export type { DecomposeInput } from "./types.js";

function buildDecomposer(provider: AiDecomposerProvider, modelName: string): BundleDecomposer {
  switch (provider) {
    case "openai": {
      if (!getOpenAiApiKey()) {
        console.warn("[ai-decomposer] OPENAI_API_KEY not set, falling back to rule-based");
        return createRuleBasedDecomposer();
      }
      return createLlmDecomposer(openai(modelName));
    }
    case "anthropic": {
      if (!getAnthropicApiKey()) {
        console.warn("[ai-decomposer] ANTHROPIC_API_KEY not set, falling back to rule-based");
        return createRuleBasedDecomposer();
      }
      return createLlmDecomposer(anthropic(modelName));
    }
    default:
      return createRuleBasedDecomposer();
  }
}

/** Global fallback using env vars. */
export function createBundleDecomposer(): BundleDecomposer {
  const provider = getAiDecomposerProvider();
  const model = getAiDecomposerModel();
  return buildDecomposer(provider, model);
}

/** Per-workspace: reads AI config from workspace_integrations, falls back to env. */
export async function createBundleDecomposerForWorkspace(
  workspaceId: string,
): Promise<BundleDecomposer> {
  try {
    const result = await query<{ provider: string; config: Record<string, string> }>(
      `SELECT provider, config FROM workspace_integrations WHERE workspace_id = $1`,
      [workspaceId],
    );

    for (const row of result.rows) {
      if (row.provider === "openai") {
        const apiKey = row.config.api_key?.trim();
        const model = row.config.model?.trim() || "gpt-4o-mini";
        if (apiKey) {
          const { createOpenAI } = await import("@ai-sdk/openai");
          const provider = createOpenAI({ apiKey });
          return createLlmDecomposer(provider(model));
        }
      }
      if (row.provider === "anthropic") {
        const apiKey = row.config.api_key?.trim();
        const model = row.config.model?.trim() || "claude-sonnet-4-20250514";
        if (apiKey) {
          const { createAnthropic } = await import("@ai-sdk/anthropic");
          const provider = createAnthropic({ apiKey });
          return createLlmDecomposer(provider(model));
        }
      }
    }
  } catch {
    // DB unavailable — fall through to global config
  }

  return createBundleDecomposer();
}
