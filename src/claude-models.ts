/** Anthropic Claude direct API model catalog (AI Assistant only — not for autonomous agents). */

export const CLAUDE_MODEL_IDS = [
  "claude-sonnet-4-6",
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-8",
  "claude-haiku-4-5-20251001",
] as const;

export const CLAUDE_UI_MODELS = CLAUDE_MODEL_IDS.map((id) => `Claude - ${id}`);

/** Retired or unavailable model IDs — remap to current Anthropic API equivalents. */
const EOL_CLAUDE_REMAP: Record<string, string> = {
  "claude-3-5-sonnet-20241022": "claude-sonnet-4-6",
  "claude-3-5-sonnet-20240620": "claude-sonnet-4-6",
  "claude-3-5-haiku-20241022": "claude-haiku-4-5-20251001",
  "claude-sonnet-4-20250514": "claude-sonnet-4-6",
  "claude-opus-4-20250514": "claude-opus-4-8",
  "claude-sonnet-4-5": "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5": "claude-haiku-4-5-20251001",
};

export function stripClaudeUiPrefix(modelName: string): string {
  return modelName.replace(/^claude\s*-\s*/i, "").trim();
}

export function migrateEolClaudeModelId(modelId: string): string {
  return EOL_CLAUDE_REMAP[modelId] || modelId;
}

export function resolveClaudeModelId(modelName: string): string {
  return migrateEolClaudeModelId(stripClaudeUiPrefix(modelName));
}
