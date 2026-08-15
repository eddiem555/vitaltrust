import fs from "fs";
import path from "path";

const INSTANCE_SETTINGS_FILE = "instance_settings.json";

export type AiDefenseRuleConfig = {
  enabled: boolean;
  action: "Ignore" | "Block" | "Alert";
};

export type InstanceSettings = {
  selectedModel?: string;
  agentSelectedModel?: string;
  openaiKey?: string;
  groqKey?: string;
  geminiKey?: string;
  claudeKey?: string;
  awsRegion?: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
  awsCustomDns?: string;
  aiDefenseEnabled?: boolean;
  aiDefenseMode?: string;
  aiDefenseServer?: string;
  aiDefenseProxyUrl?: string;
  aiDefenseGateway?: string;
  aiDefenseApiKey?: string;
  aiDefensePromptSource?: string;
  aiDefenseRules?: Record<string, AiDefenseRuleConfig>;
  updatedAt?: string;
};

export type InstanceSettingsView = InstanceSettings & {
  configured: boolean;
};

function settingsPath(): string {
  return path.join(process.cwd(), INSTANCE_SETTINGS_FILE);
}

function readFileSettings(): InstanceSettings | null {
  try {
    const filePath = settingsPath();
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as InstanceSettings;
  } catch {
    return null;
  }
}

export function getInstanceSettings(): InstanceSettings | null {
  return readFileSettings();
}

export function getInstanceSettingsForUi(): InstanceSettingsView {
  const settings = readFileSettings();
  return {
    ...(settings || {}),
    configured: !!settings?.updatedAt,
  };
}

function mergeStringField(next: unknown, existing?: string): string | undefined {
  if (typeof next === "string") {
    const trimmed = next.trim();
    return trimmed.length > 0 ? trimmed : existing;
  }
  return existing;
}

/** Persist instance-wide AI + Security Controls settings (admin UI). */
export function saveInstanceSettings(input: Partial<InstanceSettings>): InstanceSettingsView {
  const existing = readFileSettings() || {};
  const merged: InstanceSettings = {
    ...existing,
    selectedModel: mergeStringField(input.selectedModel, existing.selectedModel),
    agentSelectedModel: mergeStringField(input.agentSelectedModel, existing.agentSelectedModel),
    openaiKey: mergeStringField(input.openaiKey, existing.openaiKey),
    groqKey: mergeStringField(input.groqKey, existing.groqKey),
    geminiKey: mergeStringField(input.geminiKey, existing.geminiKey),
    claudeKey: mergeStringField(input.claudeKey, existing.claudeKey),
    awsRegion: mergeStringField(input.awsRegion, existing.awsRegion),
    awsAccessKey: mergeStringField(input.awsAccessKey, existing.awsAccessKey),
    awsSecretKey: mergeStringField(input.awsSecretKey, existing.awsSecretKey),
    awsCustomDns: mergeStringField(input.awsCustomDns, existing.awsCustomDns),
    aiDefenseMode: mergeStringField(input.aiDefenseMode, existing.aiDefenseMode),
    aiDefenseServer: mergeStringField(input.aiDefenseServer, existing.aiDefenseServer),
    aiDefenseProxyUrl: mergeStringField(input.aiDefenseProxyUrl, existing.aiDefenseProxyUrl),
    aiDefenseGateway: mergeStringField(input.aiDefenseGateway, existing.aiDefenseGateway),
    aiDefenseApiKey: mergeStringField(input.aiDefenseApiKey, existing.aiDefenseApiKey),
    aiDefensePromptSource: mergeStringField(input.aiDefensePromptSource, existing.aiDefensePromptSource),
    updatedAt: new Date().toISOString(),
  };

  if (typeof input.aiDefenseEnabled === "boolean") {
    merged.aiDefenseEnabled = input.aiDefenseEnabled;
  } else if (typeof existing.aiDefenseEnabled === "boolean") {
    merged.aiDefenseEnabled = existing.aiDefenseEnabled;
  }

  if (input.aiDefenseRules && typeof input.aiDefenseRules === "object") {
    merged.aiDefenseRules = input.aiDefenseRules;
  } else if (existing.aiDefenseRules) {
    merged.aiDefenseRules = existing.aiDefenseRules;
  }

  fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2), "utf-8");
  return getInstanceSettingsForUi();
}

export function clearInstanceSettings(): void {
  try {
    const filePath = settingsPath();
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function pickFirstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/** Merge client payload with persisted instance settings and environment fallbacks. */
export function resolveChatApiKeys(clientKeys: Record<string, string | undefined> | undefined): {
  openaiKey: string;
  groqKey: string;
  geminiKey: string;
  claudeKey: string;
  awsRegion: string;
  awsAccessKey: string;
  awsSecretKey: string;
  awsCustomDns: string;
} {
  const stored = readFileSettings();
  return {
    openaiKey: pickFirstNonEmpty(clientKeys?.openaiKey, stored?.openaiKey, process.env.OPENAI_API_KEY),
    groqKey: pickFirstNonEmpty(clientKeys?.groqKey, stored?.groqKey, process.env.GROQ_API_KEY),
    geminiKey: pickFirstNonEmpty(clientKeys?.geminiKey, stored?.geminiKey, process.env.GEMINI_API_KEY),
    claudeKey: pickFirstNonEmpty(clientKeys?.claudeKey, stored?.claudeKey, process.env.CLAUDE_API_KEY),
    awsRegion: pickFirstNonEmpty(clientKeys?.awsRegion, stored?.awsRegion, process.env.AWS_REGION, "us-east-1"),
    awsAccessKey: pickFirstNonEmpty(clientKeys?.awsAccessKey, stored?.awsAccessKey, process.env.AWS_ACCESS_KEY),
    awsSecretKey: pickFirstNonEmpty(clientKeys?.awsSecretKey, stored?.awsSecretKey, process.env.AWS_SECRET_KEY),
    awsCustomDns: pickFirstNonEmpty(clientKeys?.awsCustomDns, stored?.awsCustomDns, process.env.AWS_BEDROCK_CUSTOM_DNS, "null"),
  };
}

export function resolveChatAiDefenseSettings(input: {
  aiDefenseEnabled?: boolean | string;
  aiDefenseMode?: string;
  aiDefenseGateway?: string;
  aiDefenseGatewayUrl?: string;
  aiDefenseApiKey?: string;
  aiDefensePromptSource?: string;
  aiDefenseRules?: Record<string, AiDefenseRuleConfig>;
}): {
  aiDefenseEnabled: boolean;
  aiDefenseMode: string;
  aiDefenseGateway: string;
  aiDefenseGatewayUrl: string;
  aiDefenseApiKey: string;
  aiDefensePromptSource: string;
  aiDefenseRules: Record<string, AiDefenseRuleConfig> | undefined;
  selectedModel?: string;
} {
  const stored = readFileSettings();
  const enabledRaw = input.aiDefenseEnabled ?? stored?.aiDefenseEnabled ?? false;
  const aiDefenseEnabled = enabledRaw === true || enabledRaw === "true";
  return {
    aiDefenseEnabled,
    aiDefenseMode: pickFirstNonEmpty(input.aiDefenseMode, stored?.aiDefenseMode, "Via API"),
    aiDefenseGateway: pickFirstNonEmpty(
      input.aiDefenseGateway,
      stored?.aiDefenseGateway,
      stored?.aiDefenseServer,
      "https://us.api.inspect.aidefense.security.cisco.com"
    ),
    aiDefenseGatewayUrl: pickFirstNonEmpty(
      input.aiDefenseGatewayUrl,
      stored?.aiDefenseProxyUrl,
      stored?.aiDefenseGateway
    ),
    aiDefenseApiKey: pickFirstNonEmpty(
      input.aiDefenseApiKey,
      stored?.aiDefenseApiKey,
      process.env.CISCO_AI_DEFENSE_API_KEY,
      process.env.AI_DEFENSE_API_KEY
    ),
    aiDefensePromptSource: pickFirstNonEmpty(input.aiDefensePromptSource, stored?.aiDefensePromptSource, "server"),
    aiDefenseRules: input.aiDefenseRules || stored?.aiDefenseRules,
    selectedModel: stored?.selectedModel,
  };
}
