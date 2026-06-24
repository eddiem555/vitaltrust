import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import {
  getBedrockModelIdCandidates,
  migrateEolBedrockModelId,
  stripBedrockUiPrefix,
} from "./src/bedrock-models";

export interface BedrockCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  customDns?: string;
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

async function converseOnce(
  credentials: BedrockCredentials,
  modelId: string,
  body: Record<string, unknown>
): Promise<any> {
  const hostname = resolveHostname(credentials.region, credentials.customDns);
  const path = `/model/${modelId}/converse`;
  const bodyStr = JSON.stringify(body);

  const signer = new SignatureV4({
    service: "bedrock",
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
    sha256: Sha256,
  });

  const request = new HttpRequest({
    method: "POST",
    protocol: "https:",
    hostname,
    path,
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      Host: hostname,
    },
    body: bodyStr,
  });

  const signedRequest = await signer.sign(request);
  const apiUrl = `https://${hostname}${path}`;

  console.log(`[AI_BROKER] [BEDROCK_FETCH] Outgoing fetch to: [${apiUrl}]. Model: "${modelId}".`);

  const response = await fetch(apiUrl, {
    method: signedRequest.method,
    headers: signedRequest.headers as Record<string, string>,
    body: signedRequest.body,
    signal: AbortSignal.timeout(120000),
  });

  const contentType = response.headers.get("content-type") || "";
  const payload =
    contentType.includes("application/json")
      ? await response.json()
      : { message: await response.text() };

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null
        ? JSON.stringify(payload)
        : String(payload);
    const err = new Error(`Bedrock HTTP ${response.status}: ${detail}`);
    (err as any).status = response.status;
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

export async function executeBedrockChat(options: BedrockChatOptions): Promise<{ text: string; modelUsed: string }> {
  const baseModel = migrateEolBedrockModelId(stripBedrockUiPrefix(options.modelName));
  const bedrockTools = options.tools || [];
  const messages = mapHistoryToBedrockMessages(options.history, options.userMessage);
  let resolvedModelId: string | null = null;

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
    break;
  }

  return {
    text: replyText || "No reply from Bedrock.",
    modelUsed: resolvedModelId || getBedrockModelIdCandidates(options.modelName, options.credentials.region)[0],
  };
}

// Re-export for server logging
export { migrateEolBedrockModelId, stripBedrockUiPrefix } from "./src/bedrock-models";
