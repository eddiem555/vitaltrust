import type { InstanceSettings } from "../instance-settings-config";

/** Apply server-persisted instance settings into browser localStorage for this VitalTrust instance. */
export function applyInstanceSettingsToClientStorage(settings: Partial<InstanceSettings>): boolean {
  if (!settings || !settings.updatedAt) return false;

  const setIfDefined = (key: string, value: string | undefined) => {
    if (value !== undefined && value !== null) {
      localStorage.setItem(key, value);
    }
  };

  setIfDefined("vt_ai_selected_model", settings.selectedModel);
  setIfDefined("vt_ai_agent_selected_model", settings.agentSelectedModel);
  setIfDefined("vt_ai_openai_key", settings.openaiKey);
  setIfDefined("vt_ai_groq_key", settings.groqKey);
  setIfDefined("vt_ai_gemini_key", settings.geminiKey);
  setIfDefined("vt_ai_claude_key", settings.claudeKey);
  setIfDefined("vt_ai_aws_region", settings.awsRegion);
  setIfDefined("vt_ai_aws_access_key", settings.awsAccessKey);
  setIfDefined("vt_ai_aws_secret_key", settings.awsSecretKey);
  setIfDefined("vt_ai_aws_custom_dns", settings.awsCustomDns);

  if (typeof settings.aiDefenseEnabled === "boolean") {
    localStorage.setItem("vt_ai_defense_enabled", String(settings.aiDefenseEnabled));
  }
  setIfDefined("vt_ai_defense_mode", settings.aiDefenseMode);
  setIfDefined("vt_ai_defense_server", settings.aiDefenseServer);
  setIfDefined("vt_ai_defense_gateway", settings.aiDefenseGateway);
  setIfDefined("vt_ai_defense_api_key", settings.aiDefenseApiKey);
  setIfDefined("vt_ai_defense_prompt_source", settings.aiDefensePromptSource);

  if (settings.aiDefenseProxyUrl) {
    localStorage.setItem("vt_ai_defense_proxy_url", settings.aiDefenseProxyUrl);
  }

  if (settings.aiDefenseRules) {
    localStorage.setItem("vt_ai_defense_rules", JSON.stringify(settings.aiDefenseRules));
  }

  window.dispatchEvent(new Event("vt_settings_updated"));
  return true;
}
