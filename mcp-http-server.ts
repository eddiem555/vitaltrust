/**
 * Industry-standard MCP Streamable HTTP endpoint at /mcp for Cisco Secure Access onboarding.
 * Implements JSON-RPC 2.0 methods: initialize, tools/list, tools/call (no external SDK required).
 */
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import { mcpToolsForDiscovery } from "./mcp-tool-definitions";
import { isToolAllowedForRole, resolveMcpCaller } from "./mcp-identity";
import type { McpExecutor } from "./mcp-runtime";

const MCP_PROTOCOL_VERSION = "2025-03-26";
const SERVER_NAME = "vitaltrust-mcp";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type McpSession = {
  initialized: boolean;
};

export type MountMcpHttpServerOptions = {
  version: string;
  executeTool: McpExecutor;
  getUsers: () => Array<{ id: string; role: string; email?: string; realName?: string }>;
  enabled?: boolean;
};

function jsonRpcError(id: string | number | null | undefined, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function jsonRpcResult(id: string | number | null | undefined, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function toolResultText(payload: unknown, isError = false) {
  const text =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return {
    content: [{ type: "text" as const, text }],
    isError,
  };
}

async function handleRpcMethod(
  rpc: JsonRpcRequest,
  session: McpSession,
  opts: MountMcpHttpServerOptions,
  req: Request
): Promise<{ response?: unknown; noContent?: boolean }> {
  const method = rpc.method || "";

  if (method === "notifications/initialized") {
    session.initialized = true;
    return { noContent: true };
  }

  if (method === "initialize") {
    session.initialized = true;
    const requestedVersion =
      typeof rpc.params?.protocolVersion === "string"
        ? rpc.params.protocolVersion
        : MCP_PROTOCOL_VERSION;
    return {
      response: {
        protocolVersion: requestedVersion,
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: SERVER_NAME,
          version: opts.version,
        },
      },
    };
  }

  if (method === "ping") {
    return { response: {} };
  }

  if (method === "tools/list") {
    return {
      response: {
        tools: mcpToolsForDiscovery(),
      },
    };
  }

  if (method === "tools/call") {
    const toolName = String(rpc.params?.name || "");
    const args =
      rpc.params?.arguments && typeof rpc.params.arguments === "object"
        ? (rpc.params.arguments as Record<string, unknown>)
        : {};

    if (!toolName) {
      throw new Error("tools/call requires params.name");
    }

    const caller = resolveMcpCaller(req.headers, opts.getUsers());

    if (!isToolAllowedForRole(toolName, caller.role)) {
      return {
        response: toolResultText(
          {
            error: `Tool "${toolName}" is not authorized for role "${caller.role}" (caller: ${caller.userId}, source: ${caller.source}).`,
          },
          true
        ),
      };
    }

    try {
      const data = await opts.executeTool(toolName, args, caller.userId, caller.role);
      return { response: toolResultText(data, false) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { response: toolResultText({ error: message }, true) };
    }
  }

  throw new Error(`Method not found: ${method}`);
}

export function mountMcpHttpServer(app: Express, opts: MountMcpHttpServerOptions): void {
  if (opts.enabled === false) {
    console.log("[MCP] HTTP server disabled (MCP_ENABLED=false)");
    return;
  }

  const sessions = new Map<string, McpSession>();
  const toolCount = mcpToolsForDiscovery().length;

  app.get("/api/mcp/status", (_req, res) => {
    res.json({
      enabled: true,
      endpoint: "/mcp",
      transport: "streamable-http",
      protocolVersion: MCP_PROTOCOL_VERSION,
      toolCount,
      serverName: SERVER_NAME,
      version: opts.version,
    });
  });

  /** Secure Access may issue GET; spec allows 405 when SSE is not offered. */
  app.get("/mcp", (_req, res) => {
    res
      .status(405)
      .set("Allow", "POST")
      .json(jsonRpcError(null, -32000, "SSE stream not enabled. Send MCP JSON-RPC via POST."));
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    const rpc: JsonRpcRequest | undefined = Array.isArray(req.body) ? req.body[0] : req.body;

    if (!rpc || rpc.jsonrpc !== "2.0" || !rpc.method) {
      return res
        .status(400)
        .json(jsonRpcError(rpc?.id, -32600, "Invalid JSON-RPC 2.0 request"));
    }

    let sessionId = String(req.headers["mcp-session-id"] || "");
    if (!sessionId || !sessions.has(sessionId)) {
      sessionId = randomUUID();
      sessions.set(sessionId, { initialized: false });
    }
    const session = sessions.get(sessionId)!;
    res.setHeader("Mcp-Session-Id", sessionId);
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    try {
      const outcome = await handleRpcMethod(rpc, session, opts, req);
      if (outcome.noContent) {
        return res.status(202).end();
      }
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Accept", "application/json, text/event-stream");
      return res.json(jsonRpcResult(rpc.id, outcome.response));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.startsWith("Method not found") ? -32601 : -32603;
      return res.status(code === -32601 ? 404 : 500).json(jsonRpcError(rpc.id, code, message));
    }
  });

  console.log(
    `[MCP] Streamable HTTP server mounted at POST /mcp (${toolCount} tools, protocol ${MCP_PROTOCOL_VERSION})`
  );
}
