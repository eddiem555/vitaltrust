import { resolveClaudeModelId } from "./src/claude-models";

export interface ClaudeToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ClaudeChatOptions {
  apiKey: string;
  modelName: string;
  systemPrompt: string;
  history: Array<{ role: string; content: string }>;
  userMessage: string;
  tools?: ClaudeToolSpec[];
  executeTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

function mapToolsToAnthropic(tools: ClaudeToolSpec[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

function buildMessages(
  history: Array<{ role: string; content: string }>,
  userMessage: string
): Array<{ role: "user" | "assistant"; content: unknown }> {
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [];
  for (const entry of history) {
    if (!entry.content?.trim()) continue;
    messages.push({
      role: entry.role === "user" ? "user" : "assistant",
      content: entry.content,
    });
  }
  messages.push({ role: "user", content: userMessage });
  return messages;
}

export async function executeClaudeChat(options: ClaudeChatOptions): Promise<{ text: string; modelUsed: string }> {
  const modelId = resolveClaudeModelId(options.modelName);
  const anthropicTools = options.tools?.length ? mapToolsToAnthropic(options.tools) : [];
  let messages = buildMessages(options.history, options.userMessage);
  let replyText = "";
  let loopLimit = 12;

  while (loopLimit > 0) {
    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: 4096,
      system: options.systemPrompt,
      messages,
    };
    if (anthropicTools.length > 0) {
      body.tools = anthropicTools;
    }

    console.log(`[AI_BROKER] [CLAUDE_FETCH] Outgoing fetch to Anthropic Messages API. Model: "${modelId}".`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": options.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`Claude HTTP ${response.status}: ${JSON.stringify(payload)}`);
    }

    const content = Array.isArray(payload.content) ? payload.content : [];
    const textBlocks = content.filter((b: any) => b.type === "text").map((b: any) => b.text);
    const toolUses = content.filter((b: any) => b.type === "tool_use");

    messages.push({ role: "assistant", content });

    if (toolUses.length > 0 && options.executeTool) {
      console.log(
        `[AI_BROKER] [CLAUDE_TOOL_CALLS] Model requested ${toolUses.length} tool call(s):`,
        toolUses.map((t: any) => t.name)
      );

      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];
      for (const toolUse of toolUses) {
        try {
          const result = await options.executeTool(toolUse.name, toolUse.input || {});
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        } catch (err: any) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: err?.message || String(err),
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
      loopLimit--;
      continue;
    }

    replyText = textBlocks.join("\n").trim();
    if (!replyText && payload.stop_reason === "end_turn") {
      replyText = "No response text generated.";
    }
    break;
  }

  return {
    text: replyText || "No reply from Claude.",
    modelUsed: modelId,
  };
}
