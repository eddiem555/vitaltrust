import "./load-env.js";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";
import { Issuer, generators } from "openid-client";
import cookieParser from "cookie-parser";
import { db_mock, createInitialDb } from "./src/db";
import { canSendMessage } from "./src/messaging-rules";
import { careTeamForPatientIndex } from "./src/appointments";
import { VERSION, VERSION_DATE } from "./src/version";
import {
  hashPassword,
  verifyPassword,
  getDefaultPasswordSha256,
  isDefaultPasswordConfigured,
  isSha256PasswordHash,
  persistBootstrapPasswordHash,
  validateDefaultPasswordPolicy,
} from "./src/password-auth";
import fs from "fs";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { ROLE_TOOLS, runMcpTool } from "./server-mcp-tools";
import { executeBedrockChat } from "./server-bedrock";
import { executeClaudeChat } from "./server-claude";
import {
  applyAgentConfigUpdate,
  getAgentConfig,
  initAgentScheduler,
  loadAgentActivityLog,
  type AgentRuntimeContext,
} from "./server-agents";

// ==========================================
// SYSTEM CONSOLE LOGGING INTERCEPTOR
// ==========================================
const consoleLogPath = path.join(process.cwd(), "system_console.log");

function rotateConsoleLogFile() {
  try {
    if (fs.existsSync(consoleLogPath)) {
      const stats = fs.statSync(consoleLogPath);
      if (stats.size > 3 * 1024 * 1024) { // Truncate if larger than 3MB
        const content = fs.readFileSync(consoleLogPath, "utf-8");
        const keepLength = 1 * 1024 * 1024; // Keep last 1MB
        const truncated = content.slice(-keepLength);
        fs.writeFileSync(consoleLogPath, `[System Log Rotated at ${new Date().toISOString()}]\n` + truncated, "utf-8");
      }
    }
  } catch (err) {
    // Silent
  }
}

function writeToSystemLog(prefix: string, args: any[]) {
  try {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map(arg => {
      if (typeof arg === "object") {
        try { return JSON.stringify(arg); } catch (e) { return String(arg); }
      }
      return String(arg);
    }).join(" ");
    const line = `[${timestamp}] [${prefix}] ${formattedArgs}\n`;
    fs.appendFileSync(consoleLogPath, line, "utf-8");
  } catch (err) {
    // Silent
  }
}

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

console.log = (...args: any[]) => {
  originalConsoleLog(...args);
  writeToSystemLog("LOG", args);
};
console.error = (...args: any[]) => {
  originalConsoleError(...args);
  writeToSystemLog("ERROR", args);
};
console.warn = (...args: any[]) => {
  originalConsoleWarn(...args);
  writeToSystemLog("WARN", args);
};
console.info = (...args: any[]) => {
  originalConsoleInfo(...args);
  writeToSystemLog("INFO", args);
};

// Initial rotation
rotateConsoleLogFile();

console.log("[VITALTRUST] Server process starting...");

/** Unique per process start — clients use this to discard stale browser-side AI chat history after redeploy. */
const BOOT_INSTANCE_ID = crypto.randomUUID();
console.log(`[VITALTRUST] Boot instance id: ${BOOT_INSTANCE_ID}`);

process.on("uncaughtException", (err) => {
  console.error("[CRITICAL] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[CRITICAL] Unhandled Rejection at:", promise, "reason:", reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  const configPath = path.join(process.cwd(), "deployment_config.json");
  let liveConfig: any = {
    mode: "standalone",
    role: "standalone",
    appserver_url: "http://localhost:3000",
    dbserver_url: "http://localhost:3000",
    aibroker_url: "http://localhost:3000"
  };

  if (fs.existsSync(configPath)) {
    try {
      liveConfig = { ...liveConfig, ...JSON.parse(fs.readFileSync(configPath, "utf-8")) };
      if (liveConfig.mode !== "distributed") liveConfig.mode = "standalone";
      const validRoles = ["appserver", "dbserver", "aibroker", "standalone"];
      if (!validRoles.includes(liveConfig.role)) {
        liveConfig.role = liveConfig.mode === "distributed" ? "appserver" : "standalone";
      }
      console.log("[VITALTRUST] Loaded dynamic deployment_config.json:", liveConfig);
    } catch (e) {
      console.error("[VITALTRUST] Error loading deployment_config.json:", e);
    }
  }

  // ROLE configuration
  let APP_ROLE = "standalone";
  let IS_SUB_APP = false;
  let IS_STANDALONE = true;
  const DISTRIBUTED_ROLES = ["appserver", "dbserver", "aibroker"];

  function recomputeNetworkFlags() {
    let fileRole = (liveConfig.role || "standalone").trim().toLowerCase();
    if (!DISTRIBUTED_ROLES.includes(fileRole)) {
      fileRole = liveConfig.mode === "distributed" ? "appserver" : "standalone";
    }
    APP_ROLE = fileRole;
    IS_SUB_APP = DISTRIBUTED_ROLES.includes(APP_ROLE);
    IS_STANDALONE = liveConfig.mode === "standalone" || !IS_SUB_APP;
    console.log(`[VitalTrust] Node Architecture Sync: Role=${APP_ROLE}, SubApp=${IS_SUB_APP}, Standalone=${IS_STANDALONE}`);
  }

  // Initial alignment
  recomputeNetworkFlags();

  const dbPath = path.join(process.cwd(), "persistent_db.json");

  // On startup: Load from persistent_db.json or INITIAL_DB
  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, "utf-8");
      const parsed = JSON.parse(raw);
      Object.keys(db_mock).forEach(key => delete db_mock[key]);
      Object.assign(db_mock, parsed);
      console.log(`[VITALTRUST] Successfully loaded state from persistent_db.json`);
    } catch (e) {
      console.error(`[VITALTRUST] Error loading persistent_db.json:`, e);
    }
  }

  // Ensure ALL records have beautifully simulated high-value PII data on launch
  function backfillDb() {
    if (!db_mock) return;
    if (!db_mock.patients) db_mock.patients = [];
    if (!db_mock.users) db_mock.users = [];

    const formatTenDigitPhone = (phone: string | undefined, idx: number): string => {
      const cleaned = (phone || "").replace(/\D/g, "");
      if (cleaned.length === 10) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }
      // Generate deterministic US phone format: XXX-XXX-XXXX
      const areaNo = (201 + (idx * 13) % 700).toString().padStart(3, '0');
      const exch = (301 + (idx * 7) % 600).toString().padStart(3, '0');
      const line = (1000 + (idx * 19) % 8999).toString().padStart(4, '0');
      return `${areaNo}-${exch}-${line}`;
    };

    // First, format user phone numbers to 10-digits
    db_mock.users.forEach((user: any, index: number) => {
      user.phone = formatTenDigitPhone(user.phone, index);
    });

    db_mock.patients.forEach((patient: any, index: number) => {
      const patientNum = index + 1;
      const matchUser = db_mock.users.find((u: any) => u.id === patient.id);
      if (matchUser) {
        patient.phone = matchUser.phone;
      } else {
        patient.phone = formatTenDigitPhone(patient.phone, index + 100);
      }

      if (!patient.ssn || patient.ssn.includes("•••") || patient.ssn === "999-55-100" || patient.ssn.startsWith("000")) {
        patient.ssn = `999-55-${1000 + patientNum}`;
      }
      if (!patient.insurance_id || patient.insurance_id.includes("•••") || patient.insurance_id.startsWith("000") || patient.insurance_id === "N/A") {
        const providers = ["BCBS", "AET", "CIG", "UNI", "HUM"];
        const prov = providers[index % providers.length];
        patient.insurance_id = `${prov}-${3211000 + patientNum * 77}`;
      }
      if (!patient.clinical_notes || patient.clinical_notes.includes("[RESTRICTED")) {
        patient.clinical_notes = `Patient is currently being monitored for ${patient.condition || 'routine checkup'}. The recorded treatment plan consists of physical observation and active prescription management: ${patient.medications?.join(', ') || 'none'}. Responding well to therapy. High-value clinical monitoring target.`;
      }
    });

    if (db_mock.appointments) {
      db_mock.appointments.forEach((apt: any) => {
        if (!apt.nurseId && apt.patientId) {
          const patient = db_mock.patients.find((p: any) => p.id === apt.patientId);
          if (patient?.assignedNurseId) apt.nurseId = patient.assignedNurseId;
          else {
            const num = parseInt(String(apt.patientId).replace('patient', ''), 10);
            if (Number.isFinite(num)) apt.nurseId = careTeamForPatientIndex(num).nurseId;
          }
        }
        if (!apt.doctorId && apt.patientId) {
          const patient = db_mock.patients.find((p: any) => p.id === apt.patientId);
          if (patient?.assignedDoctorId) apt.doctorId = patient.assignedDoctorId;
        }
      });
    }

    db_mock.users.forEach((user: any, index: number) => {
      if (user.role === 'admin') {
        if (user.clearance_level === undefined || isNaN(Number(user.clearance_level))) {
          user.clearance_level = (index % 3) + 1;
        }
        if (!user.internal_notes || user.internal_notes.includes("[RESTRICTED") || user.internal_notes.trim() === "") {
          user.internal_notes = `Superuser level ${user.clearance_level} access. Handles operational compliance and role mappings for duo-oidc federation. Fully authorized administrative profile for ${user.realName || user.id}.`;
        }
      } else if (user.role === 'doctor') {
        if (!user.npi_number || user.npi_number.trim() === "") {
          user.npi_number = `${1689701000 + index * 123}`;
        }
        if (!user.internal_notes || user.internal_notes.includes("[RESTRICTED") || user.internal_notes.trim() === "") {
          user.internal_notes = `Attending chief medical officer. NPI verification active. Full physical status authorization. Managed by Cisco Secure Workload macro-segmentation profiling.`;
        }
      } else if (user.role === 'nurse') {
        if (!user.assigned_ward || user.assigned_ward.trim() === "") {
          const wards = ["Emergency Room", "Mental Health Residence - Ward B", "Cardiac ICU", "Surgical Ward", "Pediatric Wing"];
          user.assigned_ward = wards[index % wards.length];
        }
        if (!user.internal_notes || user.internal_notes.includes("[RESTRICTED") || user.internal_notes.trim() === "") {
          user.internal_notes = `Attending certified clinical nurse. Assigned ward floor: ${user.assigned_ward}. Emergency and regular diagnostic monitoring active. Access log recorded on HSM.`;
        }
      } else if (user.role === 'patient') {
        const pRecord = db_mock.patients.find((p: any) => p.id === user.id);
        if (pRecord) {
          user.ssn = pRecord.ssn;
          user.insurance_id = pRecord.insurance_id;
          user.clinical_notes = pRecord.clinical_notes;
        } else {
          if (!user.ssn || user.ssn.includes("•••")) {
            user.ssn = `999-55-220${index}`;
          }
          if (!user.insurance_id || user.insurance_id.includes("•••")) {
            user.insurance_id = `BCBS-1100${index}`;
          }
          if (!user.clinical_notes || user.clinical_notes.includes("[RESTRICTED")) {
            user.clinical_notes = `Stable outpatient checkup history. General health evaluation recorded in secure electronic ledger.`;
          }
        }
      }
    });
  }

  // Execute immediate database backfill and save state
  backfillDb();

  const defaultHashOnStartup = getDefaultPasswordSha256();
  if (defaultHashOnStartup) {
    let passwordSyncNeeded = false;
    db_mock.users.forEach((user: any) => {
      if (user.provider === "duo" && !user.password) return;
      if (!user.password || user.password === "") {
        user.password = defaultHashOnStartup;
        passwordSyncNeeded = true;
      }
    });
    if (passwordSyncNeeded) {
      console.log("[VITALTRUST] Applied configured default password hash to users missing credentials.");
    }
  }

  savePersistedDb();

  // On change helper
  function savePersistedDb() {
    if (APP_ROLE === "dbserver" || IS_STANDALONE) {
      try {
        fs.writeFileSync(dbPath, JSON.stringify(db_mock, null, 2), "utf-8");
        console.log(`[VITALTRUST] Saved state to persistent_db.json`);
      } catch (e) {
        console.error(`[VITALTRUST] Error writing persistent_db.json:`, e);
      }
    }
  }

  const agentConfigPath = path.join(process.cwd(), "agent_config.json");
  const agentActivityLogPath = path.join(process.cwd(), "agent_activity_log.json");
  const agentRuntimeCtx: AgentRuntimeContext = {
    db: db_mock,
    savePersistedDb,
    createLog: (userId, userName, role, activity, status, details) =>
      createLog(userId, userName, role, activity, status, details),
    sendMessage: (senderId, receiverId, content) => {
      const sender = db_mock.users.find((u: any) => u.id === senderId);
      const receiver = db_mock.users.find((u: any) => u.id === receiverId);
      if (!sender || !receiver || !content?.trim()) return false;
      if (!canSendMessage(sender.role, receiver.role)) return false;
      db_mock.messages.push({
        id: `msg${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        senderId,
        receiverId,
        content: content.trim(),
        timestamp: new Date().toISOString(),
      });
      savePersistedDb();
      return true;
    },
    configPath: agentConfigPath,
    activityLogPath: agentActivityLogPath,
  };

  if (APP_ROLE === "aibroker" || IS_STANDALONE) {
    initAgentScheduler(agentRuntimeCtx);
  }

  function normalizeAndSecureUrl(urlStr: string): string {
    let url = (urlStr || "").trim();
    if (!url) return "";
    
    if (url.includes("run.app") || url.includes("aistudio") || url.includes("google.app")) {
      if (url.startsWith("http://")) {
        url = url.replace("http://", "https://");
      } else if (!url.startsWith("https://")) {
        url = `https://${url}`;
      }
    } else {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `http://${url}`;
      }
    }
    
    if (url.endsWith("/")) {
      url = url.slice(0, -1);
    }
    return url;
  }

  // Check if a URL points to this container
  function isSelfUrl(urlStr: string, hostHeader: string): boolean {
    if (!urlStr) return true;
    let cleanUrl = urlStr.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
    cleanUrl = cleanUrl.split(":")[0];

    let cleanHost = (hostHeader || "").toLowerCase();
    cleanHost = cleanHost.split(":")[0];
    
    if (cleanUrl === cleanHost) return true;
    if (cleanUrl === "localhost" || cleanUrl === "127.0.0.1") {
      return true;
    }
    if (process.env.APP_URL) {
      let envHost = process.env.APP_URL.replace(/^https?:\/\//, "").split("/")[0].toLowerCase().split(":")[0];
      if (cleanUrl === envHost) return true;
    }
    return false;
  }
  
  // LOGGING HELPER
  function createLog(userId: string, userName: string, role: string, activity: string, status: 'Success' | 'Failure' | 'Warning' | 'Info', details: string, req?: express.Request) {
    const getIpFromUrl = (urlStr: string) => {
      if (!urlStr) return "";
      let cleaned = normalizeAndSecureUrl(urlStr);
      try {
        const u = new URL(cleaned);
        return u.hostname;
      } catch (e) {
        return urlStr.replace(/^https?:\/\//, '').split(':')[0] || urlStr;
      }
    };

    let nodeRoleName = "STANDALONE";
    if (liveConfig && liveConfig.mode === "distributed") {
      const getIpStr = (url: string) => {
        const ip = getIpFromUrl(url);
        return ip ? ` (${ip})` : "";
      };
      if (APP_ROLE === "appserver") {
        nodeRoleName = `APPLICATION SERVER${getIpStr(liveConfig.appserver_url)}`;
      } else if (APP_ROLE === "dbserver") {
        nodeRoleName = `DATABASE SERVER${getIpStr(liveConfig.dbserver_url)}`;
      } else if (APP_ROLE === "aibroker") {
        nodeRoleName = `AI BROKER${getIpStr(liveConfig.aibroker_url)}`;
      } else {
        nodeRoleName = `SUB-APP NODE (${APP_ROLE.toUpperCase()})`;
      }
    } else {
      nodeRoleName = "STANDALONE";
    }

    const log = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date().toISOString(),
      userId,
      userName,
      role,
      activity,
      status,
      details,
      nodeRole: nodeRoleName,
      ip: req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || "0.0.0.0").toString() : undefined
    };

    if (db_mock.logs) {
      db_mock.logs.unshift(log);
      if (db_mock.logs.length > 500) db_mock.logs.pop(); // Keep manageable
    }
    savePersistedDb();

    // In a distributed deployment, forward non-dbserver node events to the central Database Server
    if (APP_ROLE !== "dbserver" && APP_ROLE !== "standalone" && liveConfig.mode === "distributed") {
      let dbserverUrl = liveConfig.dbserver_url || process.env.DB_SERVER_URL || "http://localhost:3000";
      let cleanDbUrl = normalizeAndSecureUrl(dbserverUrl);
      if (!cleanDbUrl.match(/:\d+/) && !cleanDbUrl.includes("run.app") && !cleanDbUrl.includes("aistudio")) {
        cleanDbUrl = `${cleanDbUrl}:3000`;
      }
      fetch(`${cleanDbUrl}/api/dbserver/admin/logs-external`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log)
      }).catch(err => {
        console.warn(`[FORWARD LOG WARNING] Forwarding from node [${APP_ROLE}] to dbserver [${cleanDbUrl}] failed:`, err.message);
      });
    }
  }

  // Basic Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  
  // Custom Logger & Header
  app.use((req, res, next) => {
    res.setHeader("X-Node-Role", APP_ROLE);
    if (!req.url.startsWith("/assets/")) {
      console.log(`[REQ] ${req.method} ${req.url} (Node: ${APP_ROLE})`);
    }
    next();
  });

  // --- HEALTH & DIAGNOSTICS ---
  app.get("/api/healthz", (req, res) => res.send("OK"));
  app.get("/api/status", (req, res) => res.json({ status: "online", node: APP_ROLE }));
  app.get("/api/diag", (req, res) => {
    res.json({ 
      role: APP_ROLE, 
      standalone: IS_STANDALONE, 
      host: req.headers.host,
      forwardedHost: req.headers["x-forwarded-host"],
      env: {
        APP_URL: process.env.APP_URL,
        NODE_ENV: process.env.NODE_ENV,
        DUO_ISSUER: !!process.env.DUO_ISSUER_URL
      },
      time: new Date().toISOString()
    });
  });

  // Return this node's exact local logs
  app.get("/api/system/local-logs", (req, res) => {
    res.json(db_mock.logs || []);
  });

  // Query logs from any of the nodes (including central aggregated dbserver logs)
  app.get("/api/system/node-logs", async (req, res) => {
    let targetNode = (req.query.node || "central").toString().toLowerCase();
    if (targetNode === "appserver") {
      targetNode = "appserver";
    }

    // Standalone or local fallback
    if (IS_STANDALONE || targetNode === "standalone") {
      return res.json(db_mock.logs || []);
    }

    const formatPeerUrlLocal = (urlStr: string) => {
      let url = normalizeAndSecureUrl(urlStr);
      if (!url.match(/:\d+/) && !url.includes("localhost") && !url.includes("127.0.0.1") && !url.includes("run.app") && !url.includes("aistudio")) {
        url = `${url}:3000`;
      }
      return url;
    };

    // Find custom URLs
    const urls: Record<string, string> = {
      appserver: formatPeerUrlLocal(liveConfig.appserver_url),
      dbserver: formatPeerUrlLocal(liveConfig.dbserver_url || process.env.DB_SERVER_URL || ""),
      aibroker: formatPeerUrlLocal(liveConfig.aibroker_url || process.env.AI_BROKER_URL || "")
    };

    // If target match local node role under distributed deployment
    const isLocalMatch = targetNode === APP_ROLE;
    if (isLocalMatch) {
      return res.json(db_mock.logs || []);
    }

    // Otherwise fetch from target node
    if (targetNode === "central") {
      // User requested viewing all audit logs across all 3 nodes.
      // We dynamically aggregate and merge logs in parallel from appserver, dbserver, and aibroker securely!
      const allLogs: any[] = [...(db_mock.logs || [])];
      
      const fetchTargetLogs = async (role: string, url: string) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s fast timeout
          const response = await fetch(`${url}/api/system/local-logs`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) return data;
          }
        } catch (err: any) {
          console.warn(`[AUDITLOGS DYNAMIC FETCH] Failed to fetch logs from [${role}] at [${url}]:`, err.message);
        }
        return [];
      };

      const peerFetches = Object.entries(urls)
        .filter(([r, url]) => {
          const isSelfRole = r === APP_ROLE;
          return !isSelfRole && url && !isSelfUrl(url, req.headers.host || "");
        })
        .map(async ([r, url]) => {
          return { role: r, logs: await fetchTargetLogs(r, url) };
        });

      try {
        const results = await Promise.all(peerFetches);
        for (const resItem of results) {
          allLogs.push(...resItem.logs);
        }
      } catch (err: any) {
        console.error(`[AUDITLOGS DYNAMIC MERGE ERROR]`, err.message);
      }

      // De-duplicate logs by id (or fallback composite key)
      const uniqueLogsMap = new Map();
      for (const log of allLogs) {
        if (log) {
          const key = log.id || `${log.timestamp}_${log.userId}_${log.role}_${log.activity}`;
          if (!uniqueLogsMap.has(key)) {
            uniqueLogsMap.set(key, log);
          }
        }
      }

      const merged = Array.from(uniqueLogsMap.values());
      // Sort descending by timestamp
      merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return res.json(merged);
    }

    // Specific node logs request
    const targetUrl = urls[targetNode];
    if (!targetUrl || isSelfUrl(targetUrl, req.headers.host || "")) {
      return res.json(db_mock.logs || []);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
      const result = await fetch(`${targetUrl}/api/system/local-logs`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (result.ok) {
        const data = await result.json();
        return res.json(data);
      } else {
        throw new Error(`HTTP ${result.status}`);
      }
    } catch (err: any) {
      console.warn(`[AUDITLOGS NODE PROXY] Failed to fetch logs from candidate [${targetNode}] at [${targetUrl}]:`, err.message);
      return res.json([
        {
          id: `err_${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: "system",
          userName: "Service Discovery",
          role: "system",
          activity: "Node Audit Request Connection Failure",
          status: "Warning",
          details: `Could not connect to ${targetNode.toUpperCase()} Node logs server at ${targetUrl}. Is the service running, or is it isolated under Cisco Secure Access (ZTNA) / Secure Workload rules? Connection error: ${err.message}`,
          nodeRole: `${targetNode.toUpperCase()} (Connection Failed)`
        },
        ...(db_mock.logs || [])
      ]);
    }
  });

  // --- GLOBAL SYSTEM & PEER CONFIGURATION ENDPOINTS ---
  app.get("/api/system/config", (req, res) => {
    let currentConfig = {
      mode: "standalone",
      role: "standalone",
      appserver_url: "http://localhost:3000",
      dbserver_url: "http://localhost:3000",
      aibroker_url: "http://localhost:3000"
    };
    if (fs.existsSync(configPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (parsed.mode !== "distributed") parsed.mode = "standalone";
        currentConfig = { ...currentConfig, ...parsed };
      } catch (e) {}
    }
    // Absolute alignment: Override file configuration role/mode with active runtime variables in process memory
    currentConfig.role = APP_ROLE;
    currentConfig.mode = IS_STANDALONE ? "standalone" : (liveConfig.mode || "standalone");
    res.json(currentConfig);
  });

  app.post("/api/system/config", async (req, res) => {
    let { mode, role, appserver_url, dbserver_url, aibroker_url, propagated } = req.body;
    if (mode !== "distributed") mode = "standalone";

    let finalRole = (role || liveConfig.role || "standalone").trim().toLowerCase();
    if (!DISTRIBUTED_ROLES.includes(finalRole)) {
      finalRole = mode === "distributed" ? "appserver" : "standalone";
    }

    const oldMode = liveConfig.mode;
    const oldRole = liveConfig.role;

    const newConfig = {
      mode: mode || "standalone",
      role: finalRole,
      appserver_url: appserver_url || "http://localhost:3000",
      dbserver_url: dbserver_url || "http://localhost:3000",
      aibroker_url: aibroker_url || "http://localhost:3000"
    };

    try {
      // Server-side dynamic DB preservation: If reverting from distributed to standalone, fetch live DB dump from dbserver
      if (newConfig.mode === "standalone" && oldMode === "distributed" && APP_ROLE === "appserver") {
        let dbServerUrlVal = dbserver_url || liveConfig.dbserver_url;
        if (dbServerUrlVal) {
          let cleanDbUrl = dbServerUrlVal.trim();
          if (!cleanDbUrl.startsWith("http://") && !cleanDbUrl.startsWith("https://")) {
            cleanDbUrl = `http://${cleanDbUrl}`;
          }
          if (!cleanDbUrl.match(/:\d+/) && !cleanDbUrl.includes("run.app") && !cleanDbUrl.includes("aistudio")) {
            cleanDbUrl = `${cleanDbUrl}:3000`;
          }
          console.log(`[STANDALONE TRANSITION] Reverting to standalone. Pulling live DB backup server-side from: ${cleanDbUrl}`);
          try {
            const dumpRes = await fetch(`${cleanDbUrl}/api/system/db-dump`);
            if (dumpRes.ok) {
              const dbData = await dumpRes.json();
              if (dbData && typeof dbData === "object" && Object.keys(dbData).length > 0) {
                fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), "utf-8");
                Object.keys(db_mock).forEach(key => delete db_mock[key]);
                Object.assign(db_mock, dbData);
                console.log(`[STANDALONE TRANSITION SUCCESS] Successfully restored central database to local memory from ${cleanDbUrl}`);
              }
            } else {
              console.warn(`[STANDALONE TRANSITION WARNING] DB fetch from peer returned non-OK status: ${dumpRes.status}`);
            }
          } catch (fetchErr: any) {
            console.error(`[STANDALONE TRANSITION ERROR] Server-to-server DB fallback failed:`, fetchErr.message);
          }
        }
      }

      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), "utf-8");
      // Update liveConfig variable in memory too!
      Object.assign(liveConfig, newConfig);
      recomputeNetworkFlags();
      console.log("[VITALTRUST] Dynamic configuration updated to:", newConfig);

      // Async propagation to other nodes if this is the initiator (always propagate to avoid orphaned nodes)
      if (!propagated) {
        const getCleanUrl = (urlStr: string) => {
          let trimmed = (urlStr || "").trim();
          if (!trimmed) return "";
          if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            trimmed = `http://${trimmed}`;
          }
          if (trimmed.endsWith("/")) {
            trimmed = trimmed.slice(0, -1);
          }
          if (!trimmed.match(/:\d+/) && !trimmed.includes("run.app") && !trimmed.includes("aistudio")) {
            trimmed = `${trimmed}:3000`;
          }
          return trimmed;
        };

        const peers = [
          { url: getCleanUrl(newConfig.appserver_url), role: "appserver" },
          { url: getCleanUrl(newConfig.dbserver_url), role: "dbserver" },
          { url: getCleanUrl(newConfig.aibroker_url), role: "aibroker" }
        ];

        const normalizeRoleLocal = (roleStr: string) => {
          const r = (roleStr || "").trim().toLowerCase();
          if (DISTRIBUTED_ROLES.includes(r)) return r;
          return r === "standalone" ? "standalone" : "appserver";
        };

        for (const peer of peers) {
          const peerNormRole = normalizeRoleLocal(peer.role);
          const currentNormRole = normalizeRoleLocal(newConfig.role || APP_ROLE);
          const activeAppNormRole = normalizeRoleLocal(APP_ROLE);

          // 1. Skip if the peer's role matches the role of this machine
          if (peerNormRole === currentNormRole || peerNormRole === activeAppNormRole) {
            console.log(`[PROPAGATE CONFIG] Skipping propagation to peer [${peer.role}] because it is our own role.`);
            continue;
          }

          // 2. Skip if the peer URL points directly to this machine's host
          if (isSelfUrl(peer.url, req.headers.host || "")) {
            console.log(`[PROPAGATE CONFIG] Skipping propagation to peer [${peer.role}] at [${peer.url}] because URL points to self.`);
            continue;
          }

          if (peer.url) {
            const peerTargetRole = newConfig.mode === "standalone" ? "standalone" : peer.role;
            console.log(`[PROPAGATE CONFIG] Propagating config (Mode=${newConfig.mode}, Role=${peerTargetRole}) to peer [${peer.role}] at [${peer.url}]`);
            fetch(`${peer.url}/api/system/config`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mode: newConfig.mode,
                role: peerTargetRole,
                appserver_url: newConfig.appserver_url,
                dbserver_url: newConfig.dbserver_url,
                aibroker_url: newConfig.aibroker_url,
                propagated: true
              })
            }).then(async (peerRes) => {
              if (peerRes.ok) {
                console.log(`[PROPAGATE CONFIG SUCCESS] Successfully synced config with [${peer.role}]`);
                // Issue a reboot command to the peer node to re-compile state
                await fetch(`${peer.url}/api/system/restart`, { method: "POST" }).catch(() => {});
                console.log(`[PROPAGATE CONFIG SUCCESS] Issued reboot to [${peer.role}] to compile state.`);
              } else {
                console.warn(`[PROPAGATE CONFIG WARNING] Failed syncing with [${peer.role}], status: ${peerRes.status}`);
              }
            }).catch(err => {
              console.warn(`[PROPAGATE CONFIG WARNING] Propagation to [${peer.role}] failed:`, err.message);
            });
          }
        }
      }

      res.json({ success: true, message: "System configuration saved successfully." });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/system/console-logs", (req, res) => {
    try {
      if (fs.existsSync(consoleLogPath)) {
        const content = fs.readFileSync(consoleLogPath, "utf-8");
        // Pull the last 1500 lines for high performance and high density view
        const lines = content.split("\n");
        const lastLines = lines.slice(-1500).join("\n");
        res.json({ success: true, logs: lastLines });
      } else {
        res.json({ success: true, logs: "No system logs compiled yet." });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/system/console-logs/download", (req, res) => {
    try {
      if (fs.existsSync(consoleLogPath)) {
        res.download(consoleLogPath, "vitaltrust_server_console.log");
      } else {
        res.status(404).send("No system logs compiled yet.");
      }
    } catch (err: any) {
      res.status(500).send(`Error downloading logs: ${err.message}`);
    }
  });

  app.post("/api/system/console-logs/clear", (req, res) => {
    try {
      fs.writeFileSync(consoleLogPath, `[${new Date().toISOString()}] System logs cleared.\n`, "utf-8");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/system/db-dump", (req, res) => {
    res.json(db_mock);
  });

  app.post("/api/system/db-dump-save", (req, res) => {
    const { dbData } = req.body;
    if (dbData && typeof dbData === "object") {
      try {
        fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), "utf-8");
        // Re-load into memory:
        Object.keys(db_mock).forEach(key => delete db_mock[key]);
        Object.assign(db_mock, dbData);
        console.log("[VITALTRUST] Globally loaded database dump into memory!");
        res.json({ success: true });
      } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
      }
    } else {
      res.status(400).json({ success: false, error: "Invalid database dump" });
    }
  });

  // Cross-node proxy peer pinging to prevent local browser CORS blocks
  app.get("/api/system/check-peer", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, error: "Missing url parameter" });
    }
    const formatPeerUrlLocal = (urlStr: string) => {
      let uStr = normalizeAndSecureUrl(urlStr);
      if (!uStr.match(/:\d+/) && !uStr.includes("localhost") && !uStr.includes("127.0.0.1") && !uStr.includes("run.app") && !uStr.includes("aistudio")) {
        uStr = `${uStr}:3000`;
      }
      return uStr;
    };
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      let cleanUrl = formatPeerUrlLocal(url);
      const pRes = await fetch(`${cleanUrl}/api/status`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (pRes.ok) {
        return res.json({ success: true, status: "Online" });
      }
    } catch (e: any) {}

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      let cleanUrl = formatPeerUrlLocal(url);
      const pRes = await fetch(`${cleanUrl}/api/healthz`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (pRes.ok) {
        return res.json({ success: true, status: "Online" });
      }
    } catch (e: any) {}

    res.json({ success: false, status: "Offline" });
  });

  // Dynamic reboot command for microsegmentation and role shifts
  app.post("/api/system/restart", (req, res) => {
    res.json({ success: true, message: "Server reboot command issued successfully." });
    console.log("[VITALTRUST] Server reboot triggered dynamically. Exiting in 1 sec...");
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });

  app.get("/api/system/nodes", async (req, res) => {
    let currentConfig = {
      mode: "standalone",
      role: "standalone",
      appserver_url: "http://localhost:3000",
      dbserver_url: "http://localhost:3000",
      aibroker_url: "http://localhost:3000"
    };
    if (fs.existsSync(configPath)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (loaded.mode !== "distributed") loaded.mode = "standalone";
        currentConfig = { ...currentConfig, ...loaded };
      } catch (e) {}
    }

    const normalizeRole = (roleStr: string) => {
      const r = (roleStr || "").trim().toLowerCase();
      if (DISTRIBUTED_ROLES.includes(r)) return r;
      return "standalone";
    };

    const mode = currentConfig.mode || "standalone";
    const role = normalizeRole(currentConfig.role || APP_ROLE);

    const nodesStatus: any = {
      appserver: { status: "Offline", ip: "127.0.0.1", url: currentConfig.appserver_url || "http://localhost:3000" },
      dbserver: { status: "Offline", ip: "127.0.0.1", url: currentConfig.dbserver_url || process.env.DB_SERVER_URL || "http://localhost:3000" },
      aibroker: { status: "Offline", ip: "127.0.0.1", url: currentConfig.aibroker_url || process.env.AI_BROKER_URL || "http://localhost:3000" }
    };

    if (mode === "standalone") {
      nodesStatus.appserver.status = "Online";
      nodesStatus.dbserver.status = "Online";
      nodesStatus.aibroker.status = "Online";
      return res.json({ mode: "standalone", role: "standalone", app_role: APP_ROLE, nodes: nodesStatus });
    }

    // Mark local node as Online
    if (nodesStatus[role]) {
      nodesStatus[role].status = "Online";
    }

    const formatPeerUrl = (urlStr: string) => {
      let url = normalizeAndSecureUrl(urlStr);
      if (!url.match(/:\d+/) && !url.includes("localhost") && !url.includes("127.0.0.1") && !url.includes("run.app") && !url.includes("aistudio")) {
        url = `${url}:3000`;
      }
      return url;
    };

    const getIP = (urlStr: string) => {
      try {
        const clean = formatPeerUrl(urlStr);
        const u = new URL(clean);
        return u.hostname;
      } catch (e) {
        return urlStr.trim() || "127.0.0.1";
      }
    };

    const getCandidates = (urlStr: string) => {
      let trimmed = normalizeAndSecureUrl(urlStr);
      const candidates = new Set<string>();
      candidates.add(trimmed); // Candidate 1: As-is with protocol

      // Candidate 2: Forced Port 3000
      let with3000 = trimmed;
      if (!with3000.match(/:\d+/)) {
        with3000 = `${with3000}:3000`;
      }
      candidates.add(with3000);

      // Candidate 3: No custom port (standard 80/443)
      let noPort = trimmed;
      if (noPort.match(/:\d+/)) {
        noPort = noPort.replace(/:\d+$/, "");
      }
      candidates.add(noPort);

      return Array.from(candidates);
    };

    const checkPeer = async (urlStr: string, expectedRole: string) => {
      const candidates = getCandidates(urlStr);

      // Try status check with normalized roles
      for (const cleanUrl of candidates) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000); // Relaxed timeout for reliability
          const peerRes = await fetch(`${cleanUrl}/api/status`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (peerRes.ok) {
            const body = await peerRes.json().catch(() => null);
            if (body && normalizeRole(body.node) === normalizeRole(expectedRole)) {
              return "Online";
            }
          }
        } catch (e) {}
      }

      // Try absolute healthz check fallback
      for (const cleanUrl of candidates) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const peerRes2 = await fetch(`${cleanUrl}/api/healthz`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (peerRes2.ok) {
            return "Online";
          }
        } catch (e) {}
      }

      return "Offline";
    };

    // Query other nodes and verify they are correctly configured for their respective personas
    if (role === "appserver") {
      nodesStatus.dbserver.status = await checkPeer(nodesStatus.dbserver.url, "dbserver");
      nodesStatus.aibroker.status = await checkPeer(nodesStatus.aibroker.url, "aibroker");
    } else if (role === "dbserver") {
      nodesStatus.appserver.status = await checkPeer(nodesStatus.appserver.url, "appserver");
      nodesStatus.aibroker.status = await checkPeer(nodesStatus.aibroker.url, "aibroker");
    } else if (role === "aibroker") {
      nodesStatus.appserver.status = await checkPeer(nodesStatus.appserver.url, "appserver");
      nodesStatus.dbserver.status = await checkPeer(nodesStatus.dbserver.url, "dbserver");
    }

    nodesStatus.appserver.ip = getIP(nodesStatus.appserver.url);
    nodesStatus.dbserver.ip = getIP(nodesStatus.dbserver.url);
    nodesStatus.aibroker.ip = getIP(nodesStatus.aibroker.url);

    res.json({
      mode: "distributed",
      role: role,
      app_role: APP_ROLE,
      nodes: nodesStatus
    });
  });

  // --- OIDC CONFIGURATION (Cisco Duo) ---
  let duoClient: any = null;
  async function getDuoClient() {
    if (duoClient) return duoClient;

    // Force reload from file if it exists (for hot-injected env vars)
    const activeEnvPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(activeEnvPath)) {
       dotenv.config({ path: activeEnvPath, override: true });
    }
    
    const DUO_ISSUER_URL = process.env.DUO_ISSUER_URL;
    const DUO_CLIENT_ID = process.env.DUO_CLIENT_ID;
    const DUO_CLIENT_SECRET = process.env.DUO_CLIENT_SECRET;

    if (!DUO_ISSUER_URL || !DUO_CLIENT_ID || !DUO_CLIENT_SECRET) {
      console.log("[Duo] Configuration missing in environment. Keys check:", {
        issuer: !!DUO_ISSUER_URL,
        id: !!DUO_CLIENT_ID,
        secret: !!DUO_CLIENT_SECRET
      });
      return null;
    }
    
    try {
      console.log("[Duo] Attempting discovery with:", DUO_ISSUER_URL);
      const issuer = await Issuer.discover(DUO_ISSUER_URL);
      
      // DIAGNOSTICS: Log what Duo says it supports
      console.log("[Duo-Discovery] Supported Scopes:", (issuer.metadata.scopes_supported as string[] | undefined)?.join(", ") || "None listed");
      console.log("[Duo-Discovery] Supported Claims:", (issuer.metadata.claims_supported as string[] | undefined)?.join(", ") || "None listed");

      duoClient = new issuer.Client({
        client_id: DUO_CLIENT_ID,
        client_secret: DUO_CLIENT_SECRET,
        response_types: ["code"],
      });
      console.log("[Duo] Discovery successful. Issuer:", issuer.issuer);
      return duoClient;
    } catch (err) {
      console.error("[Duo] Discovery failed for URL:", DUO_ISSUER_URL);
      console.error("[Duo] Discovery Error:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  // Diagnostic route for Duo
  app.get("/api/auth/duo/debug", async (req, res) => {
    const envFileExists = fs.existsSync(path.join(process.cwd(), ".env"));
    let envContent = "";
    if (envFileExists) {
        try {
            const raw = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
            envContent = raw.split("\n").map(line => {
                if (line.includes("SECRET") || line.includes("ID")) return line.split("=")[0] + "=REDACTED";
                return line;
            }).join("\n");
        } catch(e) {}
    }

    const client = await getDuoClient();
    res.json({
        envFound: envFileExists,
        envScrubbed: envContent,
        config: {
            ISSUER: process.env.DUO_ISSUER_URL,
            CLIENT_ID: process.env.DUO_CLIENT_ID ? "PRESENT" : "MISSING",
        },
        discoveryStatus: client ? "SUCCESS" : "FAILED",
        timestamp: new Date().toISOString()
    });
  });

  // Helper to get public redirect URI dynamically based on current request host
  const getPublicRedirectUri = (req: express.Request) => {
    // Priority: 1. Manual ENV, 2. X-Forwarded-Host (ingress), 3. Host header
    const publicHost = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost:3000";
    
    // Cloud Run terminates SSL at the load balancer. We must check x-forwarded-proto 
    // but default to https for any .run.app host to satisfy OIDC requirements.
    let protocol = req.headers["x-forwarded-proto"] || "http";
    if (publicHost.toString().includes(".run.app")) {
      protocol = "https";
      console.log(`[Auth] Detected Cloud Run host [${publicHost}], forcing HTTPS protocol.`);
    }

    return `${protocol}://${publicHost}/api/auth/callback`;
  };

  // --- AUTH ROUTES ---
  if (true) {
    // API used by frontend to get the Duo Authorization URL
    app.get("/api/auth/duo/url", async (req, res) => {
      const client = await getDuoClient();
      if (!client) return res.status(503).json({ error: "Duo OIDC not configured" });
      
      const redirectUri = getPublicRedirectUri(req);
      const state = generators.state();
      const nonce = generators.nonce();
      
      // Set cookies for validation during callback
      res.cookie("duo_state", state, { httpOnly: true, secure: true, sameSite: "none" });
      res.cookie("duo_nonce", nonce, { httpOnly: true, secure: true, sameSite: "none" });
      
      const url = client.authorizationUrl({ 
        scope: "openid profile email groups duo_groups", 
        state, 
        nonce,
        redirect_uri: redirectUri,
        prompt: "login",
        max_age: 0
      });
      console.log(`[Auth] Duo redirected started. Force Login=true. Target: ${redirectUri}`);
      res.json({ url });
    });

    const DUO_PATIENT_POOL_SIZE = 20;
    const DUO_CLINICIAN_ASSIGN_TARGET = 5;

    function isDuoAssignmentPoolPatient(patientId: string): boolean {
      const match = /^patient(\d+)$/.exec(patientId);
      if (!match) return false;
      const num = parseInt(match[1], 10);
      return num >= 1 && num <= DUO_PATIENT_POOL_SIZE;
    }

    function resolveDbServerUrlForProvisioning(): string | null {
      if (IS_STANDALONE || APP_ROLE === "dbserver") return null;
      if (liveConfig.mode !== "distributed") return null;
      const raw = (liveConfig.dbserver_url || process.env.DB_SERVER_URL || "").trim();
      if (!raw || raw.toUpperCase() === "TBD") return null;
      let url = normalizeAndSecureUrl(raw);
      if (!url.match(/:\d+/) && !url.includes("run.app") && !url.includes("aistudio")) {
        url = `${url}:3000`;
      }
      return url;
    }

    async function ensureDuoClinicianPatientAssignments(u: any, role: "doctor" | "nurse"): Promise<void> {
      const assignField = role === "doctor" ? "assignedDoctorId" : "assignedNurseId";
      const registry = role === "doctor" ? db_mock.doctors : db_mock.nurses;
      const displayName = role === "doctor" ? `Dr. ${u.realName}` : u.realName;

      if (!registry.some((entry: any) => entry.id === u.id)) {
        registry.push({ id: u.id, name: displayName });
      }

      const dbBase = resolveDbServerUrlForProvisioning();
      let patients: any[];

      if (dbBase) {
        const res = await fetch(`${dbBase}/api/dbserver/patients`, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) {
          console.error(`[Auth] Failed to load patients from dbserver (${res.status}) for Duo ${role} assignment`);
          return;
        }
        patients = await res.json();
      } else {
        patients = db_mock.patients;
      }

      const pool = patients.filter((p: any) => isDuoAssignmentPoolPatient(p.id));
      const alreadyAssigned = pool.filter((p: any) => p[assignField] === u.id);
      const needed = Math.max(0, DUO_CLINICIAN_ASSIGN_TARGET - alreadyAssigned.length);
      if (needed === 0) {
        console.log(`[Auth] Duo ${role} ${u.id} already has ${alreadyAssigned.length} pool patients assigned`);
        return;
      }

      const candidates = pool
        .filter((p: any) => p[assignField] !== u.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, needed);

      let assignedCount = 0;
      for (const patient of candidates) {
        if (dbBase) {
          const body: Record<string, string> = { patientId: patient.id };
          if (role === "doctor") {
            body.doctorId = u.id;
            if (patient.assignedNurseId) body.nurseId = patient.assignedNurseId;
          } else {
            body.nurseId = u.id;
            if (patient.assignedDoctorId) body.doctorId = patient.assignedDoctorId;
          }
          try {
            const res = await fetch(`${dbBase}/api/dbserver/admin/assign-care-team`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(15000)
            });
            if (res.ok) assignedCount++;
            else console.warn(`[Auth] assign-care-team failed for ${patient.id}: ${res.status}`);
          } catch (e) {
            console.warn(`[Auth] assign-care-team error for ${patient.id}:`, e);
          }
        } else {
          const localPatient = db_mock.patients.find((p: any) => p.id === patient.id);
          if (localPatient) {
            localPatient[assignField] = u.id;
            if (role === "doctor") {
              db_mock.appointments.forEach((apt: any) => {
                if (apt.patientId === patient.id) apt.doctorId = u.id;
              });
            }
            assignedCount++;
          }
        }
      }

      console.log(
        `[Auth] Assigned ${assignedCount} patients from pool (patient1–patient${DUO_PATIENT_POOL_SIZE}) to Duo ${role}: ${u.id} (total: ${alreadyAssigned.length + assignedCount})`
      );
    }

    // Duo Callback Handler
    const handleCallback = async (req: express.Request, res: express.Response) => {
      console.log(`[Auth] Callback handler triggered: ${req.url}`);
      try {
        const client = await getDuoClient();
        if (!client) throw new Error("Duo Client not available");
        
        const params = client.callbackParams(req);
        const state = req.cookies.duo_state;
        const nonce = req.cookies.duo_nonce;
        const redirectUri = getPublicRedirectUri(req);

        const tokenSet = await client.callback(redirectUri, params, { state, nonce });
        
        // TROUBLESHOOTING: Check granted scopes and fetch UserInfo
        console.log(`[Auth] TokenSet Scopes: ${tokenSet.scope || 'none'}`);
        let claims = tokenSet.claims();
        console.log(`[Auth] ID Token Claims:`, JSON.stringify(claims));

        let userinfo: any = {};
        try {
          userinfo = await client.userinfo(tokenSet);
          console.log(`[Auth] UserInfo received:`, JSON.stringify(userinfo));
        } catch (uiErr) {
          console.warn(`[Auth] Failed to fetch UserInfo from Duo:`, uiErr);
        }

        // Merge UserInfo into claims for easier processing
        console.log(`[Auth] Basic Claims (ID Token):`, JSON.stringify(claims));
        console.log(`[Auth] UserInfo Result:`, JSON.stringify(userinfo));
        const fullProfile: any = { ...claims, ...userinfo };
        
        // --- Group Discovery Troubleshooter ---
        console.log(`[Duo-Groups-Troubleshoot] Profile Keys: ${Object.keys(fullProfile).join(', ')}`);
        console.log(`[Duo-Groups-Troubleshoot] Full Raw Profile:`, JSON.stringify(fullProfile));
        
        // Identity Extraction Strategy
        // Duo username is typically in 'preferred_username' or 'user' (if string)
        const duoUsername = fullProfile.preferred_username || (typeof fullProfile.user === 'string' ? fullProfile.user : undefined);
        const email = fullProfile.email || fullProfile.mail || (typeof fullProfile.user === 'string' && fullProfile.user.includes("@") ? fullProfile.user : undefined);
        
        // The display identity used for logs and finding user
        const identity = duoUsername || email || fullProfile.sub;
        
        // Extract names
        const firstName = fullProfile.given_name || "";
        const lastName = fullProfile.family_name || "";
        const fullName = fullProfile.name || `${firstName} ${lastName}`.trim() || duoUsername || "Duo User";
        
        // Group/Role mapping logic - Check both ID Token and UserInfo
        // Duo OIDC custom claims can appear as top-level or nested
        // We also check 'user.groups' if it came through as a nested object
        let duoGroupsRaw = fullProfile.groups || 
                          fullProfile.group ||
                          fullProfile.duo_groups ||
                          (fullProfile as any)["https://idp.duo.com/groups"] ||
                          (fullProfile as any).roles || 
                          (fullProfile as any).member_of || 
                          (fullProfile as any).memberOf ||
                          (fullProfile as any).entitlements || [];
        
        console.log(`[Duo-Groups-Troubleshoot] duoGroupsRaw (Initial):`, duoGroupsRaw);

        if (typeof fullProfile.user === 'object' && fullProfile.user !== null) {
          const userObj = fullProfile.user as any;
          console.log(`[Duo-Groups-Troubleshoot] Found nested 'user' object:`, JSON.stringify(userObj));
          const nestedGroups = userObj.groups || userObj.roles || userObj.member_of || [];
          console.log(`[Duo-Groups-Troubleshoot] Nested groups discovered:`, nestedGroups);
          duoGroupsRaw = Array.isArray(duoGroupsRaw) ? duoGroupsRaw.concat(nestedGroups) : [duoGroupsRaw, ...nestedGroups];
        }

        // Sometimes Duo sends groups as a comma-separated string
        if (typeof duoGroupsRaw === 'string') {
          console.log(`[Duo-Groups-Troubleshoot] Decoding string-based group list: ${duoGroupsRaw}`);
          duoGroupsRaw = duoGroupsRaw.split(',').map(g => g.trim());
        }

        const duoGroups = Array.isArray(duoGroupsRaw) ? duoGroupsRaw.filter(Boolean) : [duoGroupsRaw].filter(Boolean);
        console.log(`[Duo-Groups-Troubleshoot] Final Processed groups for [${identity}]:`, duoGroups);

        let mappedRole: "admin" | "doctor" | "nurse" | "patient" = "doctor"; // Default fallback
        
        // --- Role Mapping Strategy: Identity-Based Override ---
        // Since Duo groups are missing, we look for keywords in the identity string
        const idLower = identity.toString().toLowerCase();
        console.log(`[Auth] Role mapping search in identity: [${idLower}]`);

        if (idLower.includes("admin")) {
          mappedRole = "admin";
        } else if (idLower.includes("doctor")) {
          mappedRole = "doctor";
        } else if (idLower.includes("nurse")) {
          mappedRole = "nurse";
        } else if (idLower.includes("patient")) {
          mappedRole = "patient";
        } else {
          // Fallback: Check groups if identity match fails
          const gLower = duoGroups.map(g => g.toString().toLowerCase());
          if (gLower.some(g => g.includes("admin"))) {
            mappedRole = "admin";
          } else if (gLower.some(g => g.includes("doctor"))) {
            mappedRole = "doctor";
          } else if (gLower.some(g => g.includes("nurse"))) {
            mappedRole = "nurse";
          } else if (gLower.some(g => g.includes("patient"))) {
            mappedRole = "patient";
          }
        }

        const groupsStr = duoGroups.length > 0 ? duoGroups.join(", ") : "none (OIDC payload missing 'groups' claim)";
        console.log(`[Auth] Identity: ${identity} | Username: ${duoUsername || 'N/A'} | Groups: ${groupsStr} -> ${mappedRole}`);
        console.log(`[Auth] Available Claims Keys: ${Object.keys(fullProfile).join(", ")}`);
        
        // Match user by identity (ensure we link correctly)
        let user = db_mock.users.find((u: any) => 
          u.id === (identity || fullProfile.sub) || 
          u.id === `duo_${duoUsername}` || // Legacy match
          (email && u.email?.toLowerCase() === email.toString().toLowerCase())
        );
        
        // Helper to ensure dynamic mock clinical datasets/roles exist for Duo SSO logins
        const ensureDuoRoleData = async (u: any) => {
          if (u.role === "patient") {
            // Seed full clinical stats and PII for testing DLP
            u.ssn = u.ssn || `999-55-${1000 + Math.floor(Math.random() * 8999)}`;
            u.insurance_id = u.insurance_id || `BCBS-${3211000 + Math.floor(Math.random() * 8999)}`;
            u.phone = u.phone || "555-401-2094";
            u.address = u.address || "170 West Tasman Dr, San Jose, CA 95134";

            // Randomly select dynamic conditions with ~40% chance of being Healthy
            const duoConditions = ["Hypertension", "Diabetes", "Recovery", "Allergies", "Asthma", "Hyperlipidemia", "Arrhythmia", "Chronic Pain", "Insomnia"];
            const isHealthy = Math.random() < 0.40;
            const chosenCondition = isHealthy ? "Healthy" : duoConditions[Math.floor(Math.random() * duoConditions.length)];
            
            const getMeds = (cond: string) => {
              switch (cond) {
                case "Healthy": return ["Omega-3 Tablets", "Vitamin D3 1000IU"];
                case "Hypertension": return ["Amlodipine 5mg", "Lisinopril 10mg"];
                case "Diabetes": return ["Metformin 500mg"];
                case "Recovery": return ["Ibuprofen 400mg"];
                case "Allergies": return ["Claritin 10mg"];
                case "Asthma": return ["Albuterol Inhaler"];
                case "Hyperlipidemia": return ["Atorvastatin 20mg"];
                case "Arrhythmia": return ["Metoprolol 25mg"];
                case "Chronic Pain": return ["Gabapentin 100mg"];
                case "Insomnia": return ["Melatonin 5mg"];
                default: return ["Multivitamins"];
              }
            };
            const assignedMeds = getMeds(chosenCondition);

            u.clinical_notes = u.clinical_notes || `Authenticated via Duo IAM federated SSO. Diagnosed condition: ${chosenCondition}. Active treatment protocols tracked securely under standalone micro-segmentation policies. High-value data monitor active.`;

            // Verify they have a corresponding EHR record
            let pRecord = db_mock.patients.find((p: any) => p.id === u.id);
            if (!pRecord) {
              console.log(`[Auth] Provisioning rich patient record for dynamic Duo identity: ${u.id}`);
              
              // Seed random doctor and nurse assignments
              const randomDoctorId = db_mock.doctors.length > 0
                ? db_mock.doctors[Math.floor(Math.random() * db_mock.doctors.length)].id
                : "doctor1";
              const randomNurseId = db_mock.nurses.length > 0
                ? db_mock.nurses[Math.floor(Math.random() * db_mock.nurses.length)].id
                : "nurse1";

              const randomDoctorName = db_mock.doctors.find((d: any) => d.id === randomDoctorId)?.name || "Dr. Gregory House";
              const randomNurseName = db_mock.nurses.find((n: any) => n.id === randomNurseId)?.name || "Nurse Ratched";

              pRecord = {
                id: u.id,
                name: u.realName,
                dob: `${1975 + Math.floor(Math.random() * 25)}-${(1 + Math.floor(Math.random() * 11)).toString().padStart(2, '0')}-${(1 + Math.floor(Math.random() * 27)).toString().padStart(2, '0')}`,
                ssn: u.ssn,
                insurance_id: u.insurance_id,
                phone: u.phone,
                address: u.address,
                email: u.email,
                condition: chosenCondition,
                medications: assignedMeds,
                lastVisit: new Date().toISOString().split("T")[0],
                status: "active",
                assignedDoctorId: randomDoctorId,
                assignedNurseId: randomNurseId,
                clinical_notes: u.clinical_notes,
                vitals: { 
                  hr: (68 + Math.floor(Math.random() * 15)).toString(), 
                  temp: (97.8 + Math.random() * 0.9).toFixed(1), 
                  bp: `${115 + Math.floor(Math.random() * 12)}/${74 + Math.floor(Math.random() * 8)}`, 
                  lastUpdated: new Date().toISOString().split('T')[0] 
                }
              };
              db_mock.patients.push(pRecord);

              // Seed detailed medication lists matching their condition
              assignedMeds.forEach((medName, mIdx) => {
                db_mock.medications_detailed.push({
                  id: `med_${u.id}_${mIdx}`,
                  patientId: u.id,
                  name: medName.split(' ')[0],
                  dosage: medName.split(' ')[1] || "10mg",
                  frequency: "Once daily",
                  startDate: new Date().toISOString().split('T')[0],
                  status: "administered",
                  administeredAt: "09:00 AM"
                });
              });

              // Seed 2 or 3 dynamic future appointments
              const numFutureApts = 2 + Math.floor(Math.random() * 2); // 2 or 3
              for (let j = 0; j < numFutureApts; j++) {
                db_mock.appointments.push({
                  id: `apt_${u.id}_${j}`,
                  patientId: u.id,
                  doctorId: randomDoctorId,
                  nurseId: randomNurseId,
                  date: `2026-09-${12 + j * 6}`,
                  time: `${9 + j * 2}:30 AM`,
                  reason: ["Routine Posture Analysis", "Metabolic Profiling Review", "Cardiopulmonary EKG Follow-up"][j % 3],
                  status: "confirmed"
                });
              }

              // Seed lab test results
              db_mock.lab_results.push(
                {
                  id: `lab_${u.id}_0`,
                  patientId: u.id,
                  testName: "Lipid Panel",
                  date: "2026-08-01",
                  result: "Borderline",
                  notes: "LDL Cholesterol slightly elevated. Standard cardio safety review recommended."
                },
                {
                  id: `lab_${u.id}_1`,
                  patientId: u.id,
                  testName: "Glycemic Profiling Analysis",
                  date: "2026-08-01",
                  result: "Normal",
                  notes: "Excellent compliance ratios observed."
                }
              );

              // Seed dynamic billing statements
              db_mock.billing.push({
                id: `bill_${u.id}_0`,
                patientId: u.id,
                date: "2026-08-02",
                description: "EHR Account Setup and Comprehensive Baseline Diagnostics",
                amount: 145,
                status: "paid",
                doctorId: randomDoctorId,
                doctorName: randomDoctorName,
                nurseId: randomNurseId,
                nurseName: randomNurseName,
              });

              // Seed welcome messaging
              db_mock.messages.push({
                id: `msg_${u.id}_init`,
                senderId: randomDoctorId,
                receiverId: u.id,
                content: `Welcome to VitalTrust, ${u.realName}! Your care plan dashboard has been successfully provisioned through our Cisco Duo SSO federation portal. Your assigned physician is ${randomDoctorName} (ID: ${randomDoctorId}), and your ward nurse is ${randomNurseName} (ID: ${randomNurseId}). Please check your vitals log or active prescriptions!`,
                timestamp: new Date().toISOString()
              });
            } else {
              // Sync basics
              pRecord.name = u.realName;
              pRecord.email = u.email || pRecord.email;
              pRecord.ssn = u.ssn;
              pRecord.insurance_id = u.insurance_id;
              pRecord.clinical_notes = u.clinical_notes;
            }
          } else if (u.role === "nurse") {
            // Seed ICU Ward descriptors & clinical credentials
            u.assigned_ward = u.assigned_ward || "Mental Health Residence - Ward B";
            u.internal_notes = u.internal_notes || `Credentialed clinical nurse added dynamically. Full bedside clearance active. Assigned to [${u.assigned_ward}]. Primary nursing focus is diagnostic checks and medication adherence. Authorized on standalone node instance.`;
            u.phone = u.phone || "555-0311";
            u.address = u.address || "170 West Tasman Dr, San Jose, CA 95134";
            await ensureDuoClinicianPatientAssignments(u, "nurse");
          } else if (u.role === "doctor") {
            // Seed NPI medical directory ID & Board certified licensing credentials
            u.npi_number = u.npi_number || `${1689701000 + Math.floor(Math.random() * 8999)}`;
            u.internal_notes = u.internal_notes || `Licensed Attending Physician registered dynamically under Cisco Duo IAM security policy. Board certification verified. Operational and clinical posturing checked on Cloud Run container standalone. Fully authorised medical profile.`;
            u.phone = u.phone || "555-0211";
            u.address = u.address || "170 West Tasman Dr, San Jose, CA 95134";
            await ensureDuoClinicianPatientAssignments(u, "doctor");
          } else if (u.role === "admin") {
            // Seed operations superuser details & high levels clearance note
            u.clearance_level = u.clearance_level !== undefined ? u.clearance_level : 3;
            u.internal_notes = u.internal_notes || `Enterprise Administrative Security Superuser clearance verified dynamically via Duo IAM groups mapping. Authorized to perform full EHR audit, database backfilling, ZTNA location-based rule tuning, and AI defense monitoring. Core administrator: ${u.realName}.`;
            u.phone = u.phone || "555-0105";
            u.address = u.address || "170 West Tasman Dr, San Jose, CA 95134";
          }
        };

        if (!user) {
          user = {
            id: identity || fullProfile.sub,
            role: mappedRole,
            realName: fullName,
            email: email,
            phone: fullProfile.phone_number || undefined,
            address: fullProfile.address?.formatted || undefined,
            provider: "duo"
          };
          db_mock.users.push(user);
          await ensureDuoRoleData(user);
          savePersistedDb();
          
          // Log keys for diagnostics in the audit log
          createLog(user.id, user.realName, user.role, "Local Profile Provisioning (Duo SSO)", "Success", 
            `New identity! ID: ${identity}. Groups: [${groupsStr}]. Claims: ${JSON.stringify(claims)} | UserInfo: ${JSON.stringify(userinfo)}`, req);
        } else {
          // Sync role and profile from Duo on every login
          
          // Identity migration: if the user exists with a legacy prefix, update it to the clean identity
          const cleanId = identity || fullProfile.sub;
          if (user.id.startsWith("duo_") && cleanId && user.id !== cleanId) {
             console.log(`[Auth] Migrating user ID from [${user.id}] to [${cleanId}]`);
             user.id = cleanId;
          }

          const oldRole = user.role;
          user.role = mappedRole;
          user.realName = fullName;
          user.email = email || user.email;
          if (fullProfile.phone_number) user.phone = fullProfile.phone_number;
          if (fullProfile.address?.formatted) user.address = fullProfile.address.formatted;

          await ensureDuoRoleData(user);
          savePersistedDb();

          createLog(user.id, user.realName, user.role, "SSO Login Success (Cisco Duo)", "Success", 
            `Authenticated as: ${identity}. Groups: [${groupsStr}]. Role: ${mappedRole}. Details: Claims: ${JSON.stringify(claims)} | UserInfo: ${JSON.stringify(userinfo)}`, req);
        }

        res.send(`
          <html>
            <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #00172D; color: white;">
              <div style="text-align: center;">
                <h2 style="color: #00BCEB;">Authentication Successful</h2>
                <p>Syncing Vital Trust session...</p>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({ 
                      type: 'OAUTH_AUTH_SUCCESS', 
                      user: ${JSON.stringify(user)} 
                    }, '*');
                    setTimeout(() => window.close(), 500);
                  } else { window.location.href = '/'; }
                </script>
              </div>
            </body>
          </html>
        `);
      } catch (err) {
        console.error("[Auth] Duo Callback Failed:", err);
        res.status(401).send(`
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: red;">Security Verification Failed</h2>
            <p>${err}</p>
            <button onclick="window.close()">Close</button>
          </div>
        `);
      }
    };

    app.get("/api/auth/callback", handleCallback);
    app.post("/api/auth/callback", handleCallback);
    app.get("/auth/callback", (req, res) => res.redirect("/api/auth/callback"));

    app.get("/api/auth/config", (req, res) => {
      res.json({ defaultPasswordConfigured: isDefaultPasswordConfigured() });
    });

    app.post("/api/auth/bootstrap-default-password", (req, res) => {
      if (isDefaultPasswordConfigured()) {
        return res.status(409).json({ error: "Default credentials are already configured." });
      }

      const password = String(req.body?.password || "");
      const policy = validateDefaultPasswordPolicy(password);
      if (!policy.ok) {
        return res.status(400).json({ error: policy.message });
      }

      try {
        const hash = hashPassword(password);
        persistBootstrapPasswordHash(hash);

        let updatedUsers = 0;
        db_mock.users.forEach((user: any) => {
          if (user.provider === "duo" && !user.password) return;
          user.password = hash;
          updatedUsers++;
        });
        savePersistedDb();

        createLog(
          "system",
          "Bootstrap Service",
          "admin",
          "Default Credentials Created",
          "Success",
          `Initial local user store password configured for ${updatedUsers} user(s). Login with username admin.`,
          req
        );

        res.json({ success: true, message: "Default credentials created. Sign in with username admin and your new password." });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Failed to save default credentials." });
      }
    });

    app.post("/api/auth/login", (req, res) => {
      if (!isDefaultPasswordConfigured()) {
        return res.status(503).json({
          error: "Default password not configured. Set DEFAULT_PASSWORD_SHA256 in .env and restart the server.",
        });
      }

      const { username, email, password } = req.body;
      const loginId = (username || email || "").toString().trim();
      
      console.log(`[Auth] Manual login attempt for ID: "${loginId}"`);
      
      const user = db_mock.users.find((u: any) => 
        (u.id === loginId || u.email?.toLowerCase() === loginId.toLowerCase())
      );

      if (!user) {
        console.warn(`[Auth] Login failed: User "${loginId}" not found in directory.`);
        createLog("unknown", loginId, "unknown", "Manual Login Attempt", "Failure", `Identity "${loginId}" not found in local directory.`, req);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // If user is a Duo user (from previous SSO) and has no password
      if (user.provider === "duo" && !user.password) {
        console.warn(`[Auth] Login blocked: User "${loginId}" is managed by Duo SSO. Use SSO button.`);
        createLog(user.id, user.realName, user.role, "Manual Login Attempt", "Failure", `Login blocked: Identity is managed via Cisco Duo SSO. Corrective Action: User must use SSO flow.`, req);
        return res.status(401).json({ 
          error: "This account is managed by Cisco Duo SSO. Please use the SSO login button." 
        });
      }

      if (verifyPassword(password, user.password)) {
        if (!isSha256PasswordHash(user.password)) {
          user.password = hashPassword(password);
          savePersistedDb();
        }
        console.log(`[Auth] Manual login successful for: ${user.id} (${user.role})`);
        createLog(user.id, user.realName, user.role, "Manual Login Success", "Success", "User authenticated via local directory.", req);
        const { password: _, ...userSafe } = user;
        res.json({ success: true, user: userSafe });
      } else {
        console.warn(`[Auth] Login failed: Password mismatch for user "${loginId}".`);
        createLog(user.id, user.realName, user.role, "Manual Login Attempt", "Failure", "Password mismatch for local identity.", req);
        res.status(401).json({ error: "Invalid credentials" });
      }
    });
 
    app.put("/api/auth/profile", (req, res) => {
      const { 
        id, 
        realName, 
        email, 
        phone, 
        address,
        npi_number,
        assigned_ward,
        clearance_level,
        internal_notes,
        ssn,
        insurance_id,
        clinical_notes
      } = req.body;
      const idx = db_mock.users.findIndex((u: any) => u.id === id);
      if (idx !== -1) {
        if (realName !== undefined) db_mock.users[idx].realName = realName;
        if (email !== undefined) db_mock.users[idx].email = email;
        if (phone !== undefined) db_mock.users[idx].phone = phone;
        if (address !== undefined) db_mock.users[idx].address = address;
        if (npi_number !== undefined) db_mock.users[idx].npi_number = npi_number;
        if (assigned_ward !== undefined) db_mock.users[idx].assigned_ward = assigned_ward;
        if (clearance_level !== undefined) {
          db_mock.users[idx].clearance_level = clearance_level !== "" ? Number(clearance_level) : undefined;
        }
        if (internal_notes !== undefined) db_mock.users[idx].internal_notes = internal_notes;
        if (ssn !== undefined) db_mock.users[idx].ssn = ssn;
        if (insurance_id !== undefined) db_mock.users[idx].insurance_id = insurance_id;
        if (clinical_notes !== undefined) db_mock.users[idx].clinical_notes = clinical_notes;
        
        // Keep Corresponding Clinical Patient Record Sync'd if user is a Patient
        const patientIdx = db_mock.patients.findIndex((p: any) => p.id === id);
        if (patientIdx !== -1) {
          if (realName !== undefined) db_mock.patients[patientIdx].name = realName;
          if (email !== undefined) db_mock.patients[patientIdx].email = email;
          if (phone !== undefined) db_mock.patients[patientIdx].phone = phone;
          if (address !== undefined) db_mock.patients[patientIdx].address = address;
          if (ssn !== undefined) db_mock.patients[patientIdx].ssn = ssn;
          if (insurance_id !== undefined) db_mock.patients[patientIdx].insurance_id = insurance_id;
          if (clinical_notes !== undefined) db_mock.patients[patientIdx].clinical_notes = clinical_notes;
        }
        
        savePersistedDb();
        createLog(id, realName, db_mock.users[idx].role, "User Directory Update", "Success", `User realName, phone, or clinical/notes parameters modified on node: ${APP_ROLE}`, req);
        const { password: _, ...userSafe } = db_mock.users[idx];
        res.json({ success: true, user: userSafe });
      } else res.status(404).json({ error: "User not found" });
    });

    app.post("/api/auth/change-password", (req, res) => {
      const { userId, oldPassword, newPassword } = req.body;
      const user = db_mock.users.find((u: any) => u.id === userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (!verifyPassword(oldPassword, user.password)) {
        return res.status(401).json({ error: "Incorrect current password" });
      }
      user.password = hashPassword(newPassword);
      savePersistedDb();
      createLog(userId, user.realName, user.role, "Password Change", "Success", "User password updated (SHA-256).", req);
      res.json({ success: true });
    });
  }

  // --- PROXY LOGIC (distributed nodes forward to peer services; no local fallback) ---
  const handleDbRequestProxy = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (APP_ROLE === "dbserver" || IS_STANDALONE) {
      return next();
    }

    const rawDbUrl = liveConfig.dbserver_url || process.env.DB_SERVER_URL;
    if (!rawDbUrl) {
      console.error(`[DB PROXY ERROR] Database server URL is not configured on node role "${APP_ROLE}".`);
      return res.status(503).json({
        error: "Database server URL is not configured for this distributed node.",
        target: "dbserver"
      });
    }

    let DB_SERVER_URL = normalizeAndSecureUrl(rawDbUrl);
    if (!DB_SERVER_URL.match(/:\d+/) && !DB_SERVER_URL.includes("run.app") && !DB_SERVER_URL.includes("aistudio")) {
      DB_SERVER_URL = `${DB_SERVER_URL}:3000`;
    }

    if (isSelfUrl(DB_SERVER_URL, req.headers.host || "")) {
      console.error(`[DB PROXY ERROR] Database server URL points to this node (${DB_SERVER_URL}). Refusing local fallback in distributed mode.`);
      return res.status(503).json({
        error: "Database server URL is configured to point at this node. Configure a remote dbserver URL for distributed deployments.",
        target: "dbserver"
      });
    }

    const targetUrl = `${DB_SERVER_URL}${req.originalUrl}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (req.headers.cookie) headers["Cookie"] = req.headers.cookie.toString();
      if (req.headers.authorization) headers["Authorization"] = req.headers.authorization.toString();

      const fetchOptions: any = {
        method: req.method,
        headers,
        signal: controller.signal
      };

      if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
        fetchOptions.body = typeof req.body === "object" ? JSON.stringify(req.body) : req.body;
      }

      const remoteRes = await fetch(targetUrl, fetchOptions);
      clearTimeout(timeoutId);

      res.status(remoteRes.status);
      const contentType = remoteRes.headers.get("content-type");
      if (contentType) res.setHeader("content-type", contentType);

      if (contentType && contentType.includes("application/json")) {
        const jsonVal = await remoteRes.json();
        return res.json(jsonVal);
      } else {
        const textVal = await remoteRes.text();
        return res.send(textVal);
      }
    } catch (err: any) {
      console.error(`[DB PROXY ERROR] Database Server at [${targetUrl}] unreachable: ${err.message}`);
      return res.status(502).json({
        error: `Database server unreachable: ${err.message}`,
        target: "dbserver"
      });
    }
  };

  const handleAiRequestProxy = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (APP_ROLE === "aibroker" || IS_STANDALONE) {
      return next();
    }

    const rawAiUrl = liveConfig.aibroker_url || process.env.AI_BROKER_URL;
    if (!rawAiUrl) {
      console.error(`[AI PROXY ERROR] AI broker URL is not configured on node role "${APP_ROLE}".`);
      return res.status(503).json({
        error: "AI broker URL is not configured for this distributed node.",
        target: "aibroker"
      });
    }

    let AI_BROKER_URL = normalizeAndSecureUrl(rawAiUrl);
    if (!AI_BROKER_URL.match(/:\d+/) && !AI_BROKER_URL.includes("run.app") && !AI_BROKER_URL.includes("aistudio")) {
      AI_BROKER_URL = `${AI_BROKER_URL}:3000`;
    }

    if (isSelfUrl(AI_BROKER_URL, req.headers.host || "")) {
      console.error(`[AI PROXY ERROR] AI broker URL points to this node (${AI_BROKER_URL}). Refusing local fallback in distributed mode.`);
      return res.status(503).json({
        error: "AI broker URL is configured to point at this node. Configure a remote aibroker URL for distributed deployments.",
        target: "aibroker"
      });
    }

    const targetUrl = `${AI_BROKER_URL}${req.originalUrl}`;
    console.log(`[ZTNA PROXY] [START] Forwarding request to AI Broker at: ${targetUrl}. Method: ${req.method}. Max Timeout set to 90 seconds.`);
    try {
      const controller = new AbortController();
      // Since AI operations (chat generation, MCP tool executes) can take a significant amount of time, we set a 90-second timeout to prevent premature aborts.
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (req.headers.cookie) headers["Cookie"] = req.headers.cookie.toString();
      if (req.headers.authorization) headers["Authorization"] = req.headers.authorization.toString();

      const fetchOptions: any = {
        method: req.method,
        headers,
        signal: controller.signal
      };

      if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
        fetchOptions.body = typeof req.body === "object" ? JSON.stringify(req.body) : req.body;
      }

      const remoteRes = await fetch(targetUrl, fetchOptions);
      clearTimeout(timeoutId);

      res.status(remoteRes.status);
      const contentType = remoteRes.headers.get("content-type");
      if (contentType) res.setHeader("content-type", contentType);

      console.log(`[ZTNA PROXY] [SUCCESS] Received response from AI Broker at [${targetUrl}]. Status: ${remoteRes.status}, Content-Type: ${contentType}`);

      if (contentType && contentType.includes("application/json")) {
        const jsonVal = await remoteRes.json();
        return res.json(jsonVal);
      } else {
        const textVal = await remoteRes.text();
        return res.send(textVal);
      }
    } catch (err: any) {
      const isTimeout = err.name === "AbortError" || err.message?.includes("aborted");
      console.error(`[AI PROXY ERROR] AI Broker at [${targetUrl}] unreachable. Error: ${isTimeout ? "TIMEOUT after 90 seconds" : err.message}`);
      return res.status(502).json({
        error: `AI broker unreachable: ${isTimeout ? "Request timed out after 90 seconds" : err.message}`,
        target: "aibroker"
      });
    }
  };

  // Proxy routes registered unconditionally (they internally inspect dynamic IS_STANDALONE/role flags)
  app.use("/api/dbserver", handleDbRequestProxy);
  app.use(["/api/aibroker", "/api/ai"], handleAiRequestProxy);

  // --- DATA ROUTES (dbserver and standalone only) ---
  const dbRouter = express.Router();

    dbRouter.get("/patients", (req, res) => res.json(db_mock.patients));
    dbRouter.get("/patients/:id", (req, res) => {
      const patient = db_mock.patients.find((p: any) => p.id === req.params.id);
      if (patient) res.json(patient);
      else res.status(404).json({ error: "Patient not found" });
    });
    dbRouter.get("/doctors", (req, res) => res.json(db_mock.doctors));
    dbRouter.get("/nurses", (req, res) => res.json(db_mock.nurses));
    dbRouter.get("/appointments", (req, res) => {
      const { patientId, doctorId, nurseId, requesterId, requesterRole } = req.query as Record<string, string | undefined>;
      let results = db_mock.appointments;
      if (requesterRole === "patient" && requesterId) {
        results = results.filter((a: any) => a.patientId === requesterId);
      } else if (patientId) {
        results = results.filter((a: any) => a.patientId === patientId);
      }
      if (doctorId) {
        results = results.filter((a: any) => a.doctorId === doctorId);
      }
      if (nurseId) {
        results = results.filter((a: any) => a.nurseId === nurseId);
      }
      res.json(results);
    });
    dbRouter.post("/appointments", (req, res) => {
      const { patientId, doctorId, nurseId, date, time, reason, status, requesterId, requesterRole } = req.body;
      const resolvedPatientId = patientId || (requesterRole === "patient" ? requesterId : "unknown_patient");
      const patientNum = parseInt(String(resolvedPatientId).replace("patient", ""), 10);
      const careTeam = Number.isFinite(patientNum) ? careTeamForPatientIndex(patientNum) : { doctorId: doctorId || "doctor1", nurseId: nurseId || "nurse1" };
      const newApt = {
        id: `apt${Date.now()}`,
        patientId: resolvedPatientId,
        doctorId: doctorId || careTeam.doctorId,
        nurseId: nurseId || careTeam.nurseId,
        date: date || new Date().toISOString().split('T')[0],
        time: time || "09:00 AM",
        reason: reason || "Routine checkup",
        status: status || "pending"
      };
      db_mock.appointments.push(newApt);
      savePersistedDb();
      createLog("system", "Data Service", "system", "Appointment Scheduled", "Success", `New appointment scheduled via API: ${newApt.id} for patient ${newApt.patientId}`, req);
      res.status(201).json(newApt);
    });
    dbRouter.put("/appointments/:id", (req, res) => {
      const { date, time, reason, status, doctorId, nurseId, requesterId, requesterRole } = req.body;
      const aptIdx = db_mock.appointments.findIndex((a: any) => a.id === req.params.id);
      if (aptIdx === -1) return res.status(404).json({ error: "Appointment not found" });
      const existing = db_mock.appointments[aptIdx];
      if (requesterRole === "patient" && requesterId && existing.patientId !== requesterId) {
        return res.status(403).json({ error: "Patients may only modify their own appointments" });
      }
      if (requesterRole === "doctor" && requesterId && existing.doctorId !== requesterId) {
        return res.status(403).json({ error: "Doctors may only modify appointments they are assigned to" });
      }
      if (requesterRole === "nurse" && requesterId && existing.nurseId !== requesterId) {
        return res.status(403).json({ error: "Nurses may only modify appointments they are assigned to" });
      }
      db_mock.appointments[aptIdx] = {
        ...existing,
        ...(date !== undefined && { date }),
        ...(time !== undefined && { time }),
        ...(reason !== undefined && { reason }),
        ...(status !== undefined && { status }),
        ...(doctorId !== undefined && { doctorId }),
        ...(nurseId !== undefined && { nurseId }),
      };
      savePersistedDb();
      createLog("system", "Data Service", "system", "Appointment Update", "Success", `Appointment ${req.params.id} updated. New Status: ${status}`, req);
      res.json(db_mock.appointments[aptIdx]);
    });
    dbRouter.delete("/appointments/:id", (req, res) => {
      const { requesterId, requesterRole } = req.query as Record<string, string | undefined>;
      const aptIdx = db_mock.appointments.findIndex((a: any) => a.id === req.params.id);
      if (aptIdx === -1) return res.status(404).json({ error: "Appointment not found" });
      const existing = db_mock.appointments[aptIdx];
      if (requesterRole === "patient" && requesterId && existing.patientId !== requesterId) {
        return res.status(403).json({ error: "Patients may only delete their own appointments" });
      }
      if (requesterRole === "doctor" && requesterId && existing.doctorId !== requesterId) {
        return res.status(403).json({ error: "Doctors may only delete appointments they are assigned to" });
      }
      if (requesterRole === "nurse" && requesterId && existing.nurseId !== requesterId) {
        return res.status(403).json({ error: "Nurses may only delete appointments they are assigned to" });
      }
      db_mock.appointments.splice(aptIdx, 1);
      savePersistedDb();
      createLog("system", "Data Service", "system", "Appointment Cancellation", "Warning", `Appointment ${req.params.id} purged from records.`, req);
      res.status(204).send();
    });
    dbRouter.get("/billing", (req, res) => {
      const { patientId, doctorId, nurseId } = req.query as Record<string, string | undefined>;
      let results = db_mock.billing;
      if (patientId) results = results.filter((b: any) => b.patientId === patientId);
      if (doctorId) results = results.filter((b: any) => b.doctorId === doctorId);
      if (nurseId) results = results.filter((b: any) => b.nurseId === nurseId);
      res.json(results);
    });
    dbRouter.put("/billing/:id", (req, res) => {
      const { status } = req.body;
      const idx = db_mock.billing.findIndex((b: any) => b.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: "Billing record not found" });
      if (status !== undefined) db_mock.billing[idx].status = status;
      savePersistedDb();
      createLog("billing", "Billing Service", "patient", "Billing Update", "Success", `Billing ${req.params.id} status updated to: ${status}`, req);
      res.json({ success: true, billing: db_mock.billing[idx] });
    });
    dbRouter.get("/medications", (req, res) => {
      const { patientId } = req.query;
      res.json(patientId ? db_mock.medications_detailed.filter((m: any) => m.patientId === patientId) : db_mock.medications_detailed);
    });
    dbRouter.put("/medications/:id", (req, res) => {
      const { status } = req.body;
      const idx = db_mock.medications_detailed.findIndex((m: any) => m.id === req.params.id);
      if (idx !== -1) {
        db_mock.medications_detailed[idx].status = status;
        if (status === 'administered') {
          db_mock.medications_detailed[idx].administeredAt = new Date().toISOString();
        }
        createLog("clinical", "Clinical Service", "staff", "Medication Transaction", "Success", `Medication ${req.params.id} status changed to: ${status}`, req);
        res.json(db_mock.medications_detailed[idx]);
      } else res.status(404).json({ error: "Medication not found" });
    });
    dbRouter.post("/medications", (req, res) => {
      const med = {
        id: `med${Date.now()}`,
        ...req.body,
        status: "pending",
        startDate: new Date().toISOString().split("T")[0]
      };
      db_mock.medications_detailed.push(med);
      savePersistedDb();
      createLog("clinical", "Clinical Service", "staff", "Medication Prescribed", "Success", `New medication prescribed: ${med.name} for patient ${med.patientId}`, req);
      res.status(201).json(med);
    });
    dbRouter.delete("/medications/:id", (req, res) => {
      const idx = db_mock.medications_detailed.findIndex((m: any) => m.id === req.params.id);
      if (idx !== -1) {
        const deletedMed = db_mock.medications_detailed[idx];
        db_mock.medications_detailed.splice(idx, 1);
        savePersistedDb();
        createLog("clinical", "Clinical Service", "staff", "Medication Revocation", "Warning", `Medication ${deletedMed.id} (${deletedMed.name || ''}) removed for patient ${deletedMed.patientId}`, req);
        res.status(204).send();
      } else res.status(404).json({ error: "Medication not found" });
    });
    dbRouter.put("/medications/:id/details", (req, res) => {
      const idx = db_mock.medications_detailed.findIndex((m: any) => m.id === req.params.id);
      if (idx !== -1) {
        db_mock.medications_detailed[idx] = { ...db_mock.medications_detailed[idx], ...req.body };
        savePersistedDb();
        createLog("clinical", "Clinical Service", "staff", "Medication Detail Update", "Info", `Medication record ${req.params.id} modified.`, req);
        res.json(db_mock.medications_detailed[idx]);
      } else res.status(404).json({ error: "Medication not found" });
    });
    dbRouter.put("/patients/:id/status", (req, res) => {
      const { status } = req.body;
      const patient = db_mock.patients.find((p: any) => p.id === req.params.id);
      if (patient) {
        patient.status = status;
        savePersistedDb();
        createLog("clinical", "Clinical Service", "staff", "Patient Status Change", "Info", `Patient ${req.params.id} status updated to: ${status}`, req);
        res.json({ success: true, patient });
      } else res.status(404).json({ error: "Patient not found" });
    });
    dbRouter.put("/patients/:id/vitals", (req, res) => {
      const { hr, temp, bp } = req.body;
      const patient = db_mock.patients.find((p: any) => p.id === req.params.id);
      if (patient) {
        patient.vitals = { hr, temp, bp, lastUpdated: new Date().toISOString().split('T')[0] };
        savePersistedDb();
        createLog("clinical", "Clinical Service", "nurse", "Vitals Recorded", "Success", `Vitals for patient ${req.params.id}: HR=${hr}, BP=${bp}, T=${temp}`, req);
        res.json({ success: true, patient });
      } else res.status(404).json({ error: "Patient not found" });
    });
    dbRouter.get("/lab-results", (req, res) => {
      const { patientId } = req.query;
      res.json(patientId ? db_mock.lab_results.filter((l: any) => l.patientId === patientId) : db_mock.lab_results);
    });
    dbRouter.get("/messages", (req, res) => {
      const { userId } = req.query;
      res.json(db_mock.messages.filter((m: any) => m.senderId === userId || m.receiverId === userId));
    });
    dbRouter.post("/messages", (req, res) => {
      const { senderId, receiverId, content } = req.body;
      if (!senderId || !receiverId || !content) {
        return res.status(400).json({ error: "senderId, receiverId, and content are required" });
      }
      const sender = db_mock.users.find((u: any) => u.id === senderId);
      const receiver = db_mock.users.find((u: any) => u.id === receiverId);
      if (!sender || !receiver) {
        return res.status(400).json({ error: "Invalid sender or receiver" });
      }
      if (!canSendMessage(sender.role, receiver.role)) {
        return res.status(403).json({ error: "Messaging policy violation: patient-to-patient messaging is not permitted" });
      }
      const newMsg = {
        id: `msg${Date.now()}`,
        senderId,
        receiverId,
        content,
        timestamp: new Date().toISOString()
      };
      db_mock.messages.push(newMsg);
      savePersistedDb();
      createLog(senderId, "Messaging Service", "user", "Secure Message Sent", "Success", `Message sent to ${receiverId}`, req);
      res.status(201).json({ success: true, message: newMsg });
    });
    dbRouter.post("/messages/broadcast", (req, res) => {
      const { senderId, receiverRole, content } = req.body;
      if (!senderId || !receiverRole || !content) {
        return res.status(400).json({ error: "senderId, receiverRole, and content are required" });
      }
      const role = String(receiverRole).toLowerCase().trim();
      const validRoles = ["patient", "nurse", "doctor", "admin"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "receiverRole must be patient, nurse, doctor, or admin" });
      }
      const sender = db_mock.users.find((u: any) => u.id === senderId);
      if (!sender) {
        return res.status(400).json({ error: "Invalid sender" });
      }
      if (sender.role === "patient" && role === "patient") {
        return res.status(403).json({ error: "Messaging policy violation: patients cannot broadcast to other patients" });
      }
      const recipients = db_mock.users.filter(
        (u: any) => u.role === role && u.id !== senderId && canSendMessage(sender.role, u.role)
      );
      if (recipients.length === 0) {
        return res.status(400).json({ error: `No eligible recipients found for role: ${role}` });
      }
      const now = Date.now();
      const created = recipients.map((receiver: any, index: number) => ({
        id: `msg${now}_${index}`,
        senderId,
        receiverId: receiver.id,
        content,
        timestamp: new Date().toISOString(),
      }));
      db_mock.messages.push(...created);
      savePersistedDb();
      createLog(
        senderId,
        sender.realName || "Messaging Service",
        sender.role,
        "Secure Broadcast Message Sent",
        "Success",
        `Broadcast to ${recipients.length} ${role}(s): ${content.substring(0, 80)}`,
        req
      );
      res.status(201).json({
        success: true,
        sent: created.length,
        receiverRole: role,
        recipientIds: recipients.map((r: any) => r.id),
        recipientNames: recipients.map((r: any) => r.realName),
      });
    });
    dbRouter.delete("/messages", (req, res) => {
      const { ids, userId } = req.body;
      if (!Array.isArray(ids) || ids.length === 0 || !userId) {
        return res.status(400).json({ error: "ids (array) and userId are required" });
      }
      const idSet = new Set(ids);
      const before = db_mock.messages.length;
      db_mock.messages = db_mock.messages.filter(
        (m: any) => !(idSet.has(m.id) && (m.senderId === userId || m.receiverId === userId))
      );
      const removed = before - db_mock.messages.length;
      if (removed === 0) {
        return res.status(404).json({ error: "No matching messages found for deletion" });
      }
      savePersistedDb();
      createLog(userId, "Messaging Service", "user", "Secure Messages Deleted", "Warning", `Deleted ${removed} message(s)`, req);
      res.json({ success: true, deleted: removed });
    });
    dbRouter.get("/users/directory", (_req, res) => {
      res.json(db_mock.users.map((u: any) => ({ id: u.id, role: u.role, realName: u.realName })));
    });

    // Admin Specific Data Routes
    dbRouter.get("/admin/users/:id", (req, res) => {
      const user = db_mock.users.find((u: any) => u.id === req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    });
    dbRouter.get("/admin/users", (req, res) => {
      res.json(db_mock.users.map((u: any) => {
        const { password, ...safeUser } = u;
        return safeUser;
      }));
    });

    dbRouter.get("/admin/logs", (req, res) => {
      res.json(db_mock.logs || []);
    });
    dbRouter.post("/admin/logs-external", (req, res) => {
      const extLog = req.body;
      if (extLog && typeof extLog === "object") {
        db_mock.logs.unshift(extLog);
        if (db_mock.logs.length > 500) db_mock.logs.pop();
        savePersistedDb();
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "Invalid log payload" });
      }
    });
    dbRouter.post("/admin/users", (req, res) => {
      const defaultHash = getDefaultPasswordSha256();
      const newUser = {
        ...req.body,
        id: req.body.id || `user${Date.now()}`,
        password: req.body.password
          ? hashPassword(req.body.password)
          : (defaultHash || ""),
      };
      
      if (newUser.role === 'patient') {
        const patientExists = db_mock.patients.some((p: any) => p.id === newUser.id);
        if (!patientExists) {
          const conditions = ["Hypertension", "Diabetes", "Allergies", "Asthma", "Hyperthyroidism", "Healthy"];
          const chosenCondition = newUser.condition || conditions[Math.floor(Math.random() * conditions.length)];
          const pRecord = {
            id: newUser.id,
            name: newUser.realName,
            dob: newUser.dob || "1988-06-15",
            ssn: newUser.ssn || "999-55-1234",
            insurance_id: newUser.insurance_id || "INS-9912",
            phone: newUser.phone || "555-0104",
            address: newUser.address || "170 West Tasman Dr, San Jose, CA 95134",
            email: newUser.email || `${newUser.id}@example.com`,
            condition: chosenCondition,
            medications: newUser.medications || ["Vitamin C 500mg"],
            lastVisit: new Date().toISOString().split("T")[0],
            status: newUser.status || "active",
            assignedDoctorId: newUser.assignedDoctorId || "doctor1",
            assignedNurseId: newUser.assignedNurseId || "nurse1",
            clinical_notes: newUser.clinical_notes || "Initial check-in clinical notes recorded.",
            vitals: { hr: "72", temp: "98.6", bp: "120/80", lastUpdated: new Date().toISOString().split('T')[0] }
          };
          db_mock.patients.push(pRecord);
        }
      }

      db_mock.users.push(newUser);
      savePersistedDb();
      createLog("admin", "Admin System", "admin", "User Provisioning", "Success", `New profile provisioned in directory: ${newUser.id} (${newUser.realName || newUser.id})`, req);
      res.status(201).json(newUser);
    });
    dbRouter.put("/admin/users/:id", (req, res) => {
      const idx = db_mock.users.findIndex((u: any) => u.id === req.params.id);
      if (idx !== -1) {
        db_mock.users[idx] = { ...db_mock.users[idx], ...req.body };
        const updatedUser = db_mock.users[idx];

        // ALSO keep corresponding clinical patient record synchronized
        const patientIdx = db_mock.patients.findIndex((p: any) => p.id === req.params.id);
        if (patientIdx !== -1) {
          if (updatedUser.realName !== undefined) db_mock.patients[patientIdx].name = updatedUser.realName;
          if (updatedUser.email !== undefined) db_mock.patients[patientIdx].email = updatedUser.email;
          if (updatedUser.phone !== undefined) db_mock.patients[patientIdx].phone = updatedUser.phone;
          if (updatedUser.address !== undefined) db_mock.patients[patientIdx].address = updatedUser.address;
          if (updatedUser.ssn !== undefined) db_mock.patients[patientIdx].ssn = updatedUser.ssn;
          if (updatedUser.insurance_id !== undefined) db_mock.patients[patientIdx].insurance_id = updatedUser.insurance_id;
          if (updatedUser.clinical_notes !== undefined) db_mock.patients[patientIdx].clinical_notes = updatedUser.clinical_notes;
          if (updatedUser.status !== undefined) db_mock.patients[patientIdx].status = updatedUser.status;
        }

        savePersistedDb();
        createLog("admin", "Admin System", "admin", "User Profile Modification", "Success", `Directory profile modified: ${updatedUser.id} (${updatedUser.realName || updatedUser.id})`, req);
        res.json(db_mock.users[idx]);
      } else res.status(404).json({ error: "User not found" });
    });
    dbRouter.delete("/admin/users/:id", (req, res) => {
      const targetId = req.params.id;
      console.log(`[ADMIN] Received delete request for user ID: ${targetId}`);
      
      const idx = db_mock.users.findIndex((u: any) => u.id === targetId);
      if (idx !== -1) {
        const userToDelete = db_mock.users[idx];
        if (userToDelete.role === 'admin') {
          const adminCount = db_mock.users.filter((u: any) => u.role === 'admin').length;
          if (adminCount <= 1) {
            console.warn(`[ADMIN] Delete blocked: User ${targetId} is the last administrator.`);
            return res.status(403).json({ error: "Safety Interlock: Cannot delete the final administrator account." });
          }
        }
        db_mock.users.splice(idx, 1);
        savePersistedDb();
        console.log(`[ADMIN] Successfully purged user: ${targetId}`);
        createLog("admin", "Admin System", "admin", "User Deprovisioning", "Success", `User purged from directory: ${targetId}`, req);
        res.status(204).send();
      } else {
        console.error(`[ADMIN] Delete failed: Identity ${targetId} not found in directory.`);
        res.status(404).json({ error: "Identity not found in directory." });
      }
    });

    dbRouter.post("/admin/assign-care-team", (req, res) => {
      const { patientId, doctorId, nurseId } = req.body;
      const patient = db_mock.patients.find((p: any) => p.id === patientId);
      if (patient) {
        if (doctorId) patient.assignedDoctorId = doctorId;
        if (nurseId) patient.assignedNurseId = nurseId;
        savePersistedDb();
        createLog("admin", "Admin Service", "admin", "Care Team Assignment", "Success", `Patient ${patientId} assigned to Doctor: ${doctorId}, Nurse: ${nurseId}`, req);
        res.json({ success: true, patient });
      } else res.status(404).json({ error: "Patient not found" });
    });

    dbRouter.delete("/admin/assign-doctor/:patientId", (req, res) => {
      const patient = db_mock.patients.find((p: any) => p.id === req.params.patientId);
      if (patient) {
        patient.assignedDoctorId = undefined;
        patient.assignedNurseId = undefined;
        res.json({ success: true, patient });
      } else res.status(404).json({ error: "Patient not found" });
    });

    dbRouter.post("/admin/factory-reset", (req, res) => {
      const defaultHash = getDefaultPasswordSha256();
      if (!defaultHash) {
        return res.status(503).json({
          error: "DEFAULT_PASSWORD_SHA256 is not configured in .env. Factory reset requires a default password hash.",
        });
      }
      console.log("[ADMIN] Factory reset initiated");
      createLog("admin", "Admin System", "admin", "Database Factory Reset", "Warning", "System reset to initial baseline configuration.", req);
      Object.keys(db_mock).forEach(key => delete db_mock[key]);
      Object.assign(db_mock, JSON.parse(JSON.stringify(createInitialDb(defaultHash))));
      savePersistedDb();
      res.json({ success: true, message: "Database reset to initial state" });
    });

  if (APP_ROLE === "dbserver" || IS_STANDALONE) {
    app.use("/api/dbserver", dbRouter);
  }

  // --- AI LOGIC (aibroker or standalone) ---
  if (APP_ROLE === "aibroker" || IS_STANDALONE) {
    const handleAIBrokerChat = (req: express.Request, res: express.Response) => {
      const { message } = req.body;
      res.json({ response: `[Secure Cisco AI Defense Inline Processed] Input accepted: ${message}`, status: "Safe" });
    };

    app.post("/api/aibroker/mcp/chat", handleAIBrokerChat);

    // Provide the config checker endpoint
    app.get("/api/ai/config", (req, res) => {
      const geminiAvailable = !!process.env.GEMINI_API_KEY;
      const openaiAvailable = !!process.env.OPENAI_API_KEY;
      const claudeAvailable = !!process.env.CLAUDE_API_KEY;
      const awsRegionAvailable = !!process.env.AWS_REGION;
      const awsAccessKeyAvailable = !!process.env.AWS_ACCESS_KEY;
      const awsSecretKeyAvailable = !!process.env.AWS_SECRET_KEY;
      const awsBedrockAvailable = awsRegionAvailable && awsAccessKeyAvailable && awsSecretKeyAvailable;
      let activeProvider = "local";
      if (geminiAvailable && openaiAvailable) {
        activeProvider = "both";
      } else if (geminiAvailable) {
        activeProvider = "gemini";
      } else if (openaiAvailable) {
        activeProvider = "openai";
      }
      res.json({
        geminiAvailable,
        openaiAvailable,
        claudeAvailable,
        awsBedrockAvailable,
        awsRegion: awsRegionAvailable ? process.env.AWS_REGION : undefined,
        activeProvider,
        bootInstanceId: BOOT_INSTANCE_ID,
        version: VERSION,
      });
    });

    app.get("/api/agents/config", (req, res) => {
      res.json(getAgentConfig());
    });

    app.get("/api/agents/activity-log", (req, res) => {
      try {
        const log = loadAgentActivityLog(agentActivityLogPath);
        res.json({ success: true, ...log });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || String(err) });
      }
    });

    app.post("/api/agents/config", (req, res) => {
      try {
        const updated = applyAgentConfigUpdate(agentRuntimeCtx, req.body || {});
        res.json({ success: true, config: updated });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || String(err) });
      }
    });

    // Provide a connectivity test check for Cisco AI Defense Settings
    app.post("/api/ai/test-defense", async (req, res) => {
      const { gatewayUrl, apiKey } = req.body;
      try {
        if (!gatewayUrl) {
          return res.status(400).json({ success: false, message: "Gateway URL is required." });
        }
        
        const activeDefenseApiKey = (apiKey || "").trim() || (process.env.CISCO_AI_DEFENSE_API_KEY || process.env.AI_DEFENSE_API_KEY || "").trim();
        if (!activeDefenseApiKey) {
          return res.status(200).json({ success: false, message: "API Key missing. Please provide it in settings or define CISCO_AI_DEFENSE_API_KEY in your environment." });
        }
        
        let testUrl = gatewayUrl.trim();
        if (!testUrl.startsWith("http://") && !testUrl.startsWith("https://")) {
          testUrl = "https://" + testUrl;
        }
        
        // Target is the Inspect Chat endpoint under Cisco AI Defense
        if (testUrl.endsWith("/")) {
          testUrl = testUrl.slice(0, -1);
        }
        if (!testUrl.includes("/api/v1/inspect/chat")) {
          if (testUrl.endsWith("/v1/chat/completions")) {
            testUrl = testUrl.replace("/v1/chat/completions", "/api/v1/inspect/chat");
          } else {
            testUrl += "/api/v1/inspect/chat";
          }
        }

        console.log(`[AI_DEFENSE_TEST] Verification ping dispatched to: [${testUrl}]`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
          const checkRes = await fetch(testUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Cisco-AI-Defense-API-Key": activeDefenseApiKey,
              "api-key": activeDefenseApiKey,
              "Authorization": `Bearer ${activeDefenseApiKey}`
            },
            body: JSON.stringify({
              messages: [{ role: "user", content: "Say this is a test!" }]
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          console.log(`[AI_DEFENSE_TEST] Cisco AI Defense Gateway responded with status: ${checkRes.status}`);

          if (checkRes.ok || checkRes.status === 200) {
            return res.json({ 
              success: true, 
              message: "Success: Cisco AI Defense API inspect channel authenticated and verified!" 
            });
          } else if (checkRes.status === 401 || checkRes.status === 403) {
            return res.json({ 
              success: false, 
              message: `Failed: Connection Unauthorized (HTTP ${checkRes.status}). Please verify your AI Defense API Key.` 
            });
          } else if (checkRes.status === 404) {
            return res.json({ 
              success: true, 
              // A 404 on the specific inspect url can mean the endpoint exists on the gateway, but is still negotiating setup.
              // To match resilience guidelines we allow saving and note the status.
              message: "Cisco Gateway reached (Tenant Pending Activation). Please run your first chat request to complete enrollment."
            });
          } else {
            return res.json({ 
              success: false, 
              message: `Failed: Cisco Gateway returned status ${checkRes.status}` 
            });
          }
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          return res.json({ 
            success: false, 
            message: `Failed: Cisco AI Defense Gateway is unreachable (${fetchErr.message || 'Network Timeout'})` 
          });
        }
      } catch (err: any) {
        return res.json({ success: false, message: `Failed: ${err.message || err}` });
      }
    });

    // Helper functions for policy violation detection
    const parseAiDefenseViolations = (inspectData: any): string[] => {
      let elements: string[] = [];
      if (!inspectData) return elements;

      // Extract from primary "rules" array returned from Cisco AI Defense (e.g. inspectData.rules)
      const rules = inspectData.rules || inspectData.rule_matches || inspectData.ruleMatches || inspectData.rules_matched || inspectData.matched_rules || [];
      
      if (Array.isArray(rules) && rules.length > 0) {
        rules.forEach((v: any) => {
          if (typeof v === 'string') {
            elements.push(v);
          } else if (v && typeof v === 'object') {
            let violationType = v.classification || v.type || v.category || v.violationType || v.violation_type || "";
            let ruleName = v.rule_name || v.ruleName || v.rule || v.name || "";
            let entities = v.entity_types || v.entityTypes || [];
            
            // Normalize violationType
            v_type_check: {
              let normalType = String(violationType).toUpperCase().trim();
              if (normalType === "NONE_VIOLATION" || normalType === "NONE" || !normalType) {
                if (inspectData.classifications && Array.isArray(inspectData.classifications) && inspectData.classifications.length > 0) {
                  normalType = String(inspectData.classifications[0]).toUpperCase().trim();
                }
              }

              if (normalType.includes("PRIVACY") || normalType.includes("PII") || normalType.includes("PCI") || normalType.includes("PHI")) {
                violationType = "PRIVACY_VIOLATION";
                break v_type_check;
              }
              if (normalType.includes("SECURITY") || normalType.includes("PROMPT") || normalType.includes("INJECTION") || normalType.includes("JAILBREAK") || normalType.includes("SYSTEM") || normalType.includes("MALICIOUS") || normalType.includes("CYBER") || normalType.includes("ATTACK")) {
                violationType = "SECURITY_VIOLATION";
                break v_type_check;
              }
              if (normalType.includes("SAFETY") || normalType.includes("HARASSMENT") || normalType.includes("HATE") || normalType.includes("TOXICITY") || normalType.includes("PROFANITY") || normalType.includes("SEXUAL") || normalType.includes("VIOLENCE")) {
                violationType = "SAFETY_VIOLATION";
                break v_type_check;
              }

              // Fallback based on ruleName patterns
              const ruleNameUpper = String(ruleName).toUpperCase().trim();
              if (ruleNameUpper.includes("PCI") || ruleNameUpper.includes("PII") || ruleNameUpper.includes("PHI") || ruleNameUpper.includes("PRIVACY")) {
                violationType = "PRIVACY_VIOLATION";
              } else if (ruleNameUpper.includes("PROMPT") || ruleNameUpper.includes("MALICIOUS") || ruleNameUpper.includes("CODE") || ruleNameUpper.includes("ATTACK") || ruleNameUpper.includes("SECURITY")) {
                violationType = "SECURITY_VIOLATION";
              } else if (ruleNameUpper.includes("SAFETY") || ruleNameUpper.includes("HARASS") || ruleNameUpper.includes("HATE") || ruleNameUpper.includes("TOXICITY") || ruleNameUpper.includes("VIOLENCE")) {
                violationType = "SAFETY_VIOLATION";
              } else {
                violationType = "PRIVACY_VIOLATION";
              }
            }

            // Clean ruleName if it's there
            ruleName = String(ruleName).trim();

            if (Array.isArray(entities) && entities.length > 0) {
              entities.forEach((entity: any) => {
                const entityStr = String(entity).trim();
                elements.push(`${violationType}: ${ruleName} (${entityStr})`);
              });
            } else {
              if (ruleName) {
                elements.push(`${violationType}: ${ruleName}`);
              }
            }
          }
        });
      }

      // If still empty, look for direct top-level fields
      if (elements.length === 0) {
        if (inspectData.violations && Array.isArray(inspectData.violations)) {
          inspectData.violations.forEach((v: any) => {
            if (typeof v === 'string') {
              elements.push(v);
            } else if (v && typeof v === 'object') {
              const p = v.policy || v.category || "PRIVACY_VIOLATION";
              const e = v.element || v.type || "Sensitive Clinical Data Leak";
              // Normalize Category
              let normalCat = String(p).toUpperCase().trim();
              if (normalCat.includes("PRIVACY")) normalCat = "PRIVACY_VIOLATION";
              else if (normalCat.includes("SECURITY")) normalCat = "SECURITY_VIOLATION";
              else if (normalCat.includes("SAFETY")) normalCat = "SAFETY_VIOLATION";
              elements.push(`${normalCat}: ${e}`);
            }
          });
        }
      }

      if (elements.length === 0) {
        if (inspectData.matched_policies && Array.isArray(inspectData.matched_policies)) {
          inspectData.matched_policies.forEach((p: any) => {
            if (typeof p === 'string') {
              elements.push(p);
            } else if (p && typeof p === 'object') {
              const name = p.name || p.policy || "PRIVACY_VIOLATION";
              const desc = p.description || p.element || "Sensitive Clinical Data Leak";
              let normalCat = String(name).toUpperCase().trim();
              if (normalCat.includes("PRIVACY")) normalCat = "PRIVACY_VIOLATION";
              else if (normalCat.includes("SECURITY")) normalCat = "SECURITY_VIOLATION";
              else if (normalCat.includes("SAFETY")) normalCat = "SAFETY_VIOLATION";
              elements.push(`${normalCat}: ${desc}`);
            }
          });
        }
      }

      if (elements.length === 0 && inspectData.reason) {
        elements.push(`PRIVACY_VIOLATION: ${inspectData.reason}`);
      }

      if (elements.length === 0) {
        elements.push("PRIVACY_VIOLATION: PII (Sensitive Clinical Data Leak)");
      }

      return Array.from(new Set(elements));
    };

    // Main AI Chatbot with Cisco AI Defense Guardrails
    app.post("/api/ai/chat", async (req, res) => {
      const { 
        message, 
        history, 
        selectedModel, 
        apiKeys, 
        userId, 
        userName, 
        userRole, 
        aiDefenseEnabled, 
        enableAiDefense, 
        aiDefenseGateway, 
        aiDefenseGatewayUrl,
        aiDefenseApiKey,
        aiDefensePromptSource,
        aiDefenseRules
      } = req.body;

      const isAiDefenseOn = aiDefenseEnabled === true || aiDefenseEnabled === "true" || enableAiDefense === true || enableAiDefense === "true";
      const actualAiDefenseGatewayUrl = aiDefenseGateway || aiDefenseGatewayUrl || "https://us.api.inspect.aidefense.security.cisco.com";

      const targetModelName = selectedModel || "OpenAI GPT-5";
      const cleanedModel = targetModelName.toLowerCase();
      const uId = userId || "unknown_patient";
      const uName = userName || "Unknown Patient";
      const uRole = userRole || "patient";

      console.log(`[AI_BROKER] [CHAT_START] Received incoming AI Chat request from User: "${uName}" (${uId}, Role: ${uRole}), Model requested: "${targetModelName}".`);

      const cleanedMsg = (message || "").toLowerCase().trim();

      // 1. --- Cisco AI Defense API Inspection (Phase 2 - AI Security) ---
      let isBlocked = false;
      let blockReason = "";
      let blockType = "Cisco AI Defense Content Guardrail";

      // Resolve the API key from environment variable or client payload
      const activeDefenseApiKey = (aiDefenseApiKey || "").trim() || (process.env.CISCO_AI_DEFENSE_API_KEY || process.env.AI_DEFENSE_API_KEY || "").trim();

      if (isAiDefenseOn && !activeDefenseApiKey) {
        console.error("[AI_DEFENSE] AI Defense is enabled but no API key is configured.");
        return res.status(400).json({
          error: "Cisco AI Defense is enabled but no API key is configured. Add a key in Security Controls or set CISCO_AI_DEFENSE_API_KEY.",
          provider: "cisco-defense"
        });
      }

      // Query Cisco AI Defense cloud inspect service with the configured policy rules
      if (isAiDefenseOn) {
        try {
          let inspectUrl = actualAiDefenseGatewayUrl.trim();
          if (!inspectUrl.startsWith("http://") && !inspectUrl.startsWith("https://")) {
            inspectUrl = "https://" + inspectUrl;
          }
          if (inspectUrl.endsWith("/")) {
            inspectUrl = inspectUrl.slice(0, -1);
          }
          if (!inspectUrl.includes("/api/v1/inspect/chat")) {
            if (inspectUrl.endsWith("/v1/chat/completions")) {
              inspectUrl = inspectUrl.replace("/v1/chat/completions", "/api/v1/inspect/chat");
            } else {
              inspectUrl += "/api/v1/inspect/chat";
            }
          }

          console.log(`[AI_DEFENSE] [PRE_SCAN] Dispatching chat messages along with configured client policies to Cisco AI Defense Inspect API: "${inspectUrl}"`);

          const inspectRes = await fetch(inspectUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Cisco-AI-Defense-API-Key": activeDefenseApiKey,
              "api-key": activeDefenseApiKey,
              "Authorization": `Bearer ${activeDefenseApiKey}`
            },
            body: JSON.stringify({
              messages: [{ role: "user", content: message }],
              policy: {
                rules: Object.entries(aiDefenseRules || {}).map(([ruleName, ruleConfig]: [string, any]) => ({
                  name: ruleName,
                  enabled: ruleConfig?.enabled === true || ruleConfig?.enabled === 'true',
                  action: ruleConfig?.action || 'Ignore'
                }))
              }
            }),
            signal: AbortSignal.timeout(8000)
          });

          console.log(`[AI_DEFENSE] [PRE_SCAN_RES] Gateway responded with status: ${inspectRes.status}`);

          if (inspectRes.ok) {
            const inspectData = await inspectRes.json();
            console.log(`[AI_DEFENSE] [PRE_SCAN_DATA] Guardrail evaluation payload:`, inspectData);

            // Check if Cisco Secure AI Defense flagged or blocked the message
            const resLower = JSON.stringify(inspectData).toLowerCase();
            const hasDenyAction = resLower.includes('"action":"block"') || 
                                  resLower.includes('"action":"deny"') || 
                                  resLower.includes('"status":"blocked"') || 
                                  resLower.includes('"blocked":true') ||
                                  (inspectData.action && inspectData.action.toLowerCase() === 'block') ||
                                  (inspectData.status && inspectData.status.toLowerCase() === 'blocked');

            if (hasDenyAction) {
              const violatedList = parseAiDefenseViolations(inspectData);
              isBlocked = true;
              blockReason = violatedList.join(', ');
            }
          } else {
            const errBody = await inspectRes.text().catch(() => "");
            console.error(`[AI_DEFENSE] [PRE_SCAN_ERROR] Inspect gateway returned HTTP ${inspectRes.status}: ${errBody}`);
            return res.status(inspectRes.status >= 400 ? inspectRes.status : 502).json({
              error: `Cisco AI Defense inspect request failed (HTTP ${inspectRes.status})${errBody ? `: ${errBody.substring(0, 200)}` : ""}`,
              provider: "cisco-defense"
            });
          }
        } catch (inspectErr: any) {
          console.error(`[AI_DEFENSE] [PRE_SCAN_ERROR] Inspect API is unreachable (${inspectErr.message}).`);
          return res.status(502).json({
            error: `Cisco AI Defense inspect API is unreachable: ${inspectErr.message}`,
            provider: "cisco-defense"
          });
        }
      }

      if (isBlocked) {
        console.warn(`[AI_DEFENSE] [INTERCEPT] Cisco AI Defense active intercept executed. Request terminates immediately.`);
        createLog(
          uId,
          uName,
          uRole,
          "AI Assistant Conversation",
          "Warning",
          `[Cisco AI Defense Blocked] Patient ask: "${message.substring(0, 100)}" - Reason: POLICY VIOLATION: ${blockReason}`,
          req
        );
        return res.json({
          response: `POLICY VIOLATION: ${blockReason}`,
          status: "Blocked",
          provider: "cisco-defense"
        });
      }


      // --- MCP TOOL REGISTRY SCHEMA ---
      const MCP_TOOLS_SPEC = {
        get_my_profile: {
          name: "get_my_profile",
          description: "Get the profile details of the current logged-in patient.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        get_my_clinical_summary: {
          name: "get_my_clinical_summary",
          description: "Retrieve active condition, DOB, clinical status and doctor-assigned logs of the current logged-in patient.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        get_my_medications: {
          name: "get_my_medications",
          description: "Get a detailed list of active prescriptions and medication administration records for the current patient.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        get_my_appointments: {
          name: "get_my_appointments",
          description: "List all scheduled appointments and physician meetings for the current patient.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        manage_my_appointment: {
          name: "manage_my_appointment",
          description: "Reschedule or cancel an existing appointment, or secure a new appointment slot.",
          parameters: {
            type: "object",
            properties: {
              action: { type: "string", description: "The scheduling operation to perform: 'create', 'update', or 'cancel'." },
              appointmentId: { type: "string", description: "The ID of the appointment to modify or cancel (leave empty if creating a new one)." },
              date: { type: "string", description: "The desired date for the appointment in YYYY-MM-DD format." },
              time: { type: "string", description: "The desired time for the appointment in HH:MM format." },
              reason: { type: "string", description: "The medical concern or reason for clinical visit." }
            },
            required: ["action"]
          }
        },
        get_my_lab_results: {
          name: "get_my_lab_results",
          description: "Fetch comprehensive checking laboratory parameters and diagnostic outcomes for the current patient.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        get_my_billing: {
          name: "get_my_billing",
          description: "Get financial billing records and unpaid invoices for the current patient.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        get_my_messages: {
          name: "get_my_messages",
          description: "Get list of message history and conversations of the patient.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        get_ward_roster: {
          name: "get_ward_roster",
          description: "Get the clinical roster of all active, inactive, discharged, triage, or general patients registered in the clinic or ward.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        get_patient_vitals: {
          name: "get_patient_vitals",
          description: "Retrieve logged clinical vitals for a specific patient by ID.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "The ID of the target patient." }
            },
            required: ["patientId"]
          }
        },
        record_vitals: {
          name: "record_vitals",
          description: "Overwrites or adds standard vitals (Heart rate, Blood Pressure, Temperature) for a specific patient.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "The ID of the patient." },
              hr: { type: "string", description: "Target heart rate in beats per minute (e.g. '78')." },
              temp: { type: "string", description: "Body Temperature in degrees Fahrenheit (e.g. '98.6')." },
              bp: { type: "string", description: "Arterial pressure in BP format (e.g. '120/80')." }
            },
            required: ["patientId", "hr", "temp", "bp"]
          }
        },
        get_medication_tasks: {
          name: "get_medication_tasks",
          description: "Check pending bedside medication administration list and checklist schedules on the nursing ward.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        update_medication_status: {
          name: "update_medication_status",
          description: "Mark a clinical medication item status as completed/administered or pending.",
          parameters: {
            type: "object",
            properties: {
              medId: { type: "string", description: "The target medication schedule task ID." },
              status: { type: "string", description: "Desired status: 'administered' or 'pending'." }
            },
            required: ["medId", "status"]
          }
        },
        update_medication_details: {
          name: "update_medication_details",
          description: "Update details of an active medication prescription (dosage, drug name, frequency) for an active patient.",
          parameters: {
            type: "object",
            properties: {
              medId: { type: "string", description: "The ID of the medication record to modify." },
              name: { type: "string", description: "Updated drug or prescription brand name." },
              dosage: { type: "string", description: "Updated dosage strength." },
              frequency: { type: "string", description: "Updated intake frequency/schedule." },
              status: { type: "string", description: "Updated administration status ('pending' or 'administered')." }
            },
            required: ["medId"]
          }
        },
        get_assigned_patient_deep_dive: {
          name: "get_assigned_patient_deep_dive",
          description: "Retrieve comprehensive historical health records of a single patient (condition, SSN, Insurance, notes, clinical vitals). Only accessible by doctors or admins.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "The ID of the patient." }
            },
            required: ["patientId"]
          }
        },
        search_clinical_knowledge: {
          name: "search_clinical_knowledge",
          description: "Clinical research RAG search hook for physical diagnosis guidelines, medications or clinical literature.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query containing clinical terms or symptoms." }
            },
            required: ["query"]
          }
        },
        prescribe_medication: {
          name: "prescribe_medication",
          description: "Dose and prescribe a new medication regimen for an active patient.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "The index ID of the target patient." },
              name: { type: "string", description: "Generic drug or prescription brand names (e.g. 'Lisinopril')." },
              dosage: { type: "string", description: "Quantity/dosage strength (e.g., '10mg')." },
              frequency: { type: "string", description: "Intake scheduling interval (e.g., 'once daily')." }
            },
            required: ["patientId", "name", "dosage", "frequency"]
          }
        },
        update_diagnostic_notes: {
          name: "update_diagnostic_notes",
          description: "Appends or updates diagnostic clinical observations to a patient's primary record.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "The ID of the target patient." },
              notes: { type: "string", description: "Detailed medical evaluation text to record." }
            },
            required: ["patientId", "notes"]
          }
        },
        query_audit_logs: {
          name: "query_audit_logs",
          description: "Admin search to query security audit entries, SSO multi-cloud logs, access controls, or policy logs.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        get_user_directory: {
          name: "get_user_directory",
          description: "Gets the central directory of registered active portal users and Identity mappings.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        manage_user_persona: {
          name: "manage_user_persona",
          description: "Edit user credentials, passwords, profiles, clearance levels and internal security configurations.",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: "The target ID of the user." },
              clearanceLevel: { type: "number", description: "The numerical classification security clearance level (1 to 3)." },
              role: { type: "string", description: "System security role boundary (e.g. 'admin', 'doctor', 'nurse', 'patient')." },
              internal_notes: { type: "string", description: "Administrative evaluation records." },
              realName: { type: "string", description: "Full legal name." },
              email: { type: "string", description: "Contact email address." },
              phone: { type: "string", description: "Contact phone number." },
              address: { type: "string", description: "Residential/practice address." },
              ssn: { type: "string", description: "Social Security Number." },
              insurance_id: { type: "string", description: "Insurance Group ID." },
              npi_number: { type: "string", description: "National Provider Identifier (NPI)." },
              assigned_ward: { type: "string", description: "Designated ward or station for nursing staff." },
              clinical_notes: { type: "string", description: "Clinical/medical history notes." }
            },
            required: ["userId"]
          }
        },
        get_infrastructure_topology: {
          name: "get_infrastructure_topology",
          description: "Retrieve enterprise infrastructure topology layout details (appserver, dbserver, aibroker, multi-cloud boundaries).",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        emergency_system_reset: {
          name: "emergency_system_reset",
          description: "Trigger comprehensive diagnostic emergency baseline reset of the EHR system database back to initial defaults.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        get_all_appointments: {
          name: "get_all_appointments",
          description: "Retrieve scheduled clinical appointments. Doctors default to their own queue. Nurses receive the full schedule (pass nurseId to filter to their assigned queue). Administrators receive all appointments enriched with patient care-team assignments. Optionally filter by patientId, doctorId, or nurseId.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "Optional patient ID to filter by." },
              doctorId: { type: "string", description: "Optional doctor ID to filter by." },
              nurseId: { type: "string", description: "Optional nurse ID to filter by (defaults to logged-in nurse when asking for 'my appointments')." }
            },
            required: []
          }
        },
        get_clinicians: {
          name: "get_clinicians",
          description: "Retrieve the directory of registered doctors and nurses (id and display name).",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        cancel_appointment: {
          name: "cancel_appointment",
          description: "Delete or cancel one scheduled appointment by ID. Patients may cancel their own visits; doctors and nurses may cancel appointments they are assigned to; administrators may cancel any appointment. For multiple appointments on a date, prefer cancel_appointments_by_date.",
          parameters: {
            type: "object",
            properties: {
              appointmentId: { type: "string", description: "The ID of the appointment to cancel." }
            },
            required: ["appointmentId"]
          }
        },
        reschedule_appointment: {
          name: "reschedule_appointment",
          description: "Reschedule one appointment by ID to a new date and time. Same authorization rules as cancel_appointment. For multiple appointments on a date, prefer reschedule_appointments_by_date.",
          parameters: {
            type: "object",
            properties: {
              appointmentId: { type: "string", description: "The ID of the appointment to reschedule." },
              date: { type: "string", description: "The desired date in YYYY-MM-DD format." },
              time: { type: "string", description: "The desired time in HH:MM format." }
            },
            required: ["appointmentId", "date", "time"]
          }
        },
        cancel_appointments_by_date: {
          name: "cancel_appointments_by_date",
          description: "Cancel ALL appointments on a given date that the logged-in user is authorized to modify (matches Appointments panel bulk delete). Use for requests like 'cancel all my appointments on August 8'. Date accepts YYYY-MM-DD or natural language (e.g. August 9).",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "The calendar date to cancel appointments on (YYYY-MM-DD or natural language)." }
            },
            required: ["date"]
          }
        },
        reschedule_appointments_by_date: {
          name: "reschedule_appointments_by_date",
          description: "Move ALL appointments from one date to another, preserving each appointment's time. Use for requests like 'move all appointments from August 9 to August 17'. Same authorization rules as cancel_appointment.",
          parameters: {
            type: "object",
            properties: {
              sourceDate: { type: "string", description: "Current date of appointments to move (YYYY-MM-DD or natural language)." },
              targetDate: { type: "string", description: "New date for those appointments (YYYY-MM-DD or natural language)." }
            },
            required: ["sourceDate", "targetDate"]
          }
        },
        update_appointment: {
          name: "update_appointment",
          description: "Update an appointment's date, time, reason, status, doctor, or nurse. Same authorization rules as cancel_appointment.",
          parameters: {
            type: "object",
            properties: {
              appointmentId: { type: "string", description: "The ID of the appointment to update." },
              date: { type: "string", description: "New date in YYYY-MM-DD format." },
              time: { type: "string", description: "New time (e.g. 2:30 PM)." },
              reason: { type: "string", description: "Visit reason or description." },
              status: { type: "string", description: "Appointment status: confirmed, pending, completed, or cancelled." },
              doctorId: { type: "string", description: "Assigned doctor user ID." },
              nurseId: { type: "string", description: "Assigned nurse user ID." }
            },
            required: ["appointmentId"]
          }
        },
        create_appointment: {
          name: "create_appointment",
          description: "Schedule a new clinical appointment.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "The ID of the target patient (required for doctors/nurses/admins; patients default to themselves). The logged-in doctor or nurse is auto-assigned when omitted." },
              date: { type: "string", description: "The desired date in YYYY-MM-DD format." },
              time: { type: "string", description: "The desired time in HH:MM format." },
              reason: { type: "string", description: "Reason for the patient visit." }
            },
            required: ["date", "time", "reason"]
          }
        },
        send_message: {
          name: "send_message",
          description: "Send a secure message to another portal user. Provide receiverId (e.g. patient31, doctor1) or receiverName (e.g. Charles Xavier). Display names and slug forms like charles_xavier are resolved automatically.",
          parameters: {
            type: "object",
            properties: {
              receiverId: { type: "string", description: "Recipient user ID (preferred when known)." },
              receiverName: { type: "string", description: "Recipient display name when ID is unknown." },
              content: { type: "string", description: "Text content of the message." }
            },
            required: ["content"]
          }
        },
        broadcast_message: {
          name: "broadcast_message",
          description: "Send the same message to every portal user with a given role (patient, nurse, doctor, or admin). Use for requests like 'message all nurses' or 'notify all patients'. Excludes the sender. Patients cannot broadcast to the patient role.",
          parameters: {
            type: "object",
            properties: {
              receiverRole: { type: "string", description: "Target role: patient, nurse, doctor, or admin." },
              content: { type: "string", description: "Message text to send to each recipient." }
            },
            required: ["receiverRole", "content"]
          }
        },
        pay_bill: {
          name: "pay_bill",
          description: "Mark a clinical billing invoice as fully paid by billing ID.",
          parameters: {
            type: "object",
            properties: {
              billingId: { type: "string", description: "The ID of the billing record." }
            },
            required: ["billingId"]
          }
        },
        delete_messages: {
          name: "delete_messages",
          description: "Delete one or more messages from the user's mailbox. Provide messageIds, or fromUserId/fromUserName to delete all messages from a specific sender.",
          parameters: {
            type: "object",
            properties: {
              messageIds: {
                type: "array",
                items: { type: "string" },
                description: "Explicit message IDs to delete (must belong to the user's mailbox)."
              },
              fromUserId: { type: "string", description: "Delete all messages from this sender in the user's mailbox." },
              fromUserName: { type: "string", description: "Delete all messages from a sender matched by display name (e.g. 'Nurse Ratched')." }
            },
            required: []
          }
        },
        get_billing_records: {
          name: "get_billing_records",
          description: "Query billing records by patientId, doctorId, or nurseId. Doctors and nurses default to their own clinician ID when no filter is given. Administrators may query all records.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "Filter by patient user ID." },
              doctorId: { type: "string", description: "Filter by attending doctor user ID." },
              nurseId: { type: "string", description: "Filter by attending nurse user ID." }
            },
            required: []
          }
        },
        update_my_profile: {
          name: "update_my_profile",
          description: "Update your own profile details like realName, email, phone, address, SSN, Insurance ID, NPI, Ward, or Clinical Notes.",
          parameters: {
            type: "object",
            properties: {
              realName: { type: "string", description: "Full legal name." },
              email: { type: "string", description: "Contact email address." },
              phone: { type: "string", description: "Contact phone number." },
              address: { type: "string", description: "Residential/practice address." },
              ssn: { type: "string", description: "Patient Social Security Number." },
              insurance_id: { type: "string", description: "Patient Insurance Group ID." },
              npi_number: { type: "string", description: "Doctor National Provider Identifier (NPI)." },
              assigned_ward: { type: "string", description: "Nurse designated ward or station." },
              clinical_notes: { type: "string", description: "Patient personal/clinical medical observations." }
            },
            required: []
          }
        },
        change_my_password: {
          name: "change_my_password",
          description: "Change user password securely by validating old password and saving new password.",
          parameters: {
            type: "object",
            properties: {
              oldPassword: { type: "string", description: "The current password." },
              newPassword: { type: "string", description: "The new desired password." }
            },
            required: ["oldPassword", "newPassword"]
          }
        },
        update_patient_status: {
          name: "update_patient_status",
          description: "Update a patient's triaged clinical state.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "The patient ID." },
              status: { type: "string", description: "Desired status: 'active', 'pending-triage', 'discharged', 'under observation', or 'inactive'." }
            },
            required: ["patientId", "status"]
          }
        },
        update_patient_details: {
          name: "update_patient_details",
          description: "Update a patient's clinical and demographic details, such as full name, phone, address, email, SSN, Insurance ID, status, and clinical notes. Accessible to doctors, nurses, and admins.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "The ID of the target patient user." },
              realName: { type: "string", description: "Updated full legal name of the patient." },
              email: { type: "string", description: "Updated contact email address." },
              phone: { type: "string", description: "Updated contact phone number." },
              address: { type: "string", description: "Updated home address." },
              ssn: { type: "string", description: "Updated Social Security Number." },
              insurance_id: { type: "string", description: "Updated Insurance ID number/code." },
              clinical_notes: { type: "string", description: "Updated clinical history/assessment notes." },
              status: { type: "string", description: "Updated clinical triage status ('active', 'pending-triage', 'discharged', 'under observation', or 'inactive')." }
            },
            required: ["patientId"]
          }
        },
        discontinue_medication: {
          name: "discontinue_medication",
          description: "Deletes or discontinues medication prescriptions.",
          parameters: {
            type: "object",
            properties: {
              medId: { type: "string", description: "ID of the medication prescription to discontinue." }
            },
            required: ["medId"]
          }
        },
        create_user: {
          name: "create_user",
          description: "Create a brand new portal user account with optional demographic & profile fields.",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "Account username (unique)." },
              realName: { type: "string", description: "Full name of the user." },
              role: { type: "string", description: "Account role: 'patient', 'doctor', 'nurse', or 'admin'." },
              clearance_level: { type: "number", description: "Classification security clearance level (1 to 3)." },
              email: { type: "string", description: "Contact email address." },
              phone: { type: "string", description: "Contact phone number." },
              address: { type: "string", description: "Residential or home address." },
              ssn: { type: "string", description: "Social Security Number (for patients)." },
              insurance_id: { type: "string", description: "Insurance ID (for patients)." },
              npi_number: { type: "string", description: "NPI Number (for doctors)." },
              assigned_ward: { type: "string", description: "Assigned ward (for nurses)." },
              clinical_notes: { type: "string", description: "Clinical treatment/diagnosis notes (for patients)." },
              internal_notes: { type: "string", description: "Administrative internal records." }
            },
            required: ["id", "realName", "role"]
          }
        },
        delete_user: {
          name: "delete_user",
          description: "Completely deletes a patient or clinical staff user account.",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: "User ID to merge out and delete." }
            },
            required: ["userId"]
          }
        },
        assign_patient_care_team: {
          name: "assign_patient_care_team",
          description: "Designate care teams dynamically.",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: "Target patient ID." },
              doctorId: { type: "string", description: "Doctor to assign to the patient." },
              nurseId: { type: "string", description: "Nurse to assign to the patient." }
            },
            required: ["patientId"]
          }
        },
        get_system_config: {
          name: "get_system_config",
          description: "Inspect system integration configuration parameters.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        update_system_config: {
          name: "update_system_config",
          description: "Save/override active clustering settings.",
          parameters: {
            type: "object",
            properties: {
              mode: { type: "string", description: "Deployment mode: 'standalone' or 'distributed'." },
              appserverUrl: { type: "string", description: "IP or URL of Application Server." },
              dbserverUrl: { type: "string", description: "IP or URL of Database Server." },
              aibrokerUrl: { type: "string", description: "IP or URL of AI Broker." }
            },
            required: ["mode"]
          }
        }
      };

      const normalizePeerUrl = (rawUrl: string): string => {
        let url = rawUrl.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = `http://${url}`;
        }
        if (!url.match(/:\d+/) && !url.includes("run.app") && !url.includes("aistudio")) {
          url = `${url}:3000`;
        }
        return url.replace(/\/$/, "");
      };

      const resolveDbApiBase = (): string => {
        if (IS_STANDALONE || APP_ROLE === "dbserver") {
          return `http://127.0.0.1:${PORT}`;
        }
        const raw = (liveConfig.dbserver_url || process.env.DB_SERVER_URL || "").trim();
        if (!raw || raw.toUpperCase().startsWith("TBD")) {
          throw new Error("Database server URL is not configured for this distributed node.");
        }
        return normalizePeerUrl(raw);
      };

      const resolveAuthApiBase = (): string => {
        if (IS_STANDALONE) return `http://127.0.0.1:${PORT}`;
        const raw = (liveConfig.appserver_url || process.env.APP_SERVER_URL || "").trim();
        if (!raw || raw.toUpperCase().startsWith("TBD")) {
          return `http://127.0.0.1:${PORT}`;
        }
        return normalizePeerUrl(raw);
      };

      const parseApiJson = async (response: Response) => {
        const text = await response.text();
        if (!text) return { success: true };
        return JSON.parse(text);
      };

      const executeMCPTool = async (
        toolName: string,
        args: any,
        uId: string,
        uRole: string
      ): Promise<any> => {
        try {
          const userObj = db_mock.users ? db_mock.users.find((u: any) => u.id === uId) : null;
          const userName = userObj ? userObj.realName : uId;
          const activeRole = userObj ? userObj.role : uRole;
          createLog(
            uId,
            userName,
            activeRole,
            "MCP Server Access",
            "Success",
            `AI Agent accessed MCP using tool [${toolName}]. Arguments: ${JSON.stringify(args || {})}`
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
          post: async (path: string, body: any) => {
            const response = await fetch(`${dbBase}${path}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(10000)
            });
            if (!response.ok) throw new Error(`DB Server error: ${response.status} ${response.statusText}`);
            return parseApiJson(response);
          },
          put: async (path: string, body: any) => {
            const response = await fetch(`${dbBase}${path}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(10000)
            });
            if (!response.ok) throw new Error(`DB Server error: ${response.status} ${response.statusText}`);
            return parseApiJson(response);
          },
          delete: async (path: string, body?: any) => {
            const response = await fetch(`${dbBase}${path}`, {
              method: "DELETE",
              headers: body ? { "Content-Type": "application/json" } : undefined,
              body: body ? JSON.stringify(body) : undefined,
              signal: AbortSignal.timeout(10000)
            });
            if (!response.ok) throw new Error(`DB Server error: ${response.status} ${response.statusText}`);
            return parseApiJson(response);
          }
        };
        const auth = {
          put: async (path: string, body: any) => {
            const response = await fetch(`${authBase}${path}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(10000)
            });
            if (!response.ok) throw new Error(`Auth service error: ${response.status} ${response.statusText}`);
            return parseApiJson(response);
          },
          post: async (path: string, body: any) => {
            const response = await fetch(`${authBase}${path}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(10000)
            });
            if (!response.ok) throw new Error(`Auth service error: ${response.status} ${response.statusText}`);
            return parseApiJson(response);
          }
        };

        console.log(`[MCP TOOL EXECUTION] Tool: "${toolName}" for User: "${uId}" (Role: "${uRole}")`, args);
        const startTime = Date.now();
        try {
          const resVal = await runMcpTool(toolName, args, uId, uRole, db, auth, {
            liveConfig,
            version: VERSION,
            versionDate: VERSION_DATE,
            saveSystemConfig: (newConfig) => {
              fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), "utf-8");
            }
          });
          const elapsed = Date.now() - startTime;
          const resultSummary = Array.isArray(resVal) ? `[${resVal.length} items]` : typeof resVal === "object" ? "[Object]" : String(resVal).substring(0, 150);
          console.log(`[MCP TOOL SUCCESS] Tool: "${toolName}" executed successfully in ${elapsed}ms. Summary: ${resultSummary}`);
          return resVal;
        } catch (mcpErr: any) {
          const elapsed = Date.now() - startTime;
          console.error(`[MCP TOOL ERROR] Tool: "${toolName}" failed after ${elapsed}ms:`, mcpErr.message || mcpErr);
          throw mcpErr;
        }
      };

      const mcpCapabilitiesByRole: Record<string, string> = {
        admin: `Your MCP tools include full enterprise access: user directory, audit logs, system configuration, care-team assignment, billing queries (get_billing_records), messaging, and all clinical records (patients, appointments, medications, vitals). Prefer get_all_appointments for schedule reporting, get_ward_roster for patient-to-clinician mappings, and get_clinicians for staff lookups.`,
        doctor: `Your MCP tools support clinical workflows: ward roster, assigned patient charts (get_assigned_patient_deep_dive), your appointment queue (get_all_appointments), vitals, prescribing, patient status updates, messaging, and billing queries for your clinician ID (get_billing_records). To cancel or move appointments you MUST call cancel_appointment, reschedule_appointment, cancel_appointments_by_date, or reschedule_appointments_by_date — never claim success after only reading the schedule.`,
        nurse: `Your MCP tools support bedside workflows: ward roster, patient vitals, medication administration tasks (MAR), patient status updates, messaging (send_message for one recipient, broadcast_message for all users in a role), billing queries (get_billing_records), and full appointment management for visits where you are the assigned nurse.`,
        patient: `Your MCP tools expose your own health record: profile, medications, appointments, lab results, billing, and messages. Use update_my_profile for profile changes, delete_messages to remove messages, send_message to compose, and create_appointment to schedule visits.`
      };
      const roleMcpGuidance = mcpCapabilitiesByRole[uRole] || mcpCapabilitiesByRole.patient;

      const systemPrompt = `You are the Vital Trust Virtual Health Assistant for ${uName}.

General assistance:
- Answer any user question naturally, including casual conversation, creative writing, and general knowledge. Vital Trust does not restrict prompts by login role.

Private Vital Trust data (MCP — required for EHR data):
- When the user asks about Vital Trust patients, schedules, medications, vitals, billing, audit logs, users, or system configuration, you MUST call the appropriate MCP tools to read or mutate that data. Never invent, guess, or paste private clinical/PHI data from memory.
- Each MCP tool calls the same authenticated REST APIs used by the web portal. Tool authorization is enforced server-side per role.

Critical mutation rules (create / update / delete):
- For ANY request to change data (profile fields, phone, email, messages, appointments, billing payment, etc.), you MUST call the matching MCP tool BEFORE telling the user the action succeeded.
- NEVER claim an action succeeded unless the tool response confirms success or returns the updated record.
- Profile updates: call update_my_profile with explicit fields (e.g. phone: "555-123-4567").
- Message deletion: call get_my_messages first if needed, then delete_messages with messageIds or fromUserName/fromUserId.
- Role broadcasts ("message all nurses/patients/doctors"): call broadcast_message with receiverRole and content — do not loop send_message manually.
- Appointment changes: get_all_appointments / get_my_appointments are read-only discovery. To cancel or reschedule you MUST call a write tool and wait for its success response:
  • "cancel all appointments on [date]" → cancel_appointments_by_date (date as YYYY-MM-DD; convert "August 8" → "2026-08-08")
  • "move all appointments from [date A] to [date B]" → reschedule_appointments_by_date (preserves times)
  • Single appointment → cancel_appointment or reschedule_appointment with appointmentId from the list
  Never tell the user appointments were changed if you only called a read tool.
- After a successful update_my_profile, you may summarize what changed based on the tool response only.

${roleMcpGuidance}

Session context:
- Logged-in User ID: "${uId}"
- Logged-in Real Name: "${uName}"
- Logged-in Role: "${uRole}"

MCP tool scoping for self-references (when using tools, not for refusing other questions):
1. Nurse (role: "nurse"): when the user asks about "my patients" or "my ward", filter get_ward_roster results to patients where assignedNurseId equals "${uId}".
2. Doctor (role: "doctor"): when the user asks about "my patients", filter get_ward_roster to assignedDoctorId equals "${uId}". Use get_all_appointments for their schedule queue.
3. Patient (role: "patient"): use patient-specific tools with user ID "${uId}" for their own record.
4. Administrator (role: "admin"): do not filter clinical data to a single user unless explicitly asked — system-wide visibility.

Appointment MCP notes:
- Doctors: get_all_appointments returns their queue by default (pass doctorId to query others). Use cancel_appointments_by_date / reschedule_appointments_by_date for bulk day-level changes.
- Nurses: get_all_appointments returns the full schedule (pass nurseId "${uId}" for only their assigned visits). Create/update/cancel/reschedule only on appointments where nurseId equals "${uId}".
- Administrators: get_all_appointments returns all appointments with care-team assignments.
- Patients: view via get_my_appointments; create/update/cancel/reschedule only their own visits.

If asked which model you use, say you correspond to configuration: ${targetModelName}.
Be helpful, clear, and use markdown bullet lists when presenting structured data.`;

      const activeTools: string[] = ROLE_TOOLS[uRole] || [];

      const resolveGeminiModelId = (modelName: string): string => {
        const m = modelName.toLowerCase().trim();
        const match = m.match(/gemini-[\d.]+-flash/);
        if (match) return match[0];
        return "gemini-2.5-flash";
      };

      const resolveGroqModelId = (modelName: string): string => {
        const key = modelName.toLowerCase().trim();
        const groqApiIds: Record<string, string> = {
          "groq-llama-3.3-70b-versatile": "llama-3.3-70b-versatile",
          "groq-llama-4-maverick-17b-128e-instruct": "llama-4-maverick-17b-128e-instruct",
          "groq-qwen3-32b": "qwen/qwen3-32b",
          "groq-kimi-k2-instruct-0905": "moonshotai/kimi-k2-instruct-0905",
        };
        if (groqApiIds[key]) return groqApiIds[key];
        if (key.startsWith("groq-")) return key.slice(5);
        return "llama-3.3-70b-versatile";
      };

      const executeGeminiCall = async (
        geminiKey: string,
        systemPrompt: string,
        contents: any[],
        formattedDeclarations: any[],
        modelId: string
      ) => {
        const clientOptions: any = {
          apiKey: geminiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        };

        const useProxy = isAiDefenseOn;
        if (useProxy) {
          clientOptions.baseUrl = actualAiDefenseGatewayUrl;
          clientOptions.baseURL = actualAiDefenseGatewayUrl;
          if (!clientOptions.httpOptions) clientOptions.httpOptions = {};
          clientOptions.httpOptions.baseUrl = actualAiDefenseGatewayUrl;
          clientOptions.httpOptions.baseURL = actualAiDefenseGatewayUrl;
          if (!clientOptions.httpOptions.headers) clientOptions.httpOptions.headers = {};
          clientOptions.httpOptions.headers["api-key"] = activeDefenseApiKey;
          clientOptions.httpOptions.headers["Authorization"] = `Bearer ${activeDefenseApiKey}`;
        }

        const client = new GoogleGenAI(clientOptions);
        const routeLabel = useProxy ? "Cisco AI Defense Gateway" : "Google Gemini API";
        console.log(`[AI_BROKER] [GEMINI] Calling ${routeLabel} with model "${modelId}"`);

        let loopLimit = 12;
        let replyText = "";
        const currentContents = JSON.parse(JSON.stringify(contents));

        while (loopLimit > 0) {
          const config: any = {
            systemInstruction: systemPrompt,
            temperature: 0.7,
          };
          if (formattedDeclarations.length > 0) {
            config.tools = [{ functionDeclarations: formattedDeclarations }];
          }

          const geminiRes = await client.models.generateContent({
            model: modelId,
            contents: currentContents,
            config
          });

          const funcCalls = geminiRes.functionCalls;
          if (funcCalls && funcCalls.length > 0) {
            currentContents.push(geminiRes.candidates?.[0]?.content);
            const functionResponsesPart: any = { role: "user", parts: [] };

            for (const fc of funcCalls) {
              const name = fc.name;
              const args = fc.args || {};
              const id = fc.id;
              const result = await executeMCPTool(name, args, uId, uRole);

              functionResponsesPart.parts.push({
                functionResponse: {
                  name,
                  id,
                  response: { result }
                }
              });
            }

            currentContents.push(functionResponsesPart);
            loopLimit--;
          } else {
            replyText = geminiRes.text || "No response text generated.";
            break;
          }
        }

        return { text: replyText, modelUsed: modelId, route: routeLabel };
      };

      // 2. --- Determine LLM Provider Family ---
      let targetModelFamily: 'openai' | 'groq' | 'gemini' | 'claude' | 'bedrock' = 'openai';

      if (cleanedModel.includes('openai') || cleanedModel.startsWith('o3')) {
        targetModelFamily = 'openai';
      } else if (cleanedModel.includes('llama') || cleanedModel.includes('qwen') || cleanedModel.includes('kimi')) {
        targetModelFamily = 'groq';
      } else if (cleanedModel.includes('gemini')) {
        targetModelFamily = 'gemini';
      } else if (cleanedModel.startsWith('claude -') || (cleanedModel.includes('claude-') && !cleanedModel.includes('bedrock'))) {
        targetModelFamily = 'claude';
      } else if (cleanedModel.includes('bedrock')) {
        targetModelFamily = 'bedrock';
      }
      
      console.log(`[AI_BROKER] [PROVIDER_SELECT] Inferred model family: "${targetModelFamily}" for requested model: "${targetModelName}". Starting provider-specific execution route.`);

      try {
        if (targetModelFamily === 'openai') {
          const openaiKey = apiKeys?.openaiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
          if (!openaiKey) {
            throw new Error("OpenAI API Key is missing. Please enter it in the settings panel.");
          }

          let openaiModelId = "gpt-4o-mini"; // fallback
          if (cleanedModel.includes("gpt-5-mini") || cleanedModel.includes("gpt-5-nano")) {
            openaiModelId = "gpt-4o-mini";
          } else if (cleanedModel.includes("gpt-5")) {
            openaiModelId = "gpt-4o";
          } else if (cleanedModel.includes("gpt-4.1") || cleanedModel.includes("gpt-4o")) {
            openaiModelId = "gpt-4o";
          } else if (cleanedModel.includes("gpt-4")) {
            openaiModelId = "gpt-4";
          } else if (cleanedModel.includes("o3-mini")) {
            openaiModelId = "o3-mini";
          }

          const isO3Mini = openaiModelId === "o3-mini";
          const messages: any[] = [{ role: isO3Mini ? "developer" : "system", content: systemPrompt }];
          if (Array.isArray(history)) {
            history.forEach((h: any) => {
              messages.push({
                role: h.role === "user" ? "user" : "assistant",
                content: h.content
              });
            });
          }
          messages.push({ role: "user", content: message });

          const formattedTools = activeTools.map((tName) => {
            const t = (MCP_TOOLS_SPEC as any)[tName];
            return {
              type: "function",
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
              }
            };
          });

          let loopLimit = 12;
          let replyMessage: any = null;

          while (loopLimit > 0) {
            const requestBody: any = {
              model: openaiModelId,
              messages,
            };
            if (formattedTools.length > 0) {
              requestBody.tools = formattedTools;
            }
            if (!isO3Mini) {
              requestBody.temperature = 0.7;
            }

             let openaiTargetUrl = "https://api.openai.com/v1/chat/completions";
            const useOpenAiProxy = isAiDefenseOn;

            if (useOpenAiProxy) {
              let proxyUrl = actualAiDefenseGatewayUrl;
              if (!proxyUrl.includes("/v1/chat/completions") && !proxyUrl.includes("/openai/v1/chat/completions")) {
                proxyUrl = proxyUrl.endsWith("/") ? `${proxyUrl}v1/chat/completions` : `${proxyUrl}/v1/chat/completions`;
              }
              openaiTargetUrl = proxyUrl;
            }

            const openaiHeaders: any = { "Content-Type": "application/json" };
            if (useOpenAiProxy) {
              openaiHeaders["api-key"] = activeDefenseApiKey;
              openaiHeaders["Authorization"] = `Bearer ${activeDefenseApiKey}`;
            } else {
              openaiHeaders["Authorization"] = `Bearer ${openaiKey}`;
            }

            console.log(`[AI_BROKER] [OPENAI_FETCH] Outgoing fetch to: [${openaiTargetUrl}]. Model: "${openaiModelId}". Proxy Mode: ${useOpenAiProxy}`);
            const openaiRes = await fetch(openaiTargetUrl, {
              method: "POST",
              headers: openaiHeaders,
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(15000)
            });

            if (!openaiRes.ok) {
              const errBody = await openaiRes.text();
              throw new Error(`OpenAI HTTP ${openaiRes.status}: ${errBody}`);
            }

            const data: any = await openaiRes.json();
            const choice = data.choices?.[0];
            replyMessage = choice?.message;

            if (replyMessage?.tool_calls && replyMessage.tool_calls.length > 0) {
              console.log(`[AI_BROKER] [OPENAI_TOOL_CALLS] Model requested execution of ${replyMessage.tool_calls.length} tool calls:`, replyMessage.tool_calls.map((tc: any) => tc.function?.name));
              messages.push(replyMessage);
              for (const toolCall of replyMessage.tool_calls) {
                const name = toolCall.function.name;
                let parsedArgs = {};
                try {
                  parsedArgs = typeof toolCall.function.arguments === 'string'
                    ? JSON.parse(toolCall.function.arguments)
                    : toolCall.function.arguments;
                } catch (e) {}
                const result = await executeMCPTool(name, parsedArgs, uId, uRole);
                messages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: name,
                  content: JSON.stringify(result)
                });
              }
              loopLimit--;
            } else {
              break;
            }
          }

          const reply = replyMessage?.content || "No reply from OpenAI.";

          createLog(
            uId,
            uName,
            uRole,
            "AI Assistant Conversation",
            "Success",
            `[OpenAI - ${openaiModelId}] Patient asked: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
            req
          );

          return res.json({
            response: reply,
            status: "Safe",
            provider: "openai"
          });

        } else if (targetModelFamily === 'groq') {
          const groqKey = apiKeys?.groqKey?.trim() || process.env.GROQ_API_KEY?.trim();
          if (!groqKey) {
            throw new Error("Groq API Key is missing. Please enter it in the settings panel.");
          }

          const groqModelId = resolveGroqModelId(targetModelName);

          const messages: any[] = [{ role: "system", content: systemPrompt }];
          if (Array.isArray(history)) {
            history.forEach((h: any) => {
              messages.push({
                role: h.role === "user" ? "user" : "assistant",
                content: h.content
              });
            });
          }
          messages.push({ role: "user", content: message });

          const formattedTools = activeTools.map((tName) => {
            const t = (MCP_TOOLS_SPEC as any)[tName];
            return {
              type: "function",
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
              }
            };
          });

          let loopLimit = 12;
          let replyMessage: any = null;

          while (loopLimit > 0) {
            const requestBody: any = {
              model: groqModelId,
              messages,
              temperature: 0.7
            };
            if (formattedTools.length > 0) {
              requestBody.tools = formattedTools;
            }

             let groqTargetUrl = "https://api.groq.com/openai/v1/chat/completions";
            if (isAiDefenseOn) {
              groqTargetUrl = actualAiDefenseGatewayUrl;
              if (!groqTargetUrl.includes("/v1/chat/completions") && !groqTargetUrl.includes("/openai/v1/chat/completions")) {
                if (groqTargetUrl.endsWith("/")) {
                  groqTargetUrl += "v1/chat/completions";
                } else {
                  groqTargetUrl += "/v1/chat/completions";
                }
              }
            }

            const groqHeaders: any = {
              "Content-Type": "application/json"
            };
            if (isAiDefenseOn) {
              groqHeaders["api-key"] = activeDefenseApiKey;
              groqHeaders["Authorization"] = `Bearer ${activeDefenseApiKey}`;
            } else {
              groqHeaders["Authorization"] = `Bearer ${groqKey}`;
            }

            const groqRes = await fetch(groqTargetUrl, {
              method: "POST",
              headers: groqHeaders,
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(30000)
            });

            if (!groqRes.ok) {
              const errBody = await groqRes.text();
              throw new Error(`Groq HTTP ${groqRes.status}: ${errBody}`);
            }

            const data: any = await groqRes.json();
            const choice = data.choices?.[0];
            replyMessage = choice?.message;

            if (replyMessage?.tool_calls && replyMessage.tool_calls.length > 0) {
              messages.push(replyMessage);
              for (const toolCall of replyMessage.tool_calls) {
                const name = toolCall.function.name;
                let parsedArgs = {};
                try {
                  parsedArgs = typeof toolCall.function.arguments === 'string'
                    ? JSON.parse(toolCall.function.arguments)
                    : toolCall.function.arguments;
                } catch (e) {}
                const result = await executeMCPTool(name, parsedArgs, uId, uRole);
                messages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: name,
                  content: JSON.stringify(result)
                });
              }
              loopLimit--;
            } else {
              break;
            }
          }

          const reply = replyMessage?.content || "No reply from Groq.";

          createLog(
            uId,
            uName,
            uRole,
            "AI Assistant Conversation",
            "Success",
            `[Groq - ${groqModelId}] Patient asked: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
            req
          );

          return res.json({
            response: reply,
            status: "Safe",
            provider: "groq"
          });

        } else if (targetModelFamily === 'gemini') {
          const geminiKey = apiKeys?.geminiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
          if (!geminiKey) {
            throw new Error("Gemini API Key is missing. Please enter it in the settings panel.");
          }

          const formattedDeclarations = activeTools.map((tName) => {
            const t = (MCP_TOOLS_SPEC as any)[tName];
            return {
              name: t.name,
              description: t.description,
              parameters: t.parameters
            };
          });

          const contents: any[] = [];
          if (Array.isArray(history)) {
            history.forEach((h: any) => {
              contents.push({
                role: h.role === "user" ? "user" : "model",
                parts: [{ text: h.content }]
              });
            });
          }
          contents.push({ role: "user", parts: [{ text: message }] });

          const geminiModelId = resolveGeminiModelId(targetModelName);
          const result = await executeGeminiCall(geminiKey, systemPrompt, contents, formattedDeclarations, geminiModelId);

          createLog(
            uId,
            uName,
            uRole,
            "AI Assistant Conversation",
            "Success",
            `[Gemini - ${result.modelUsed}] Patient asked: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}" (${result.route})`,
            req
          );

          return res.json({
            response: result.text,
            status: "Safe",
            provider: "gemini"
          });

        } else if (targetModelFamily === 'claude') {
          const claudeKey = apiKeys?.claudeKey?.trim() || process.env.CLAUDE_API_KEY?.trim();
          if (!claudeKey) {
            throw new Error("Claude API Key is missing. Please enter it in AI Settings or set CLAUDE_API_KEY in .env.");
          }

          const formattedTools = activeTools.map((tName) => {
            const t = (MCP_TOOLS_SPEC as any)[tName];
            return {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            };
          });

          const claudeResult = await executeClaudeChat({
            apiKey: claudeKey,
            modelName: targetModelName,
            systemPrompt,
            history: Array.isArray(history) ? history : [],
            userMessage: message,
            tools: formattedTools,
            executeTool: async (name, parsedArgs) => executeMCPTool(name, parsedArgs, uId, uRole),
          });

          createLog(
            uId,
            uName,
            uRole,
            "AI Assistant Conversation",
            "Success",
            `[Claude - ${claudeResult.modelUsed}] Patient asked: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
            req
          );

          return res.json({
            response: claudeResult.text,
            status: "Safe",
            provider: "claude"
          });

        } else if (targetModelFamily === 'bedrock') {
          const awsAccessKey = apiKeys?.awsAccessKey?.trim() || process.env.AWS_ACCESS_KEY?.trim();
          const awsSecretKey = apiKeys?.awsSecretKey?.trim() || process.env.AWS_SECRET_KEY?.trim();
          const awsRegion = apiKeys?.awsRegion?.trim() || process.env.AWS_REGION?.trim() || "us-east-1";
          let awsCustomDns = apiKeys?.awsCustomDns?.trim() || "";
          if (awsCustomDns.toLowerCase() === "null") awsCustomDns = "";

          if (!awsAccessKey || !awsSecretKey || !awsRegion) {
            throw new Error("AWS Bedrock Settings are incomplete. Access Key, Secret Key, and Region are required (configure in AI Settings or set AWS_ACCESS_KEY, AWS_SECRET_KEY, and AWS_REGION in .env).");
          }

          const formattedTools = activeTools.map((tName) => {
            const t = (MCP_TOOLS_SPEC as any)[tName];
            return {
              name: t.name,
              description: t.description,
              parameters: t.parameters
            };
          });

          const bedrockResult = await executeBedrockChat({
            credentials: {
              accessKeyId: awsAccessKey,
              secretAccessKey: awsSecretKey,
              region: awsRegion,
              customDns: awsCustomDns || undefined,
            },
            modelName: targetModelName,
            systemPrompt,
            history: Array.isArray(history) ? history : [],
            userMessage: message,
            tools: formattedTools,
            executeTool: async (name, parsedArgs) => executeMCPTool(name, parsedArgs, uId, uRole),
          });

          createLog(
            uId,
            uName,
            uRole,
            "AI Assistant Conversation",
            "Success",
            `[AWS Bedrock - ${bedrockResult.modelUsed}] Patient asked: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
            req
          );

          return res.json({
            response: bedrockResult.text,
            status: "Safe",
            provider: "bedrock"
          });
        }
      } catch (err: any) {
        const errorMessage = err?.message || String(err);
        console.error("[AI Assistant Error]:", errorMessage);
        const statusMatch = errorMessage.match(/HTTP (\d{3})/i);
        const parsedStatus = statusMatch ? parseInt(statusMatch[1], 10) : 502;
        const httpStatus = parsedStatus >= 400 && parsedStatus < 600 ? parsedStatus : 502;

        createLog(
          uId,
          uName,
          uRole,
          "AI Assistant Conversation",
          "Failed",
          `[${targetModelFamily}] ${errorMessage}`,
          req
        );

        return res.status(httpStatus).json({
          error: errorMessage,
          provider: targetModelFamily
        });
      }
    });
  }

  // --- FALLBACKS & STATIC ---
  
  // API 404
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "API not found", path: req.url, node: APP_ROLE });
  });

  // Client / Static
  if (APP_ROLE === "appserver" || APP_ROLE === "dbserver" || APP_ROLE === "aibroker" || IS_STANDALONE) {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
    }
  } else {
    app.get("/", (req, res) => res.json({ status: "online", role: APP_ROLE }));
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[VITALTRUST] Node [${APP_ROLE}] listening on port ${PORT}`);
  });

  server.on('error', (err) => console.error("[CRITICAL] Server failed to bind:", err));
}

startServer().catch(err => console.error("[TOP] Fatal error:", err));
