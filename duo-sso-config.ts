import fs from "fs";
import path from "path";

const DUO_SSO_CONFIG_FILE = "duo_sso_config.json";

export type DuoSsoCredentials = {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
};

export type DuoSsoSettingsView = {
  issuerUrl: string;
  clientId: string;
  hasClientSecret: boolean;
  configured: boolean;
  source: "settings" | "environment" | "none";
};

function configPath(): string {
  return path.join(process.cwd(), DUO_SSO_CONFIG_FILE);
}

function readFileConfig(): DuoSsoCredentials | null {
  try {
    const filePath = configPath();
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const issuerUrl = String(parsed?.issuerUrl || parsed?.duoIssuerUrl || "").trim();
    const clientId = String(parsed?.clientId || parsed?.duoClientId || "").trim();
    const clientSecret = String(parsed?.clientSecret || parsed?.duoClientSecret || "").trim();
    if (!issuerUrl || !clientId || !clientSecret) return null;
    return { issuerUrl, clientId, clientSecret };
  } catch {
    return null;
  }
}

function readEnvConfig(): DuoSsoCredentials | null {
  const issuerUrl = String(process.env.DUO_ISSUER_URL || "").trim();
  const clientId = String(process.env.DUO_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.DUO_CLIENT_SECRET || "").trim();
  if (!issuerUrl || !clientId || !clientSecret) return null;
  return { issuerUrl, clientId, clientSecret };
}

/** Active Duo credentials: Settings file overrides environment. */
export function resolveDuoSsoCredentials(): DuoSsoCredentials | null {
  return readFileConfig() || readEnvConfig();
}

export function getDuoSsoSettingsForUi(): DuoSsoSettingsView {
  const file = readFileConfig();
  const env = readEnvConfig();
  const active = file || env;
  return {
    issuerUrl: file?.issuerUrl || env?.issuerUrl || "",
    clientId: file?.clientId || env?.clientId || "",
    hasClientSecret: !!(file?.clientSecret || env?.clientSecret),
    configured: !!(active?.issuerUrl && active?.clientId && active?.clientSecret),
    source: file ? "settings" : env ? "environment" : "none",
  };
}

export function saveDuoSsoConfig(input: {
  issuerUrl: string;
  clientId: string;
  clientSecret?: string;
}): DuoSsoCredentials {
  const existing = readFileConfig();
  const issuerUrl = String(input.issuerUrl || "").trim();
  const clientId = String(input.clientId || "").trim();
  const clientSecret = String(input.clientSecret || existing?.clientSecret || "").trim();

  if (!issuerUrl) {
    throw new Error("Duo OIDC Issuer URL is required.");
  }
  if (!clientId) {
    throw new Error("Duo Application Client ID is required.");
  }
  if (!clientSecret) {
    throw new Error("Duo Application Client Secret is required.");
  }

  const payload = {
    issuerUrl,
    clientId,
    clientSecret,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(configPath(), JSON.stringify(payload, null, 2), "utf-8");
  return { issuerUrl, clientId, clientSecret };
}
