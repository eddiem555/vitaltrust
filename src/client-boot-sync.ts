/**
 * Sync browser localStorage with the server's boot instance id.
 * Settings (AI Defense, API keys, chat history) live in localStorage and survive
 * Docker redeploys unless we detect a new container boot id from /api/ai/config.
 */

export const BOOT_INSTANCE_STORAGE_KEY = 'vt_boot_instance_id';

const DEFAULT_AI_DEFENSE_INSPECT_SERVER = 'https://us.api.inspect.aidefense.security.cisco.com';

const DEFAULT_AI_DEFENSE_RULES: Record<string, { enabled: boolean; action: string }> = {
  'CODE DETECTION': { enabled: false, action: 'Ignore' },
  HARASSMENT: { enabled: false, action: 'Ignore' },
  'HATE SPEECH': { enabled: false, action: 'Ignore' },
  PCI: { enabled: false, action: 'Ignore' },
  PHI: { enabled: false, action: 'Ignore' },
  PII: { enabled: false, action: 'Ignore' },
  'PROMPT INJECTION': { enabled: false, action: 'Ignore' },
  PROFANITY: { enabled: false, action: 'Ignore' },
  'SEXUAL CONTENT & EXPLOITATION': { enabled: false, action: 'Ignore' },
  'SOCIAL DIVISION & POLARIZATION': { enabled: false, action: 'Ignore' },
};

/** Remove all Vital Trust client-side settings (vt_* keys). */
export function clearVitalTrustClientStorage(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('vt_')) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/** Apply factory-default client settings (AI Defense off, empty keys, etc.). */
export function applyDefaultClientSettings(): void {
  localStorage.setItem('vt_ai_selected_model', 'OpenAI GPT-5');
  localStorage.setItem('vt_ai_agent_selected_model', 'Bedrock - anthropic.claude-haiku-4-5-20251001-v1:0');
  localStorage.setItem('vt_ai_openai_key', '');
  localStorage.setItem('vt_ai_groq_key', '');
  localStorage.setItem('vt_ai_gemini_key', '');
  localStorage.setItem('vt_ai_claude_key', '');
  localStorage.setItem('vt_ai_aws_region', 'us-east-1');
  localStorage.setItem('vt_ai_aws_access_key', '');
  localStorage.setItem('vt_ai_aws_secret_key', '');
  localStorage.setItem('vt_ai_aws_custom_dns', 'null');

  localStorage.setItem('vt_agent_chart_updater_enabled', 'false');
  localStorage.setItem('vt_agent_overnight_nurse_enabled', 'false');
  localStorage.setItem('vt_agent_chart_updater_interval_min', '60');
  localStorage.setItem('vt_agent_overnight_nurse_interval_min', '20');
  localStorage.setItem('vt_agent_night_shift_only', 'true');

  localStorage.setItem('vt_ai_defense_enabled', 'false');
  localStorage.setItem('vt_ai_defense_mode', 'Via API');
  localStorage.setItem('vt_ai_defense_server', DEFAULT_AI_DEFENSE_INSPECT_SERVER);
  localStorage.setItem('vt_ai_defense_gateway', DEFAULT_AI_DEFENSE_INSPECT_SERVER);
  localStorage.removeItem('vt_ai_defense_proxy_url');
  localStorage.setItem('vt_ai_defense_api_key', '');
  localStorage.setItem('vt_ai_defense_prompt_source', 'server');
  localStorage.setItem('vt_ai_defense_rules', JSON.stringify(DEFAULT_AI_DEFENSE_RULES));
}

/**
 * If server boot id changed (fresh container / redeploy), reset client storage to defaults.
 * Returns true when a reset was performed.
 */
export function syncClientStorageWithBootInstance(bootInstanceId: string): boolean {
  const storedBootId = localStorage.getItem(BOOT_INSTANCE_STORAGE_KEY);
  if (storedBootId === bootInstanceId) {
    return false;
  }
  clearVitalTrustClientStorage();
  applyDefaultClientSettings();
  localStorage.setItem(BOOT_INSTANCE_STORAGE_KEY, bootInstanceId);
  return true;
}
