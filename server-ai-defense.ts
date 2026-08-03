/**
 * Cisco AI Defense integration helpers.
 *
 * Two Cisco modes (see Settings > Security Controls):
 *
 * **API Mode (Out-of-Band)** — application enforces guardrails.
 *   - Call the Inspect API (/api/v1/inspect/chat) for Pass/Fail verdicts.
 *   - LLM traffic goes DIRECTLY to the provider (OpenAI, Google, Groq, etc.).
 *   - VitalTrust applies enforcement in application code (block before/after LLM).
 *
 * **Defense Gateway Mode (In-Line Proxy)** — Cisco terminates and proxies LLM traffic.
 *   - Route LLM requests to the tenant Defense Gateway connection URL from the portal.
 *   - Bedrock: SigV4-signed POST to `{gatewayUrl}/model/{modelId}/converse`
 *   - OpenAI / Groq: `{gatewayUrl}/v1/chat/completions` with provider API key
 *   - Policy is enforced inline at Cisco (no Inspect pre-scan; no app rules matrix).
 *
 * Regional inspect hosts (*.api.inspect.aidefense.security.cisco.com) are API-mode
 * endpoints only — they do NOT proxy generateContent or chat/completions.
 */

/** Tenant Defense Gateway connection URL (…/connections/<id>) from AI Defense portal. */
export function normalizeDefenseProxyUrl(raw: string): string {
  let url = (raw || "").trim();
  if (!url) return "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  if (url.endsWith("/")) url = url.slice(0, -1);
  return url;
}

export function normalizeDefenseBaseUrl(raw: string): string {
  let url = (raw || "").trim();
  if (!url) return "https://us.api.inspect.aidefense.security.cisco.com";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  if (url.endsWith("/")) url = url.slice(0, -1);
  return url;
}

export function isDefenseInspectApiHost(gatewayUrl: string): boolean {
  try {
    const host = new URL(normalizeDefenseBaseUrl(gatewayUrl)).hostname.toLowerCase();
    return (
      host.endsWith(".api.inspect.aidefense.security.cisco.com") ||
      host === "api.inspect.aidefense.security.cisco.com"
    );
  } catch {
    return true;
  }
}

/** Build the inspect/chat URL used for runtime guardrail pre-scan. */
export function buildInspectChatUrl(gatewayUrl: string): string {
  let inspectUrl = normalizeDefenseBaseUrl(gatewayUrl);
  if (inspectUrl.includes("/api/v1/inspect/chat")) return inspectUrl;
  if (inspectUrl.endsWith("/v1/chat/completions")) {
    return inspectUrl.replace("/v1/chat/completions", "/api/v1/inspect/chat");
  }
  return `${inspectUrl}/api/v1/inspect/chat`;
}

/**
 * Defense Gateway (proxy) mode only. Always false for API Mode ("Via API").
 */
export function shouldProxyLlmThroughAiDefense(
  isDefenseEnabled: boolean,
  gatewayUrl: string,
  defenseMode?: string
): boolean {
  if (!isDefenseEnabled) return false;
  const mode = (defenseMode || "Via API").trim().toLowerCase();
  if (mode === "via api" || mode === "api") return false;
  if (mode === "defense gateway" || mode === "gateway" || mode.includes("gateway")) return true;
  return !isDefenseInspectApiHost(gatewayUrl);
}

/** Build OpenAI-compatible chat/completions URL on the Defense Gateway. */
export function buildDefenseGatewayChatCompletionsUrl(gatewayUrl: string): string {
  const base = normalizeDefenseProxyUrl(gatewayUrl);
  if (!base) return "";
  if (base.includes("/v1/chat/completions")) return base;
  return `${base}/v1/chat/completions`;
}

/** Build Bedrock Converse URL on the Defense Gateway. */
export function buildDefenseGatewayBedrockConverseUrl(gatewayUrl: string, modelId: string): string {
  const base = normalizeDefenseProxyUrl(gatewayUrl);
  const encodedModel = encodeURIComponent(modelId);
  return `${base}/model/${encodedModel}/converse`;
}

/** Inline gateway policy block text returned in model output (CogniSphere pattern). */
export function parseDefenseGatewayPolicyBlock(text: string): string | null {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  if (trimmed.includes("This request violates rules:")) {
    return trimmed.replace(/^This request violates rules:\s*/i, "").trim() || trimmed;
  }
  if (/^POLICY VIOLATION:/i.test(trimmed)) {
    return trimmed.replace(/^POLICY VIOLATION:\s*/i, "").trim() || trimmed;
  }
  return null;
}
