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
 *   - Change the LLM client base URL to the tenant Defense Gateway URL.
 *   - Not exposed in the UI yet; `shouldProxyLlmThroughAiDefense` gates this path.
 *
 * Regional inspect hosts (*.api.inspect.aidefense.security.cisco.com) are API-mode
 * endpoints only — they do NOT proxy generateContent or chat/completions.
 */

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
  return !isDefenseInspectApiHost(gatewayUrl);
}
