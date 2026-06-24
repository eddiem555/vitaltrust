/** Bedrock model catalog and ID resolution (shared by UI + server). */

export const BEDROCK_MODEL_IDS = [
  "anthropic.claude-sonnet-4-5-20250929-v1:0",
  "anthropic.claude-haiku-4-5-20251001-v1:0",
  "anthropic.claude-sonnet-4-20250514-v1:0",
  "anthropic.claude-3-5-haiku-20241022-v1:0",
  "amazon.nova-pro-v1:0",
  "amazon.nova-lite-v1:0",
] as const;

export const BEDROCK_UI_MODELS = BEDROCK_MODEL_IDS.map(
  (id) => `Bedrock - ${id}`
);

/** Models that reached end-of-life on Bedrock — remap to current equivalents. */
const EOL_MODEL_REMAP: Record<string, string> = {
  "anthropic.claude-3-5-sonnet-20240620-v1:0": "anthropic.claude-sonnet-4-5-20250929-v1:0",
  "anthropic.claude-3-5-sonnet-20241022-v2:0": "anthropic.claude-sonnet-4-5-20250929-v1:0",
  "anthropic.claude-3-7-sonnet-20250219-v1:0": "anthropic.claude-sonnet-4-5-20250929-v1:0",
};

/** Models that support cross-region (CRIS) inference profile prefixes. */
const INFERENCE_PROFILE_MODELS = new Set([
  "anthropic.claude-haiku-4-5-20251001-v1:0",
  "anthropic.claude-sonnet-4-5-20250929-v1:0",
  "anthropic.claude-opus-4-1-20250805-v1:0",
  "anthropic.claude-sonnet-4-20250514-v1:0",
  "anthropic.claude-3-5-haiku-20241022-v1:0",
  "amazon.nova-premier-v1:0",
  "meta.llama4-maverick-17b-instruct-v1:0",
  "meta.llama3-3-70b-instruct-v1:0",
]);

export function stripBedrockUiPrefix(modelName: string): string {
  return modelName.replace(/^bedrock\s*-\s*/i, "").trim();
}

export function migrateEolBedrockModelId(modelId: string): string {
  return EOL_MODEL_REMAP[modelId] || modelId;
}

export function getInferenceProfilePrefix(region: string): string {
  if (region.startsWith("us-")) return "us";
  if (region.startsWith("eu-")) return "eu";
  if (region.startsWith("ap-") || region.startsWith("me-") || region.startsWith("sa-")) {
    return "apac";
  }
  return region.split("-")[0] || "us";
}

/**
 * Candidate model IDs to try in order (inference profile, direct, global).
 */
export function getBedrockModelIdCandidates(modelName: string, region: string): string[] {
  const raw = migrateEolBedrockModelId(stripBedrockUiPrefix(modelName));
  const candidates: string[] = [];
  const seen = new Set<string>();

  const add = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      candidates.push(id);
    }
  };

  if (INFERENCE_PROFILE_MODELS.has(raw)) {
    add(`${getInferenceProfilePrefix(region)}.${raw}`);
    if (raw.startsWith("anthropic.claude-sonnet-4-") || raw.startsWith("anthropic.claude-haiku-4-")) {
      add(`global.${raw}`);
    }
  }

  add(raw);

  return candidates;
}

export function resolveBedrockModelId(modelName: string, region: string): string {
  return getBedrockModelIdCandidates(modelName, region)[0];
}
