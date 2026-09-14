/**
 * LLM model catalog for the AI Assistant (OpenAI, Together, Gemini).
 * Claude and Bedrock catalogs live in claude-models.ts / bedrock-models.ts.
 */

import { CLAUDE_MODEL_OPTIONS } from "./claude-models";
import { BEDROCK_MODEL_OPTIONS } from "./bedrock-models";

export type LlmFamily = "openai" | "together" | "gemini" | "claude" | "bedrock";

export type LlmModelOption = {
  family: LlmFamily;
  label: string;
  apiId: string;
};

/** OpenAI chat models — widely available on standard API keys. */
export const OPENAI_LLM_MODELS: LlmModelOption[] = [
  { family: "openai", label: "OpenAI - GPT-4o mini", apiId: "gpt-4o-mini" },
  { family: "openai", label: "OpenAI - GPT-4.1 mini", apiId: "gpt-4.1-mini" },
  { family: "openai", label: "OpenAI - GPT-4.1 nano", apiId: "gpt-4.1-nano" },
  { family: "openai", label: "OpenAI - GPT-4o", apiId: "gpt-4o" },
  { family: "openai", label: "OpenAI - o4-mini", apiId: "o4-mini" },
];

/**
 * Together AI serverless chat models (OpenAI-compatible, pay-per-use).
 * Only models from the serverless catalog — dedicated-endpoint models will 400.
 * @see https://docs.together.ai/docs/inference-models
 */
export const TOGETHER_LLM_MODELS: LlmModelOption[] = [
  { family: "together", label: "Together - Qwen3.5 9B", apiId: "Qwen/Qwen3.5-9B" },
  { family: "together", label: "Together - GLM 5.3 Flash", apiId: "zai-org/GLM-5.3-Flash" },
  { family: "together", label: "Together - GPT OSS 20B", apiId: "openai/gpt-oss-20b" },
  { family: "together", label: "Together - DeepSeek V4 Flash", apiId: "deepseek-ai/DeepSeek-V4-Flash-0731" },
  { family: "together", label: "Together - Llama 3.3 70B Turbo", apiId: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
];

/**
 * Gemini 3.x stable text models. 2.5 flash-lite is blocked for new API keys.
 * @see https://ai.google.dev/gemini-api/docs/models
 */
export const GEMINI_LLM_MODELS: LlmModelOption[] = [
  { family: "gemini", label: "Gemini - 3.5 Flash Lite", apiId: "gemini-3.5-flash-lite" },
  { family: "gemini", label: "Gemini - 3.5 Flash", apiId: "gemini-3.5-flash" },
  { family: "gemini", label: "Gemini - 3.6 Flash", apiId: "gemini-3.6-flash" },
  { family: "gemini", label: "Gemini - 3.7 Flash", apiId: "gemini-3.7-flash" },
  { family: "gemini", label: "Gemini - 3.8 Flash", apiId: "gemini-3.8-flash" },
];

/** Retired or new-user-blocked Gemini IDs → current 3.x equivalents. */
const GEMINI_API_ID_REMAP: Record<string, string> = {
  "gemini-2.5-flash-lite": "gemini-3.5-flash-lite",
  "gemini-2.5-flash": "gemini-3.5-flash",
  "gemini-2.5-pro": "gemini-3.6-flash",
  "gemini-2.0-flash": "gemini-3.6-flash",
  "gemini-2.0-flash-lite": "gemini-3.5-flash-lite",
  "gemini-2.0-flash-001": "gemini-3.6-flash",
  "gemini-2.0-flash-lite-001": "gemini-3.5-flash-lite",
  "gemini-1.5-flash": "gemini-3.5-flash-lite",
  "gemini-1.5-flash-8b": "gemini-3.5-flash-lite",
  "gemini-1.5-pro": "gemini-3.6-flash",
};

export const DEFAULT_ASSISTANT_MODEL_LABEL = OPENAI_LLM_MODELS[0].label;
export const DEFAULT_AGENT_MODEL_LABEL = "Bedrock - Claude Haiku 4.5";

const OPENAI_LABEL_TO_API = new Map(OPENAI_LLM_MODELS.map((m) => [m.label.toLowerCase(), m.apiId]));
const TOGETHER_LABEL_TO_API = new Map(TOGETHER_LLM_MODELS.map((m) => [m.label.toLowerCase(), m.apiId]));
const GEMINI_LABEL_TO_API = new Map(GEMINI_LLM_MODELS.map((m) => [m.label.toLowerCase(), m.apiId]));

const LEGACY_ASSISTANT_LABEL_MAP: Record<string, string> = {
  "openai gpt-5": "OpenAI - GPT-4o",
  "openai gpt-5-mini": "OpenAI - GPT-4o mini",
  "openai gpt-5-nano": "OpenAI - GPT-4.1 nano",
  "openai gpt-4.1": "OpenAI - GPT-4.1 mini",
  "openai o3-mini": "OpenAI - o4-mini",
  "openai gpt-4o": "OpenAI - GPT-4o",
  "openai gpt-4": "OpenAI - GPT-4.1 mini",
  "openai - o3-mini": "OpenAI - o4-mini",
  "together - llama 3.1 8b turbo": "Together - Qwen3.5 9B",
  "together - qwen 2.5 7b turbo": "Together - Qwen3.5 9B",
  "together - qwen 2.5 72b turbo": "Together - Llama 3.3 70B Turbo",
  "together - deepseek r1 distill 70b": "Together - DeepSeek V4 Flash",
  "groq - gpt oss 20b": "Together - GPT OSS 20B",
  "groq - gpt oss 120b": "Together - Llama 3.3 70B Turbo",
  "groq - qwen3.6 27b": "Together - Qwen3.5 9B",
  "groq - qwen3.8 27b": "Together - Llama 3.3 70B Turbo",
  "groq - gpt oss safeguard 20b": "Together - GPT OSS 20B",
  "groq - llama 3.1 8b instant": "Together - Qwen3.5 9B",
  "groq - llama 3.3 70b versatile": "Together - Llama 3.3 70B Turbo",
  "groq - gemma2 9b": "Together - Qwen3.5 9B",
  "groq - llama 3.1 70b versatile": "Together - Llama 3.3 70B Turbo",
  "groq - qwen3 32b": "Together - Qwen3.5 9B",
  "groq - llama 4 maverick 17b": "Together - Llama 3.3 70B Turbo",
  "groq - kimi k2 instruct": "Together - DeepSeek V4 Flash",
  "gemini-2.5-flash": "Gemini - 3.5 Flash",
  "gemini-2.5-flash-lite": "Gemini - 3.5 Flash Lite",
  "gemini-2.5-pro": "Gemini - 3.6 Flash",
  "gemini-2.0-flash": "Gemini - 3.6 Flash",
  "gemini-2.0-flash-lite": "Gemini - 3.5 Flash Lite",
  "gemini-1.5-flash": "Gemini - 3.5 Flash Lite",
  "gemini - 2.5 flash": "Gemini - 3.5 Flash",
  "gemini - 2.5 flash lite": "Gemini - 3.5 Flash Lite",
  "gemini - 2.5 pro": "Gemini - 3.6 Flash",
  "gemini - 2.0 flash": "Gemini - 3.6 Flash",
  "gemini - 2.0 flash lite": "Gemini - 3.5 Flash Lite",
  "gemini - 1.5 flash": "Gemini - 3.5 Flash Lite",
  "gemini - 1.5 flash 8b": "Gemini - 3.5 Flash Lite",
  "claude - claude-sonnet-4-6": "Claude - Sonnet 4.6",
  "claude - claude-sonnet-4-5-20250929": "Claude - Sonnet 4.5",
  "claude - claude-opus-4-8": "Claude - Opus 4.8",
  "claude - claude-haiku-4-5-20251001": "Claude - Haiku 4.5",
};

export type ProviderKeyAvailability = {
  openai: boolean;
  together: boolean;
  gemini: boolean;
  claude: boolean;
  bedrock: boolean;
};

export function getAllAssistantModelLabels(): string[] {
  return [
    ...OPENAI_LLM_MODELS.map((m) => m.label),
    ...TOGETHER_LLM_MODELS.map((m) => m.label),
    ...GEMINI_LLM_MODELS.map((m) => m.label),
    ...CLAUDE_MODEL_OPTIONS.map((m) => m.label),
    ...BEDROCK_MODEL_OPTIONS.map((m) => m.label),
  ];
}

export function buildAssistantModelLabels(availability: ProviderKeyAvailability): string[] {
  const labels: string[] = [];
  if (availability.openai) labels.push(...OPENAI_LLM_MODELS.map((m) => m.label));
  if (availability.together) labels.push(...TOGETHER_LLM_MODELS.map((m) => m.label));
  if (availability.gemini) labels.push(...GEMINI_LLM_MODELS.map((m) => m.label));
  if (availability.claude) labels.push(...CLAUDE_MODEL_OPTIONS.map((m) => m.label));
  if (availability.bedrock) labels.push(...BEDROCK_MODEL_OPTIONS.map((m) => m.label));
  return labels;
}

export function buildAgentModelLabels(availability: ProviderKeyAvailability): string[] {
  if (!availability.bedrock) return [];
  return BEDROCK_MODEL_OPTIONS.map((m) => m.label);
}

export function migrateAssistantModelLabel(stored: string): string {
  const trimmed = (stored || "").trim();
  if (!trimmed) return DEFAULT_ASSISTANT_MODEL_LABEL;

  const allLabels = getAllAssistantModelLabels();
  if (allLabels.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
    return allLabels.find((l) => l.toLowerCase() === trimmed.toLowerCase())!;
  }

  const legacy = LEGACY_ASSISTANT_LABEL_MAP[trimmed.toLowerCase()];
  if (legacy && allLabels.some((l) => l.toLowerCase() === legacy.toLowerCase())) {
    return legacy;
  }

  if (trimmed.toLowerCase().startsWith("bedrock -")) {
    const rawId = trimmed.replace(/^bedrock\s*-\s*/i, "").trim();
    const match = BEDROCK_MODEL_OPTIONS.find(
      (m) => m.apiId.toLowerCase() === rawId.toLowerCase()
    );
    if (match) return match.label;
  }

  if (trimmed.toLowerCase().startsWith("claude -")) {
    const rawId = trimmed.replace(/^claude\s*-\s*/i, "").trim();
    const match = CLAUDE_MODEL_OPTIONS.find(
      (m) => m.apiId.toLowerCase() === rawId.toLowerCase()
    );
    if (match) return match.label;
  }

  return trimmed;
}

export function getModelFamily(model: string): LlmFamily {
  const m = (model || "").toLowerCase().trim();
  if (m.startsWith("claude -")) return "claude";
  if (m.startsWith("openai -") || m.includes("openai") || m.startsWith("o3") || m.startsWith("o4")) {
    return "openai";
  }
  if (m.startsWith("together -") || m.startsWith("groq -") || m.startsWith("groq-")) return "together";
  if (m.startsWith("gemini -") || m.includes("gemini")) return "gemini";
  if (m.startsWith("bedrock -") || m.includes("bedrock")) return "bedrock";
  return "openai";
}

export function resolveOpenAiModelId(modelName: string): string {
  const key = modelName.toLowerCase().trim();
  const fromLabel = OPENAI_LABEL_TO_API.get(key);
  if (fromLabel) return fromLabel;

  if (key.includes("gpt-4o-mini") || key.includes("gpt-5-mini") || key.includes("gpt-5-nano")) {
    return "gpt-4o-mini";
  }
  if (key.includes("gpt-4.1-nano")) return "gpt-4.1-nano";
  if (key.includes("gpt-4.1-mini")) return "gpt-4.1-mini";
  if (key.includes("o4-mini") || key.includes("o3-mini")) return "o4-mini";
  if (key.includes("gpt-4.1")) return "gpt-4.1-mini";
  if (key.includes("gpt-4o") || key.includes("gpt-5")) return "gpt-4o";
  if (key.includes("gpt-4")) return "gpt-4o-mini";
  return "gpt-4o-mini";
}

export function resolveTogetherModelId(modelName: string): string {
  const key = modelName.toLowerCase().trim();
  const fromLabel = TOGETHER_LABEL_TO_API.get(key);
  if (fromLabel) return fromLabel;

  const legacyTogetherApiIds: Record<string, string> = {
    "meta-llama/meta-llama-3.1-8b-instruct-turbo": "Qwen/Qwen3.5-9B",
    "qwen/qwen2.5-7b-instruct-turbo": "Qwen/Qwen3.5-9B",
    "qwen/qwen2.5-72b-instruct-turbo": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "deepseek-ai/deepseek-r1-distill-llama-70b": "deepseek-ai/DeepSeek-V4-Flash-0731",
    "openai/gpt-oss-20b": "openai/gpt-oss-20b",
    "openai/gpt-oss-120b": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "qwen/qwen3.6-27b": "Qwen/Qwen3.5-9B",
    "qwen/qwen3.8-27b": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "groq-llama-3.3-70b-versatile": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "groq-qwen3-32b": "Qwen/Qwen3.5-9B",
  };
  if (legacyTogetherApiIds[key]) return legacyTogetherApiIds[key];

  if (key.startsWith("together -") || key.startsWith("groq -")) {
    const match = TOGETHER_LLM_MODELS.find((m) => m.label.toLowerCase() === key);
    if (match) return match.apiId;
    if (key.includes("glm")) return "zai-org/GLM-5.3-Flash";
    if (key.includes("qwen3.5") || key.includes("qwen 3.5")) return "Qwen/Qwen3.5-9B";
    if (key.includes("qwen")) return "Qwen/Qwen3.5-9B";
    if (key.includes("deepseek") || key.includes("v4")) return "deepseek-ai/DeepSeek-V4-Flash-0731";
    if (key.includes("oss") && key.includes("20")) return "openai/gpt-oss-20b";
    if (key.includes("70b") || key.includes("120b") || key.includes("llama 3.3")) {
      return "meta-llama/Llama-3.3-70B-Instruct-Turbo";
    }
    return "Qwen/Qwen3.5-9B";
  }
  if (key.startsWith("groq-")) return resolveTogetherModelId(`groq - ${key.slice(5)}`);
  return "Qwen/Qwen3.5-9B";
}

export function resolveGeminiModelId(modelName: string): string {
  const key = modelName.toLowerCase().trim();
  const fromLabel = GEMINI_LABEL_TO_API.get(key);
  if (fromLabel) return fromLabel;

  if (key.startsWith("gemini -")) {
    const match = GEMINI_LLM_MODELS.find((m) => m.label.toLowerCase() === key);
    if (match) return match.apiId;
  }

  const idMatch = key.match(/gemini-[\d.]+(?:-flash(?:-lite)?|-pro(?:-preview)?)/);
  if (idMatch) {
    const rawId = idMatch[0];
    return GEMINI_API_ID_REMAP[rawId] || rawId;
  }

  if (key.includes("3.8")) return "gemini-3.8-flash";
  if (key.includes("3.7")) return "gemini-3.7-flash";
  if (key.includes("3.6")) return "gemini-3.6-flash";
  if (key.includes("3.5") && key.includes("lite")) return "gemini-3.5-flash-lite";
  if (key.includes("3.5")) return "gemini-3.5-flash";
  if (key.includes("2.5") && key.includes("lite")) return "gemini-3.5-flash-lite";
  if (key.includes("2.5") && key.includes("pro")) return "gemini-3.6-flash";
  if (key.includes("2.5")) return "gemini-3.5-flash";
  if (key.includes("2.0") || key.includes("1.5")) return "gemini-3.5-flash-lite";

  return "gemini-3.5-flash-lite";
}

/** Read Together key from localStorage, migrating legacy Groq key if present. */
export function readTogetherKeyFromClientStorage(): string {
  const together = localStorage.getItem("vt_ai_together_key") || "";
  if (together.trim()) return together;
  const legacyGroq = localStorage.getItem("vt_ai_groq_key") || "";
  if (legacyGroq.trim()) {
    localStorage.setItem("vt_ai_together_key", legacyGroq);
    localStorage.removeItem("vt_ai_groq_key");
    return legacyGroq;
  }
  return "";
}
