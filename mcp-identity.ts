/**
 * Resolve VitalTrust user context for external MCP clients (Secure Access / Duo / Cursor).
 * Cisco AIGW may forward identity via headers or Bearer token — configurable via env.
 */

export type McpCallerIdentity = {
  userId: string;
  role: string;
  source: "email-header" | "user-id-header" | "bearer-jwt" | "demo-default" | "probe";
};

type DirectoryUser = {
  id: string;
  role: string;
  email?: string;
};

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function tryDecodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8"
    );
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function findUserByEmail(users: DirectoryUser[], email: string): DirectoryUser | undefined {
  const needle = email.trim().toLowerCase();
  return users.find((u) => String(u.email || "").toLowerCase() === needle);
}

/**
 * Map inbound MCP request headers to a VitalTrust portal user.
 * Secure Access probe / local curl without auth uses MCP_DEMO_USER_ID (default doctor1).
 */
export function resolveMcpCaller(
  headers: Record<string, string | string[] | undefined>,
  users: DirectoryUser[],
  options?: { isProbe?: boolean }
): McpCallerIdentity {
  if (options?.isProbe) {
    return {
      userId: process.env.MCP_PROBE_USER_ID || process.env.MCP_DEMO_USER_ID || "doctor1",
      role: process.env.MCP_PROBE_ROLE || process.env.MCP_DEMO_ROLE || "doctor",
      source: "probe",
    };
  }

  const email =
    headerValue(headers, "x-user-email") ||
    headerValue(headers, "x-forwarded-user-email") ||
    headerValue(headers, "x-auth-request-email");

  if (email) {
    const user = findUserByEmail(users, email);
    if (user) {
      return { userId: user.id, role: user.role, source: "email-header" };
    }
  }

  const userId = headerValue(headers, "x-vitaltrust-user-id");
  if (userId) {
    const user = users.find((u) => u.id === userId);
    if (user) {
      return { userId: user.id, role: user.role, source: "user-id-header" };
    }
  }

  const auth = headerValue(headers, "authorization");
  if (auth?.startsWith("Bearer ")) {
    const claims = tryDecodeJwtPayload(auth.slice(7).trim());
    const claimEmail =
      (typeof claims?.email === "string" && claims.email) ||
      (typeof claims?.preferred_username === "string" && claims.preferred_username) ||
      (typeof claims?.sub === "string" && claims.sub.includes("@") ? claims.sub : undefined);
    if (claimEmail) {
      const user = findUserByEmail(users, claimEmail);
      if (user) {
        return { userId: user.id, role: user.role, source: "bearer-jwt" };
      }
    }
  }

  return {
    userId: process.env.MCP_DEMO_USER_ID || "doctor1",
    role: process.env.MCP_DEMO_ROLE || "doctor",
    source: "demo-default",
  };
}

import { ROLE_TOOLS } from "./server-mcp-tools";

export function isToolAllowedForRole(toolName: string, role: string): boolean {
  const allowed = ROLE_TOOLS[role] || [];
  return allowed.includes(toolName);
}
