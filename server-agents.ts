import fs from "fs";
import { executeBedrockChat } from "./server-bedrock";
import { stripBedrockUiPrefix } from "./src/bedrock-models";

export const CHART_UPDATER_AGENT_ID = "aiagent1";
export const CHART_UPDATER_AGENT_NAME = "ChartUpdater Agent";
export const OVERNIGHT_NURSE_AGENT_ID = "aiagent2";
export const OVERNIGHT_NURSE_AGENT_NAME = "Overnight Nurse Agent";

export interface AgentConfig {
  chartUpdaterEnabled: boolean;
  overnightNurseEnabled: boolean;
  chartUpdaterIntervalMin: number;
  overnightNurseIntervalMin: number;
  nightShiftOnly: boolean;
  agentModel: string;
  awsRegion?: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
  awsCustomDns?: string;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  chartUpdaterEnabled: false,
  overnightNurseEnabled: false,
  chartUpdaterIntervalMin: 60,
  overnightNurseIntervalMin: 20,
  nightShiftOnly: true,
  agentModel: "Bedrock - anthropic.claude-haiku-4-5-20251001-v1:0",
};

export interface AgentVitalsSnapshot {
  hr: string;
  temp: string;
  bp: string;
}

export interface AgentActivityPatientUpdate {
  patientId: string;
  patientName: string;
  assignedDoctorId: string;
  condition: string;
  vitalsBefore: AgentVitalsSnapshot;
  vitalsAfter: AgentVitalsSnapshot;
  chartNote: string;
}

export interface AgentActivityEntry {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  activity: string;
  summary: string;
  narrative: string;
  patients: AgentActivityPatientUpdate[];
  overnightNurseStatus: "pending" | "processed" | "skipped";
  overnightNurseProcessedAt?: string;
  overnightNurseMessagePreview?: string;
}

export interface AgentActivityLog {
  schemaVersion: 1;
  updatedAt: string;
  entries: AgentActivityEntry[];
}

export type AgentRuntimeContext = {
  db: { patients: any[]; users: any[]; messages: any[] };
  savePersistedDb: () => void;
  createLog: (
    userId: string,
    userName: string,
    role: string,
    activity: string,
    status: "Success" | "Failure" | "Warning" | "Info",
    details: string
  ) => void;
  sendMessage: (senderId: string, receiverId: string, content: string) => boolean;
  configPath: string;
  activityLogPath: string;
};

let agentConfig: AgentConfig = { ...DEFAULT_AGENT_CONFIG };
let chartUpdaterTimer: ReturnType<typeof setInterval> | null = null;
let overnightNurseTimer: ReturnType<typeof setInterval> | null = null;
let chartUpdaterRunning = false;
let overnightNurseRunning = false;
let runCounter = 0;

const MAX_ACTIVITY_LOG_ENTRIES = 200;

function migrateLegacyAgentConfig(parsed: Record<string, unknown>): Partial<AgentConfig> {
  const partial: Partial<AgentConfig> = { ...parsed } as Partial<AgentConfig>;
  if (parsed.triageEnabled !== undefined && parsed.overnightNurseEnabled === undefined) {
    partial.overnightNurseEnabled = !!parsed.triageEnabled;
  }
  if (parsed.triageIntervalMin !== undefined && parsed.overnightNurseIntervalMin === undefined) {
    partial.overnightNurseIntervalMin = Number(parsed.triageIntervalMin) || DEFAULT_AGENT_CONFIG.overnightNurseIntervalMin;
  }
  return partial;
}

export function getAgentConfig(): AgentConfig {
  return { ...agentConfig };
}

export function loadAgentActivityLog(activityLogPath: string): AgentActivityLog {
  try {
    if (fs.existsSync(activityLogPath)) {
      const parsed = JSON.parse(fs.readFileSync(activityLogPath, "utf-8"));
      if (parsed && Array.isArray(parsed.entries)) {
        return {
          schemaVersion: 1,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          entries: parsed.entries,
        };
      }
    }
  } catch (err) {
    console.warn("[AGENTS] Failed to load agent_activity_log.json:", err);
  }
  return { schemaVersion: 1, updatedAt: new Date().toISOString(), entries: [] };
}

function saveAgentActivityLog(activityLogPath: string, log: AgentActivityLog) {
  log.updatedAt = new Date().toISOString();
  if (log.entries.length > MAX_ACTIVITY_LOG_ENTRIES) {
    log.entries = log.entries.slice(-MAX_ACTIVITY_LOG_ENTRIES);
  }
  fs.writeFileSync(activityLogPath, JSON.stringify(log, null, 2), "utf-8");
}

export function appendAgentActivityEntry(
  activityLogPath: string,
  entry: Omit<AgentActivityEntry, "overnightNurseStatus"> & { overnightNurseStatus?: AgentActivityEntry["overnightNurseStatus"] }
) {
  const log = loadAgentActivityLog(activityLogPath);
  log.entries.push({
    ...entry,
    overnightNurseStatus: entry.overnightNurseStatus || "pending",
  });
  saveAgentActivityLog(activityLogPath, log);
  return entry;
}

export function loadAgentConfigFromDisk(configPath: string): AgentConfig {
  try {
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      agentConfig = { ...DEFAULT_AGENT_CONFIG, ...migrateLegacyAgentConfig(parsed) };
    }
  } catch (err) {
    console.warn("[AGENTS] Failed to load agent_config.json:", err);
  }
  return getAgentConfig();
}

export function saveAgentConfigToDisk(configPath: string, partial: Partial<AgentConfig>): AgentConfig {
  agentConfig = { ...agentConfig, ...partial };
  fs.writeFileSync(configPath, JSON.stringify(agentConfig, null, 2), "utf-8");
  return getAgentConfig();
}

function resolveBedrockCredentials(config: AgentConfig) {
  const region = (config.awsRegion || process.env.AWS_REGION || "").trim();
  const accessKeyId = (config.awsAccessKey || process.env.AWS_ACCESS_KEY || "").trim();
  const secretAccessKey = (config.awsSecretKey || process.env.AWS_SECRET_KEY || "").trim();
  let customDns = (config.awsCustomDns || process.env.AWS_BEDROCK_CUSTOM_DNS || "").trim();
  if (customDns.toLowerCase() === "null") customDns = "";
  if (!region || !accessKeyId || !secretAccessKey) return null;
  return { region, accessKeyId, secretAccessKey, customDns: customDns || undefined };
}

function bumpVitals(vitals: { hr: string; temp: string; bp: string }) {
  const hrBase = parseInt(vitals.hr, 10) || 72;
  const hrDelta = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 2));
  const hr = Math.max(55, Math.min(125, hrBase + hrDelta));
  const tempBase = parseFloat(vitals.temp) || 98.4;
  const temp = Math.max(96.5, Math.min(101.5, tempBase + (Math.random() - 0.5) * 0.3)).toFixed(1);
  const [sysRaw, diaRaw] = (vitals.bp || "120/80").split("/");
  const sys = Math.max(90, Math.min(160, (parseInt(sysRaw, 10) || 120) + (Math.random() > 0.5 ? 1 : -1)));
  const dia = Math.max(55, Math.min(100, (parseInt(diaRaw, 10) || 80) + (Math.random() > 0.5 ? 1 : -1)));
  return {
    hr: String(hr),
    temp,
    bp: `${sys}/${dia}`,
    lastUpdated: new Date().toISOString().split("T")[0],
  };
}

function buildPatientNarrative(update: AgentActivityPatientUpdate): string {
  const { vitalsBefore: b, vitalsAfter: a } = update;
  return [
    `Patient ${update.patientName} (${update.patientId})`,
    `Condition: ${update.condition}`,
    `Vitals before: HR ${b.hr}, Temp ${b.temp}°F, BP ${b.bp}`,
    `Vitals after: HR ${a.hr}, Temp ${a.temp}°F, BP ${a.bp}`,
    `Chart note: ${update.chartNote}`,
    `Assigned doctor: ${update.assignedDoctorId}`,
  ].join("\n");
}

async function generateChartNote(
  patient: any,
  vitals: { hr: string; temp: string; bp: string },
  config: AgentConfig
): Promise<string> {
  const credentials = resolveBedrockCredentials(config);
  const fallback = `Routine bedside assessment — HR ${vitals.hr}, Temp ${vitals.temp}°F, BP ${vitals.bp}. Patient stable; continue current plan.`;
  if (!credentials) return fallback;

  try {
    const modelName = config.agentModel || DEFAULT_AGENT_CONFIG.agentModel;
    const result = await executeBedrockChat({
      credentials,
      modelName,
      systemPrompt:
        "You are a clinical charting assistant for a hospital EHR. Write concise professional nursing notes (1-2 sentences). No markdown, no PHI beyond what is provided.",
      history: [],
      userMessage: `Patient ${patient.name} (${patient.id}), condition: ${patient.condition}. Updated vitals — HR: ${vitals.hr}, Temp: ${vitals.temp}°F, BP: ${vitals.bp}. Write a brief chart note for the medical record.`,
      tools: [],
    });
    const text = (result.text || "").trim();
    return text.length > 10 ? text : fallback;
  } catch (err: any) {
    console.warn("[AGENTS] Bedrock chart note generation failed:", err?.message || err);
    return fallback;
  }
}

async function generateDoctorAlert(
  update: AgentActivityPatientUpdate,
  config: AgentConfig
): Promise<string> {
  const credentials = resolveBedrockCredentials(config);
  const fallback = [
    `Overnight nurse review for ${update.patientName} (${update.patientId}):`,
    `HR ${update.vitalsBefore.hr} → ${update.vitalsAfter.hr},`,
    `Temp ${update.vitalsBefore.temp}°F → ${update.vitalsAfter.temp}°F,`,
    `BP ${update.vitalsBefore.bp} → ${update.vitalsAfter.bp}.`,
    `Please review at next rounds.`,
  ].join(" ");

  if (!credentials) return fallback;

  try {
    const modelName = config.agentModel || DEFAULT_AGENT_CONFIG.agentModel;
    const result = await executeBedrockChat({
      credentials,
      modelName,
      systemPrompt:
        "You are an overnight ward nurse messaging a physician about vitals changes. Write 2-3 concise sentences at nurse level. No markdown. Be factual and calm.",
      history: [],
      userMessage: buildPatientNarrative(update),
      tools: [],
    });
    const text = (result.text || "").trim();
    return text.length > 20 ? text : fallback;
  } catch (err: any) {
    console.warn("[AGENTS] Bedrock overnight nurse alert failed:", err?.message || err);
    return fallback;
  }
}

function isWithinNightShift(now = new Date()): boolean {
  const hour = now.getHours();
  return hour >= 19 || hour < 7;
}

export async function runChartUpdaterCycle(ctx: AgentRuntimeContext): Promise<void> {
  if (chartUpdaterRunning) {
    console.log("[AGENTS] Chart updater already running — skipping overlapping cycle.");
    return;
  }
  chartUpdaterRunning = true;
  const config = getAgentConfig();
  const today = new Date().toISOString().split("T")[0];
  const patientUpdates: AgentActivityPatientUpdate[] = [];

  try {
    const activePatients = (ctx.db.patients || []).filter((p: any) => p.status === "active");
    if (activePatients.length === 0) {
      ctx.createLog(
        CHART_UPDATER_AGENT_ID,
        CHART_UPDATER_AGENT_NAME,
        "aiagent",
        "Chart Updater Agent Run",
        "Info",
        "No active patients to update."
      );
      return;
    }

    const batchSize = Math.min(6, activePatients.length);
    const start = (runCounter * batchSize) % activePatients.length;
    const batch: any[] = [];
    for (let i = 0; i < batchSize; i++) {
      batch.push(activePatients[(start + i) % activePatients.length]);
    }
    runCounter++;

    for (const patient of batch) {
      const priorVitals = patient.vitals || { hr: "72", temp: "98.4", bp: "120/80", lastUpdated: today };
      const newVitals = bumpVitals(priorVitals);
      patient.vitals = newVitals;

      const note = await generateChartNote(patient, newVitals, config);
      const stamped = `[${today} ChartUpdater] ${note}`;
      patient.clinical_notes = patient.clinical_notes
        ? `${patient.clinical_notes}\n${stamped}`
        : stamped;

      patientUpdates.push({
        patientId: patient.id,
        patientName: patient.name,
        assignedDoctorId: patient.assignedDoctorId || "",
        condition: patient.condition || "General",
        vitalsBefore: {
          hr: priorVitals.hr,
          temp: priorVitals.temp,
          bp: priorVitals.bp,
        },
        vitalsAfter: {
          hr: newVitals.hr,
          temp: newVitals.temp,
          bp: newVitals.bp,
        },
        chartNote: note,
      });
    }

    ctx.savePersistedDb();

    const runId = `chart-${Date.now()}`;
    const narrative = patientUpdates.map(buildPatientNarrative).join("\n\n---\n\n");
    const summaryLines = patientUpdates.map(
      (u) =>
        `${u.patientId} (${u.patientName}): HR ${u.vitalsBefore.hr}→${u.vitalsAfter.hr}, Temp ${u.vitalsBefore.temp}→${u.vitalsAfter.temp}, BP ${u.vitalsBefore.bp}→${u.vitalsAfter.bp}`
    );

    appendAgentActivityEntry(ctx.activityLogPath, {
      id: runId,
      timestamp: new Date().toISOString(),
      agentId: CHART_UPDATER_AGENT_ID,
      agentName: CHART_UPDATER_AGENT_NAME,
      activity: "Chart Updater Agent Run",
      summary: `Updated ${batch.length} patient chart(s). ${summaryLines.join(" | ")}`,
      narrative,
      patients: patientUpdates,
      overnightNurseStatus: "pending",
    });

    const modelLabel = stripBedrockUiPrefix(config.agentModel || DEFAULT_AGENT_CONFIG.agentModel);
    ctx.createLog(
      CHART_UPDATER_AGENT_ID,
      CHART_UPDATER_AGENT_NAME,
      "aiagent",
      "Chart Updater Agent Run",
      "Success",
      `Updated ${batch.length} patient chart(s) via Bedrock (${modelLabel}). Activity logged for overnight nurse review. ${summaryLines.join(" | ")}`
    );
    console.log(`[AGENTS] Chart updater completed — ${batch.length} patient(s) updated.`);
  } catch (err: any) {
    console.error("[AGENTS] Chart updater cycle failed:", err);
    ctx.createLog(
      CHART_UPDATER_AGENT_ID,
      CHART_UPDATER_AGENT_NAME,
      "aiagent",
      "Chart Updater Agent Run",
      "Failure",
      err?.message || String(err)
    );
  } finally {
    chartUpdaterRunning = false;
  }
}

export async function runOvernightNurseCycle(ctx: AgentRuntimeContext): Promise<void> {
  if (overnightNurseRunning) {
    console.log("[AGENTS] Overnight nurse already running — skipping overlapping cycle.");
    return;
  }
  overnightNurseRunning = true;
  const config = getAgentConfig();

  try {
    if (config.nightShiftOnly && !isWithinNightShift()) {
      console.log("[AGENTS] Overnight nurse skipped — outside night shift window (19:00–07:00).");
      return;
    }

    const log = loadAgentActivityLog(ctx.activityLogPath);
    const pendingEntries = log.entries.filter((e) => e.overnightNurseStatus === "pending");
    if (pendingEntries.length === 0) {
      console.log("[AGENTS] Overnight nurse — no pending chart updater activity to review.");
      return;
    }

    let messagesSent = 0;
    const doctorAlerts: string[] = [];

    for (const entry of pendingEntries) {
      for (const patientUpdate of entry.patients) {
        const doctorId = patientUpdate.assignedDoctorId;
        if (!doctorId) {
          continue;
        }
        const doctor = ctx.db.users.find((u: any) => u.id === doctorId);
        if (!doctor) {
          continue;
        }

        const alertText = await generateDoctorAlert(patientUpdate, config);
        const sent = ctx.sendMessage(OVERNIGHT_NURSE_AGENT_ID, doctorId, alertText);
        if (sent) {
          messagesSent++;
          doctorAlerts.push(`${patientUpdate.patientId} → Dr. ${doctor.realName || doctorId}`);
        }
      }

      entry.overnightNurseStatus = "processed";
      entry.overnightNurseProcessedAt = new Date().toISOString();
      entry.overnightNurseMessagePreview = doctorAlerts.slice(-3).join("; ");
    }

    saveAgentActivityLog(ctx.activityLogPath, log);

    if (messagesSent > 0) {
      ctx.createLog(
        OVERNIGHT_NURSE_AGENT_ID,
        OVERNIGHT_NURSE_AGENT_NAME,
        "aiagent",
        "Overnight Nurse Agent Run",
        "Success",
        `Reviewed ${pendingEntries.length} chart updater run(s). Sent ${messagesSent} vitals alert message(s) to assigned doctors: ${doctorAlerts.join(" | ")}`
      );
      console.log(`[AGENTS] Overnight nurse sent ${messagesSent} doctor message(s).`);
    } else {
      ctx.createLog(
        OVERNIGHT_NURSE_AGENT_ID,
        OVERNIGHT_NURSE_AGENT_NAME,
        "aiagent",
        "Overnight Nurse Agent Run",
        "Info",
        `Reviewed ${pendingEntries.length} chart updater run(s) but no doctor messages were sent (missing assignments or recipients).`
      );
    }
  } catch (err: any) {
    console.error("[AGENTS] Overnight nurse cycle failed:", err);
    ctx.createLog(
      OVERNIGHT_NURSE_AGENT_ID,
      OVERNIGHT_NURSE_AGENT_NAME,
      "aiagent",
      "Overnight Nurse Agent Run",
      "Failure",
      err?.message || String(err)
    );
  } finally {
    overnightNurseRunning = false;
  }
}

function clearChartUpdaterTimer() {
  if (chartUpdaterTimer) {
    clearInterval(chartUpdaterTimer);
    chartUpdaterTimer = null;
  }
}

function clearOvernightNurseTimer() {
  if (overnightNurseTimer) {
    clearInterval(overnightNurseTimer);
    overnightNurseTimer = null;
  }
}

export function restartAgentScheduler(ctx: AgentRuntimeContext) {
  clearChartUpdaterTimer();
  clearOvernightNurseTimer();
  const config = getAgentConfig();

  if (config.chartUpdaterEnabled) {
    const intervalMs = Math.max(5, config.chartUpdaterIntervalMin) * 60 * 1000;
    console.log(
      `[AGENTS] Chart updater enabled — interval ${config.chartUpdaterIntervalMin} min, model: ${config.agentModel}`
    );
    chartUpdaterTimer = setInterval(() => {
      runChartUpdaterCycle(ctx).catch((err) => console.error("[AGENTS] Scheduled chart updater error:", err));
    }, intervalMs);
    setTimeout(() => {
      runChartUpdaterCycle(ctx).catch((err) => console.error("[AGENTS] Initial chart updater error:", err));
    }, 8000);
  } else {
    console.log("[AGENTS] Chart updater agent disabled.");
  }

  if (config.overnightNurseEnabled) {
    const intervalMs = Math.max(5, config.overnightNurseIntervalMin) * 60 * 1000;
    console.log(
      `[AGENTS] Overnight nurse enabled — interval ${config.overnightNurseIntervalMin} min, nightShiftOnly: ${config.nightShiftOnly}`
    );
    overnightNurseTimer = setInterval(() => {
      runOvernightNurseCycle(ctx).catch((err) => console.error("[AGENTS] Scheduled overnight nurse error:", err));
    }, intervalMs);
    setTimeout(() => {
      runOvernightNurseCycle(ctx).catch((err) => console.error("[AGENTS] Initial overnight nurse error:", err));
    }, 15000);
  } else {
    console.log("[AGENTS] Overnight nurse agent disabled.");
  }
}

export function initAgentScheduler(ctx: AgentRuntimeContext) {
  loadAgentConfigFromDisk(ctx.configPath);
  restartAgentScheduler(ctx);
}

export function applyAgentConfigUpdate(ctx: AgentRuntimeContext, partial: Partial<AgentConfig> & Record<string, unknown>) {
  const migrated = migrateLegacyAgentConfig(partial);
  saveAgentConfigToDisk(ctx.configPath, migrated);
  restartAgentScheduler(ctx);
  return getAgentConfig();
}
