/**
 * Shared MCP tool execution runtime for /api/ai/chat and /mcp.
 */
import fs from "fs";
import { runMcpTool } from "./server-mcp-tools";

export type McpRuntimeContext = {
  port: number;
  isStandalone: boolean;
  appRole: string;
  liveConfig: Record<string, unknown>;
  configPath: string;
  version: string;
  versionDate: string;
  dbMock: { users?: Array<{ id: string; role: string; realName?: string }> };
  createLog: (
    userId: string,
    userName: string,
    role: string,
    action: string,
    status: string,
    details: string
  ) => void;
};

export type McpExecutor = (
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  userRole: string
) => Promise<unknown>;

export function createMcpExecutor(ctx: McpRuntimeContext): McpExecutor {
  const normalizePeerUrl = (rawUrl: string): string => {
    let url = rawUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `http://${url}`;
    }
    if (!url.match(/:\d+/) && !url.includes("run.app") && !url.includes("aistudio")) {
      url = `${url}:${ctx.port}`;
    }
    return url.replace(/\/$/, "");
  };

  const resolveDbApiBase = (): string => {
    if (ctx.isStandalone || ctx.appRole === "dbserver") {
      return `http://127.0.0.1:${ctx.port}`;
    }
    const raw = String(ctx.liveConfig.dbserver_url || process.env.DB_SERVER_URL || "").trim();
    if (!raw || raw.toUpperCase().startsWith("TBD")) {
      throw new Error("Database server URL is not configured for this distributed node.");
    }
    return normalizePeerUrl(raw);
  };

  const resolveAuthApiBase = (): string => {
    if (ctx.isStandalone) return `http://127.0.0.1:${ctx.port}`;
    const raw = String(ctx.liveConfig.appserver_url || process.env.APP_SERVER_URL || "").trim();
    if (!raw || raw.toUpperCase().startsWith("TBD")) {
      return `http://127.0.0.1:${ctx.port}`;
    }
    return normalizePeerUrl(raw);
  };

  const parseApiJson = async (response: Response) => {
    const text = await response.text();
    if (!text) return { success: true };
    return JSON.parse(text);
  };

  return async function executeMcpTool(
    toolName: string,
    args: Record<string, unknown>,
    uId: string,
    uRole: string
  ): Promise<unknown> {
    try {
      const userObj = ctx.dbMock.users?.find((u) => u.id === uId);
      const userName = userObj?.realName || uId;
      const activeRole = userObj?.role || uRole;
      ctx.createLog(
        uId,
        userName,
        activeRole,
        "MCP Server Access",
        "Success",
        `MCP tool [${toolName}] invoked. Arguments: ${JSON.stringify(args || {})}`
      );
    } catch (err) {
      console.error("[VITALTRUST] Failed creating MCP audit log", err);
    }

    const dbBase = resolveDbApiBase();
    const authBase = resolveAuthApiBase();
    const db = {
      get: async (path: string) => {
        const response = await fetch(`${dbBase}${path}`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`DB Server error: ${response.status} ${response.statusText}`);
        return parseApiJson(response);
      },
      post: async (path: string, body: unknown) => {
        const response = await fetch(`${dbBase}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`DB Server error: ${response.status} ${response.statusText}`);
        return parseApiJson(response);
      },
      put: async (path: string, body: unknown) => {
        const response = await fetch(`${dbBase}${path}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`DB Server error: ${response.status} ${response.statusText}`);
        return parseApiJson(response);
      },
      delete: async (path: string, body?: unknown) => {
        const response = await fetch(`${dbBase}${path}`, {
          method: "DELETE",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`DB Server error: ${response.status} ${response.statusText}`);
        return parseApiJson(response);
      },
    };
    const auth = {
      put: async (path: string, body: unknown) => {
        const response = await fetch(`${authBase}${path}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`Auth service error: ${response.status} ${response.statusText}`);
        return parseApiJson(response);
      },
      post: async (path: string, body: unknown) => {
        const response = await fetch(`${authBase}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`Auth service error: ${response.status} ${response.statusText}`);
        return parseApiJson(response);
      },
    };

    console.log(`[MCP TOOL EXECUTION] Tool: "${toolName}" for User: "${uId}" (Role: "${uRole}")`, args);
    const startTime = Date.now();
    try {
      const resVal = await runMcpTool(toolName, args, uId, uRole, db, auth, {
        liveConfig: ctx.liveConfig,
        version: ctx.version,
        versionDate: ctx.versionDate,
        saveSystemConfig: (newConfig) => {
          fs.writeFileSync(ctx.configPath, JSON.stringify(newConfig, null, 2), "utf-8");
          Object.assign(ctx.liveConfig, newConfig);
        },
      });
      const elapsed = Date.now() - startTime;
      const resultSummary = Array.isArray(resVal)
        ? `[${resVal.length} items]`
        : typeof resVal === "object"
          ? "[Object]"
          : String(resVal).substring(0, 150);
      console.log(
        `[MCP TOOL SUCCESS] Tool: "${toolName}" executed successfully in ${elapsed}ms. Summary: ${resultSummary}`
      );
      return resVal;
    } catch (mcpErr: unknown) {
      const elapsed = Date.now() - startTime;
      const message = mcpErr instanceof Error ? mcpErr.message : String(mcpErr);
      console.error(`[MCP TOOL ERROR] Tool: "${toolName}" failed after ${elapsed}ms:`, message);
      throw mcpErr;
    }
  };
}
