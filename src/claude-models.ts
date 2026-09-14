/** Anthropic Claude direct API model catalog (AI Assistant only — not for autonomous agents). */

export type ClaudeModelOption = {
  label: string;
  apiId: string;
};

/** Five current Claude API models — Haiku first for AI Defense demos. */
export const CLAUDE_MODEL_OPTIONS: ClaudeModelOption[] = [
  { label: "Claude - Haiku 4.5", apiId: "claude-haiku-4-5-20251001" },
  { label: "Claude - Sonnet 4.6", apiId: "claude-sonnet-4-6" },
  { label: "Claude - Sonnet 4.5", apiId: "claude-sonnet-4-5-20250929" },
  { label: "Claude - Opus 4.8", apiId: "claude-opus-4-8" },
  { label: "Claude - 3.5 Haiku", apiId: "claude-3-5-haiku-20241022" },
];

export const CLAUDE_MODEL_IDS = CLAUDE_MODEL_OPTIONS.map((m) => m.apiId);

export const CLAUDE_UI_MODELS = CLAUDE_MODEL_OPTIONS.map((m) => m.label);

const LABEL_TO_API = new Map(CLAUDE_MODEL_OPTIONS.map((m) => [m.label.toLowerCase(), m.apiId]));

/** Retired or unavailable model IDs — remap to current Anthropic API equivalents. */
const EOL_CLAUDE_REMAP: Record<string, string> = {
  "claude-3-5-sonnet-20241022": "claude-sonnet-4-6",
  "claude-3-5-sonnet-20240620": "claude-sonnet-4-6",
  "claude-3-5-haiku-20241022": "claude-haiku-4-5-20251001",
  "claude-sonnet-4-20250514": "claude-sonnet-4-6",
  "claude-opus-4-20250514": "claude-opus-4-8",
  "claude-sonnet-4-5": "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5": "claude-haiku-4-5-20251001",
  "claude-opus-4-1-20250514": "claude-opus-4-8",
};

export function stripClaudeUiPrefix(modelName: string): string {
  const trimmed = modelName.trim();
  const fromLabel = LABEL_TO_API.get(trimmed.toLowerCase());
  if (fromLabel) return fromLabel;
  return trimmed.replace(/^claude\s*-\s*/i, "").trim();
}

export function migrateEolClaudeModelId(modelId: string): string {
  return EOL_CLAUDE_REMAP[modelId] || modelId;
}

export function resolveClaudeModelId(modelName: string): string {
  return migrateEolClaudeModelId(stripClaudeUiPrefix(modelName));
}
