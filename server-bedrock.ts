import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { Agent, request as undiciRequest } from "undici";
import tls from "node:tls";
import {
  getBedrockModelIdCandidates,
  migrateEolBedrockModelId,
  stripBedrockUiPrefix,
} from "./src/bedrock-models";
import { parseDefenseGatewayPolicyBlock } from "./server-ai-defense";

export interface BedrockCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  customDns?: string;
  /** When set, signed Bedrock requests POST to this Cisco Defense Gateway URL. */
  defenseGatewayUrl?: string;
}

export interface BedrockToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface BedrockChatOptions {
  credentials: BedrockCredentials;
  modelName: string;
  systemPrompt: string;
  history: Array<{ role: string; content: string }>;
  userMessage: string;
  tools?: BedrockToolSpec[];
  executeTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

export interface BedrockChatResult {
  text: string;
  modelUsed: string;
  blocked?: boolean;
  blockReason?: string;
  routedVia?: "bedrock-direct" | "cisco-defense-gateway";
}

function resolveHostname(region: string, customDns?: string): string {
  const dns = (customDns || "").trim();
  if (dns && dns.toLowerCase() !== "null") {
    return dns.replace(/^https?:\/\//, "").split("/")[0];
  }
  return `bedrock-runtime.${region}.amazonaws.com`;
}

function mapHistoryToBedrockMessages(
  history: Array<{ role: string; content: string }>,
  userMessage: string
): Array<{ role: "user" | "assistant"; content: Array<{ text: string }> }> {
  const messages: Array<{ role: "user" | "assistant"; content: Array<{ text: string }> }> = [];

  for (const entry of history) {
    const role = entry.role === "user" ? "user" : "assistant";
    if (!entry.content?.trim()) continue;
    messages.push({
      role,
      content: [{ text: entry.content }],
    });
  }

  messages.push({
    role: "user",
    content: [{ text: userMessage }],
  });

  return messages;
}

function isRetryableBedrockError(status: number, detail: string): boolean {
  if (status === 404 || status === 400) return true;
  const lower = detail.toLowerCase();
  return (
    lower.includes("end of its life") ||
    lower.includes("not found") ||
    lower.includes("invalid model") ||
    lower.includes("inference profile")
  );
}

const CISCO_GATEWAY_TLS_PREFIXES = [
  "https://us.gateway.aidefense",
  "https://eu.gateway.aidefense",
  "https://ap.gateway.aidefense",
];

/**
 * Bedrock gateway requests sign HTTP Host as bedrock-runtime.*.amazonaws.com (SigV4)
 * but TLS connects to us.gateway.aidefense.*. Always pin SNI/cert checks to the gateway host.
 */
function createDefenseGatewayDispatcher(gatewayUrl: string): Agent {
  const tlsServername = new URL(gatewayUrl).hostname;
  const isKnownCiscoGateway = CISCO_GATEWAY_TLS_PREFIXES.some((prefix) =>
    gatewayUrl.startsWith(prefix)
  );

  return new Agent({
    connect: {
      servername: tlsServername,
      rejectUnauthorized: isKnownCiscoGateway,
      ...(isKnownCiscoGateway
        ? {
            checkServerIdentity(_host: string, cert: tls.PeerCertificate) {
              return tls.checkServerIdentity(tlsServername, cert);
            },
          }
        : {}),
    },
  });
}

function flattenSignedHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    flat[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  return flat;
}

function resolveSignedBody(signedBody: unknown, fallback: string): string {
  if (typeof signedBody === "string") return signedBody;
  if (signedBody instanceof Uint8Array) return Buffer.from(signedBody).toString("utf8");
  return fallback;
}

/** CogniSphere pattern: undici fetch to gateway URL with SigV4 headers (Host = bedrock-runtime). */
async function postViaDefenseGateway(
  apiUrl: string,
  gatewayUrl: string,
  signedMethod: string,
  signedHeaders: Record<string, string | string[] | undefined>,
  signedBody: unknown,
  fallbackBody: string,
  timeoutMs: number
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const dispatcher = createDefenseGatewayDispatcher(gatewayUrl);
  const body = resolveSignedBody(signedBody, fallbackBody);
  const headers = flattenSignedHeaders(signedHeaders);

  let statusCode: number;
  let responseHeaders: Record<string, string>;
  let responseBody: string;

  try {
    const result = await undiciRequest(apiUrl, {
      method: signedMethod,
      headers,
      body,
      dispatcher,
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });
    statusCode = result.statusCode;
    responseHeaders = {};
    for (const [key, value] of Object.entries(result.headers)) {
      if (typeof value === "string") responseHeaders[key] = value;
      else if (Array.isArray(value)) responseHeaders[key] = value.join(", ");
    }
    responseBody = await result.body.text();
  } catch (err: any) {
    const detail = err?.cause?.message || err?.message || String(err);
    throw new Error(`Bedrock gateway request failed: ${detail}`);
  }

  return {
    status: statusCode,
    headers: responseHeaders,
    body: responseBody,
  };
}

async function converseOnce(
  credentials: BedrockCredentials,
  modelId: string,
  body: Record<string, unknown>
): Promise<any> {
  const hostname = resolveHostname(credentials.region, credentials.customDns);
  const path = `/model/${modelId}/converse`;
  const bodyStr = JSON.stringify(body);
  const gatewayUrl = (credentials.defenseGatewayUrl || "").trim();

  const signer = new SignatureV4({
    service: "bedrock",
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
    sha256: Sha256,
  });

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    accept: "application/json",
    Host: hostname,
    "Content-Length": String(Buffer.byteLength(bodyStr, "utf8")),
  };
  if (gatewayUrl) {
    requestHeaders["x-amzn-bedrock-accept-type"] = "application/json";
  }

  const request = new HttpRequest({
    method: "POST",
    protocol: "https:",
    hostname,
    path,
    headers: requestHeaders,
    body: bodyStr,
  });

  const signedRequest = await signer.sign(request);
  const apiUrl = gatewayUrl
    ? `${gatewayUrl.replace(/\/+$/, "")}${path}`
    : `https://${hostname}${path}`;

  console.log(
    `[AI_BROKER] [BEDROCK_FETCH] Outgoing fetch to: [${apiUrl}]. Model: "${modelId}". Gateway: ${gatewayUrl ? "yes" : "no"}.`
  );

  let status: number;
  let payload: unknown;

  if (gatewayUrl) {
    const gatewayRes = await postViaDefenseGateway(
      apiUrl,
      gatewayUrl,
      signedRequest.method,
      signedRequest.headers as Record<string, string | string[] | undefined>,
      signedRequest.body,
      bodyStr,
      120000
    );
    status = gatewayRes.status;
    const contentType = gatewayRes.headers["content-type"] || "";
    if (contentType.includes("application/json")) {
      try {
        payload = JSON.parse(gatewayRes.body || "{}");
      } catch {
        payload = { message: gatewayRes.body };
      }
    } else {
      payload = { message: gatewayRes.body };
    }
  } else {
    const response = await fetch(apiUrl, {
      method: signedRequest.method,
      headers: signedRequest.headers as Record<string, string>,
      body: signedRequest.body,
      signal: AbortSignal.timeout(120000),
    });
    status = response.status;
    const contentType = response.headers.get("content-type") || "";
    payload =
      contentType.includes("application/json")
        ? await response.json()
        : { message: await response.text() };
  }

  if (!status || status < 200 || status >= 300) {
    const detail =
      typeof payload === "object" && payload !== null
        ? JSON.stringify(payload)
        : String(payload);
    const err = new Error(`Bedrock HTTP ${status}: ${detail}`);
    (err as any).status = status;
    (err as any).detail = detail;
    throw err;
  }

  return payload;
}

async function converseWithFallback(
  credentials: BedrockCredentials,
  modelName: string,
  body: Record<string, unknown>
): Promise<{ response: any; modelUsed: string }> {
  const candidates = getBedrockModelIdCandidates(modelName, credentials.region);
  let lastError: Error | null = null;

  for (const modelId of candidates) {
    try {
      const response = await converseOnce(credentials, modelId, body);
      if (modelId !== candidates[0]) {
        console.log(`[AI_BROKER] [BEDROCK_FALLBACK] Succeeded with model ID: "${modelId}"`);
      }
      return { response, modelUsed: modelId };
    } catch (err: any) {
      lastError = err;
      const status = err?.status || 0;
      const detail = err?.detail || err?.message || "";
      if (!isRetryableBedrockError(status, detail)) {
        throw err;
      }
      console.warn(`[AI_BROKER] [BEDROCK_RETRY] Model "${modelId}" failed (${status}). Trying next candidate...`);
    }
  }

  throw lastError || new Error("Bedrock request failed for all model ID candidates.");
}

function extractTextFromContent(content: any[] | undefined): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => typeof block?.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function extractToolUses(content: any[] | undefined): Array<{ toolUseId: string; name: string; input: Record<string, unknown> }> {
  if (!Array.isArray(content)) return [];
  return content
    .filter((block) => block?.toolUse)
    .map((block) => ({
      toolUseId: block.toolUse.toolUseId,
      name: block.toolUse.name,
      input: (block.toolUse.input as Record<string, unknown>) || {},
    }));
}

function buildInferenceConfig(baseModel: string): Record<string, unknown> | undefined {
  if (baseModel.startsWith("anthropic")) {
    return { maxTokens: 4096, temperature: 0.7 };
  }
  if (baseModel.startsWith("amazon.nova")) {
    return { maxTokens: 4096, temperature: 0.7 };
  }
  return { maxTokens: 4096 };
}

export async function executeBedrockChat(options: BedrockChatOptions): Promise<BedrockChatResult> {
  const baseModel = migrateEolBedrockModelId(stripBedrockUiPrefix(options.modelName));
  const bedrockTools = options.tools || [];
  const messages = mapHistoryToBedrockMessages(options.history, options.userMessage);
  let resolvedModelId: string | null = null;
  const routedVia = options.credentials.defenseGatewayUrl
    ? "cisco-defense-gateway"
    : "bedrock-direct";

  let loopLimit = 12;
  let replyText = "";

  while (loopLimit > 0) {
    const requestBody: Record<string, unknown> = {
      messages,
    };

    const inferenceConfig = buildInferenceConfig(baseModel);
    if (inferenceConfig) {
      requestBody.inferenceConfig = inferenceConfig;
    }

    if (
      options.systemPrompt &&
      (baseModel.startsWith("anthropic") || baseModel.startsWith("meta") || baseModel.startsWith("amazon"))
    ) {
      requestBody.system = [{ text: options.systemPrompt }];
    }

    if (bedrockTools.length > 0) {
      requestBody.toolConfig = {
        tools: bedrockTools.map((tool) => ({
          toolSpec: {
            name: tool.name,
            description: tool.description,
            inputSchema: { json: tool.parameters },
          },
        })),
      };
    }

    let response: any;
    if (resolvedModelId) {
      response = await converseOnce(options.credentials, resolvedModelId, requestBody);
    } else {
      const result = await converseWithFallback(options.credentials, options.modelName, requestBody);
      response = result.response;
      resolvedModelId = result.modelUsed;
    }

    const assistantMessage = response?.output?.message;
    const stopReason = response?.output?.stopReason;

    if (!assistantMessage) {
      throw new Error("Bedrock returned no assistant message.");
    }

    messages.push({
      role: "assistant",
      content: assistantMessage.content || [],
    });

    const toolUses = extractToolUses(assistantMessage.content);

    if (toolUses.length > 0 && options.executeTool) {
      console.log(
        `[AI_BROKER] [BEDROCK_TOOL_CALLS] Model requested ${toolUses.length} tool call(s):`,
        toolUses.map((t) => t.name)
      );

      const toolResults: Array<{
        toolResult: {
          toolUseId: string;
          content: Array<{ text: string }>;
          status: "success" | "error";
        };
      }> = [];

      for (const toolUse of toolUses) {
        try {
          const result = await options.executeTool(toolUse.name, toolUse.input);
          toolResults.push({
            toolResult: {
              toolUseId: toolUse.toolUseId,
              content: [{ text: JSON.stringify(result) }],
              status: "success",
            },
          });
        } catch (err: any) {
          toolResults.push({
            toolResult: {
              toolUseId: toolUse.toolUseId,
              content: [{ text: err?.message || String(err) }],
              status: "error",
            },
          });
        }
      }

      messages.push({
        role: "user",
        content: toolResults,
      } as any);

      loopLimit--;
      continue;
    }

    replyText = extractTextFromContent(assistantMessage.content);
    if (!replyText && stopReason === "end_turn") {
      replyText = "No response text generated.";
    }

    const gatewayBlock = parseDefenseGatewayPolicyBlock(replyText);
    if (gatewayBlock) {
      return {
        text: replyText,
        modelUsed: resolvedModelId || getBedrockModelIdCandidates(options.modelName, options.credentials.region)[0],
        blocked: true,
        blockReason: gatewayBlock,
        routedVia,
      };
    }
    break;
  }

  return {
    text: replyText || "No reply from Bedrock.",
    modelUsed: resolvedModelId || getBedrockModelIdCandidates(options.modelName, options.credentials.region)[0],
    routedVia,
  };
}

// Re-export for server logging
export { migrateEolBedrockModelId, stripBedrockUiPrefix } from "./src/bedrock-models";
