import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Save, 
  BrainCircuit, 
  Key, 
  Database, 
  Lock, 
  ShieldCheck, 
  Check, 
  Sparkles, 
  ChevronDown, 
  HelpCircle,
  X,
  Settings,
  Eye,
  EyeOff,
  RotateCcw,
  Network,
  Activity,
  Wifi,
  WifiOff,
  Server,
  Shield,
  ShieldAlert,
  Loader2,
  Bot
} from 'lucide-react';
import { User } from '../../types';
import { api } from '../../services/api';
import { BEDROCK_UI_MODELS, migrateEolBedrockModelId, stripBedrockUiPrefix } from '../../bedrock-models';

const MODELS = [
  "OpenAI GPT-5",
  "OpenAI GPT-5-mini",
  "OpenAI GPT-5-nano",
  "OpenAI GPT-4.1",
  "OpenAI o3-mini",
  "OpenAI GPT-4o",
  "OpenAI GPT-4",
  "groq-llama-3.3-70b-versatile",
  "groq-llama-4-maverick-17b-128e-instruct",
  "groq-qwen3-32b",
  "groq-kimi-k2-instruct-0905",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  ...BEDROCK_UI_MODELS,
];

const REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-2",
  "eu-west-1",
  "ap-southeast-1"
];

function getModelFamily(model: string): 'openai' | 'groq' | 'gemini' | 'bedrock' {
  const m = model.toLowerCase();
  if (m.includes('openai') || m.startsWith('o3')) return 'openai';
  if (m.includes('llama') || m.includes('qwen') || m.includes('kimi') || m.startsWith('groq-')) return 'groq';
  if (m.includes('gemini')) return 'gemini';
  if (m.includes('bedrock')) return 'bedrock';
  return 'openai';
}

const NodeCard = ({ name, roleKey, activeRole, ip, status, url, isMono }: any) => {
  const isActive = isMono || activeRole === roleKey;
  const isOnline = isMono || status === "Online";

  return (
    <div className={`p-5 rounded-2xl border transition-all duration-300 ${
      isActive 
        ? 'border-[#7c1a1a] bg-red-50/10 shadow-sm' 
        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">System Role</span>
          <h5 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <Server size={14} className={isActive ? "text-[#7c1a1a]" : "text-slate-400"} />
            {name}
          </h5>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'} border border-white`} />
          <span className={`text-[9px] font-black uppercase tracking-wider ${isOnline ? 'text-emerald-700' : 'text-red-700'}`}>
            {status || (isMono ? 'Online' : 'Offline')}
          </span>
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-slate-600 font-medium">
        <div className="flex justify-between">
          <span className="text-slate-400">Target IP/Host:</span>
          <span className="font-mono text-[11px] text-slate-700 font-semibold">{ip || "127.0.0.1"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Rest Endpoint:</span>
          <span className="truncate max-w-[170px] font-mono text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded" title={url}>{url || "http://localhost:3000"}</span>
        </div>
        <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200/50">
          <span className="text-slate-400">Allocation:</span>
          {isActive ? (
            <span className="text-[9px] bg-[#7c1a1a] text-white px-2 py-0.5 rounded-md font-black uppercase tracking-wider">Local Instance</span>
          ) : (
            <span className="text-[9px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-md font-black uppercase tracking-wider">Remote Cluster</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default function AISettings({ user }: { user: User }) {
  const [activeSubTab, setActiveSubTab] = useState<'model' | 'deployment' | 'security'>('deployment');

  // AI Model Tab States
  const [selectedModel, setSelectedModel] = useState<string>('OpenAI GPT-5');
  const [agentSelectedModel, setAgentSelectedModel] = useState<string>('Bedrock - anthropic.claude-haiku-4-5-20251001-v1:0');
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [groqKey, setGroqKey] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [awsRegion, setAwsRegion] = useState<string>('us-east-1');
  const [awsAccessKey, setAwsAccessKey] = useState<string>('');
  const [awsSecretKey, setAwsSecretKey] = useState<string>('');
  const [awsCustomDns, setAwsCustomDns] = useState<string>('null');

  // Autonomous agent settings (Phase 2)
  const [agentChartUpdaterEnabled, setAgentChartUpdaterEnabled] = useState<boolean>(false);
  const [agentTriageEnabled, setAgentTriageEnabled] = useState<boolean>(false);
  const [agentChartUpdaterIntervalMin, setAgentChartUpdaterIntervalMin] = useState<number>(60);
  const [agentTriageIntervalMin, setAgentTriageIntervalMin] = useState<number>(20);
  const [agentNightShiftOnly, setAgentNightShiftOnly] = useState<boolean>(true);

  // Key visibility toggles
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showAwsAccessKey, setShowAwsAccessKey] = useState(false);
  const [showAwsSecretKey, setShowAwsSecretKey] = useState(false);

  // Deployment Tab States
  const [deploymentMode, setDeploymentMode] = useState<'standalone' | 'distributed'>('standalone');
  const [nodeRole, setNodeRole] = useState<'standalone' | 'appserver' | 'dbserver' | 'aibroker'>('standalone');
  const [applicationServerUrl, setApplicationServerUrl] = useState<string>('');
  const [dbServerUrl, setDbServerUrl] = useState<string>('');
  const [aiBrokerUrl, setAiBrokerUrl] = useState<string>('');
  const [adminBypassRestricted, setAdminBypassRestricted] = useState(false);

  // System status and loading states
  const [topologyNodes, setTopologyNodes] = useState<any>(null);
  const [testingConnectivity, setTestingConnectivity] = useState(false);
  const [savingDeployment, setSavingDeployment] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);

  // Security Controls Tab States
  const [aiDefenseGateway, setAiDefenseGateway] = useState<string>('https://us.api.inspect.aidefense.security.cisco.com');
  const [aiDefenseEnabled, setAiDefenseEnabled] = useState<boolean>(false);
  const [aiDefenseMode, setAiDefenseMode] = useState<string>('Via API');
  const [aiDefenseServer, setAiDefenseServer] = useState<string>('https://us.api.inspect.aidefense.security.cisco.com');
  const [aiDefenseApiKey, setAiDefenseApiKey] = useState<string>('');
  const [aiDefensePromptSource, setAiDefensePromptSource] = useState<string>('server');
  const [aiDefenseRules, setAiDefenseRules] = useState<Record<string, { enabled: boolean; action: 'Ignore' | 'Block' | 'Alert' }>>({
    'CODE DETECTION': { enabled: false, action: 'Ignore' },
    'HARASSMENT': { enabled: false, action: 'Ignore' },
    'HATE SPEECH': { enabled: false, action: 'Ignore' },
    'PCI': { enabled: false, action: 'Ignore' },
    'PHI': { enabled: false, action: 'Ignore' },
    'PII': { enabled: false, action: 'Ignore' },
    'PROMPT INJECTION': { enabled: false, action: 'Ignore' },
    'PROFANITY': { enabled: false, action: 'Ignore' },
    'SEXUAL CONTENT & EXPLOITATION': { enabled: false, action: 'Ignore' },
    'SOCIAL DIVISION & POLARIZATION': { enabled: false, action: 'Ignore' }
  });

  // UI status hooks
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showHowToIntegrate, setShowHowToIntegrate] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [defenseTestStatus, setDefenseTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [defenseTestMessage, setDefenseTestMessage] = useState<string>('');

  // Server credentials configuration availability
  const [serverKeysConfig, setServerKeysConfig] = useState<{
    geminiAvailable: boolean;
    openaiAvailable: boolean;
    awsBedrockAvailable: boolean;
    awsRegion?: string;
    activeProvider: string;
  }>({
    geminiAvailable: false,
    openaiAvailable: false,
    awsBedrockAvailable: false,
    activeProvider: 'local'
  });

  // Load initially from LocalStorage & API endpoints
  useEffect(() => {
    // Model credentials
    const storedAssistantModel = localStorage.getItem('vt_ai_selected_model') || 'OpenAI GPT-5';
    const migratedAssistant = storedAssistantModel.toLowerCase().includes('bedrock')
      ? `Bedrock - ${migrateEolBedrockModelId(stripBedrockUiPrefix(storedAssistantModel))}`
      : storedAssistantModel;
    if (MODELS.includes(migratedAssistant)) {
      setSelectedModel(migratedAssistant);
      if (migratedAssistant !== storedAssistantModel) {
        localStorage.setItem('vt_ai_selected_model', migratedAssistant);
      }
    } else {
      setSelectedModel('Bedrock - anthropic.claude-sonnet-4-5-20250929-v1:0');
    }

    const storedAgentModel = localStorage.getItem('vt_ai_agent_selected_model') || 'Bedrock - anthropic.claude-haiku-4-5-20251001-v1:0';
    const migratedAgent = `Bedrock - ${migrateEolBedrockModelId(stripBedrockUiPrefix(storedAgentModel))}`;
    if (MODELS.includes(migratedAgent)) {
      setAgentSelectedModel(migratedAgent);
      if (migratedAgent !== storedAgentModel) {
        localStorage.setItem('vt_ai_agent_selected_model', migratedAgent);
      }
    } else {
      setAgentSelectedModel('Bedrock - anthropic.claude-haiku-4-5-20251001-v1:0');
    }
    setOpenaiKey(localStorage.getItem('vt_ai_openai_key') || '');
    setGroqKey(localStorage.getItem('vt_ai_groq_key') || '');
    setGeminiKey(localStorage.getItem('vt_ai_gemini_key') || '');
    setAwsRegion(localStorage.getItem('vt_ai_aws_region') || 'us-east-1');
    setAwsAccessKey(localStorage.getItem('vt_ai_aws_access_key') || '');
    setAwsSecretKey(localStorage.getItem('vt_ai_aws_secret_key') || '');
    setAwsCustomDns(localStorage.getItem('vt_ai_aws_custom_dns') || 'null');

    setAgentChartUpdaterEnabled(localStorage.getItem('vt_agent_chart_updater_enabled') === 'true');
    setAgentTriageEnabled(localStorage.getItem('vt_agent_triage_enabled') === 'true');
    setAgentChartUpdaterIntervalMin(parseInt(localStorage.getItem('vt_agent_chart_updater_interval_min') || '60', 10) || 60);
    setAgentTriageIntervalMin(parseInt(localStorage.getItem('vt_agent_triage_interval_min') || '20', 10) || 20);
    setAgentNightShiftOnly(localStorage.getItem('vt_agent_night_shift_only') !== 'false');

    // Security Gateways
    setAiDefenseEnabled(localStorage.getItem('vt_ai_defense_enabled') === 'true');
    setAiDefenseMode(localStorage.getItem('vt_ai_defense_mode') || 'Via API');
    const savedServer = localStorage.getItem('vt_ai_defense_server') || 'https://us.api.inspect.aidefense.security.cisco.com';
    setAiDefenseServer(savedServer);
    setAiDefenseGateway(savedServer);
    setAiDefenseApiKey(localStorage.getItem('vt_ai_defense_api_key') || '');
    setAiDefensePromptSource(localStorage.getItem('vt_ai_defense_prompt_source') || 'server');

    const savedRulesStr = localStorage.getItem('vt_ai_defense_rules');
    if (savedRulesStr) {
      try {
        setAiDefenseRules(JSON.parse(savedRulesStr));
      } catch (e) {
        console.error("Error loading rules from local storage:", e);
      }
    }

    // Fetch server keys fallback
    fetch('/api/ai/config')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          setServerKeysConfig({
            geminiAvailable: !!data.geminiAvailable,
            openaiAvailable: !!data.openaiAvailable,
            awsBedrockAvailable: !!data.awsBedrockAvailable,
            awsRegion: data.awsRegion,
            activeProvider: data.activeProvider || 'local'
          });
          if (data.awsBedrockAvailable && data.awsRegion && !localStorage.getItem('vt_ai_aws_region')) {
            setAwsRegion(data.awsRegion);
          }
        }
      })
      .catch(err => console.error('Error fetching server config:', err));

    // Fetch dynamic system config and cluster statuses
    fetch('/api/system/config')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          const m = data.mode === 'distributed' ? 'distributed' : 'standalone';
          const distributedRoles = ['appserver', 'dbserver', 'aibroker'];
          const r = distributedRoles.includes(data.role) ? data.role : (m === 'distributed' ? 'appserver' : 'standalone');
          setDeploymentMode(m);
          setNodeRole(r as 'standalone' | 'appserver' | 'dbserver' | 'aibroker');

          const extractIp = (urlStr: string) => {
            if (!urlStr) return '';
            try {
              const u = new URL(urlStr);
              return u.hostname;
            } catch (e) {
              return urlStr.replace(/^https?:\/\//, '').split(':')[0] || urlStr;
            }
          };
          setApplicationServerUrl(data.appserver_url && extractIp(data.appserver_url) !== 'localhost' ? extractIp(data.appserver_url) : '');
          setDbServerUrl(data.dbserver_url && extractIp(data.dbserver_url) !== 'localhost' ? extractIp(data.dbserver_url) : '');
          setAiBrokerUrl(data.aibroker_url && extractIp(data.aibroker_url) !== 'localhost' ? extractIp(data.aibroker_url) : '');
        }
      })
      .catch(err => console.error('Error fetching system config:', err));

    fetch('/api/system/nodes')
      .then(res => res.json())
      .then(data => {
        if (data && data.nodes) {
          setTopologyNodes(data.nodes);
        }
      })
      .catch(err => console.error('Error fetching nodes:', err));
  }, []);

  const handleFactoryReset = async () => {
    setShowFactoryResetModal(false);
    setResetting(true);
    try {
      const res = await api.factoryReset();
      if (res.success) {
        localStorage.setItem('vt_ai_defense_enabled', 'false');
        localStorage.setItem('vt_ai_defense_server', 'https://us.api.inspect.aidefense.security.cisco.com');
        localStorage.setItem('vt_ai_defense_gateway', 'https://us.api.inspect.aidefense.security.cisco.com');
        localStorage.setItem('vt_ai_defense_api_key', '');
        localStorage.setItem('vt_ai_defense_prompt_source', 'server');
        localStorage.removeItem('vt_ai_defense_rules');
        setStatusMessage({ type: 'success', text: "Database configuration restored to factory default successfully!" });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: "Failed to perform factory reset." });
      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    } finally {
      setResetting(false);
    }
  };

  // Saves AI Models Creds
  const handleSaveModelSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('vt_ai_selected_model', selectedModel);
    localStorage.setItem('vt_ai_agent_selected_model', agentSelectedModel);
    localStorage.setItem('vt_ai_openai_key', openaiKey);
    localStorage.setItem('vt_ai_groq_key', groqKey);
    localStorage.setItem('vt_ai_gemini_key', geminiKey);
    localStorage.setItem('vt_ai_aws_region', awsRegion);
    localStorage.setItem('vt_ai_aws_access_key', awsAccessKey);
    localStorage.setItem('vt_ai_aws_secret_key', awsSecretKey);
    localStorage.setItem('vt_ai_aws_custom_dns', awsCustomDns);

    localStorage.setItem('vt_agent_chart_updater_enabled', String(agentChartUpdaterEnabled));
    localStorage.setItem('vt_agent_triage_enabled', String(agentTriageEnabled));
    localStorage.setItem('vt_agent_chart_updater_interval_min', String(agentChartUpdaterIntervalMin));
    localStorage.setItem('vt_agent_triage_interval_min', String(agentTriageIntervalMin));
    localStorage.setItem('vt_agent_night_shift_only', String(agentNightShiftOnly));

    window.dispatchEvent(new Event('vt_settings_updated'));
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  // Saves Cisco AI Defense Guardrails directly without mandatory connection check blocking
  const handleSaveSecuritySettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('vt_ai_defense_enabled', String(aiDefenseEnabled));
    localStorage.setItem('vt_ai_defense_gateway', aiDefenseServer);
    localStorage.setItem('vt_ai_defense_mode', aiDefenseMode);
    localStorage.setItem('vt_ai_defense_server', aiDefenseServer);
    localStorage.setItem('vt_ai_defense_api_key', aiDefenseApiKey);
    localStorage.setItem('vt_ai_defense_prompt_source', aiDefensePromptSource);
    localStorage.setItem('vt_ai_defense_rules', JSON.stringify(aiDefenseRules));
    
    window.dispatchEvent(new Event('vt_settings_updated'));
    
    setDefenseTestStatus('success');
    setDefenseTestMessage('Success: Cisco AI Defense settings saved successfully!');
    
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setDefenseTestStatus('idle');
      setDefenseTestMessage('');
    }, 4000);
  };

  // Explicitly tests connectivity to Cisco Secure AI Defense via Inspect API
  const handleTestSecurityConnection = async () => {
    setDefenseTestStatus('testing');
    setDefenseTestMessage('Testing connectivity to Cisco AI Defense Inspect API...');
    
    try {
      const res = await fetch('/api/ai/test-defense', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gatewayUrl: aiDefenseServer,
          apiKey: aiDefenseApiKey
        })
      });
      const data = await res.json();
      
      if (data && data.success) {
        setDefenseTestStatus('success');
        setDefenseTestMessage(data.message || 'Verification Success: Cisco AI Defense inspect channel active!');
      } else {
        setDefenseTestStatus('error');
        setDefenseTestMessage(data.message || 'Connection Failed');
      }
    } catch (err: any) {
      setDefenseTestStatus('error');
      setDefenseTestMessage(`Connection Failed: ${err.message || 'Network Timeout'}`);
    }
  };

  // Saves Node URL Connectivity Settings without mode switches
  const handleSaveDeploymentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDeployment(true);

    const buildUrl = (ipOrFqdn: string) => {
      let val = ipOrFqdn.trim();
      if (!val) return 'http://localhost:3000';
      if (!/^https?:\/\//i.test(val)) {
        val = 'http://' + val;
      }
      if (!/:[0-9]+$/.test(val)) {
        val = val + ':3000';
      }
      return val;
    };

    const targetAppserverUrl = buildUrl(applicationServerUrl);
    const targetDbServerUrl = buildUrl(dbServerUrl);
    const targetAiBrokerUrl = buildUrl(aiBrokerUrl);

    // If designated as an AI broker or Database Server offline partition, test connectivity to Application Server first
    if (deploymentMode === 'distributed' && (nodeRole === 'dbserver' || nodeRole === 'aibroker')) {
      try {
        const checkRes = await fetch(`/api/system/check-peer?url=${encodeURIComponent(targetAppserverUrl)}`);
        const checkData = await checkRes.json();

        if (!checkData.success || checkData.status !== 'Online') {
          const proceedAnyway = window.confirm(
            `⚠️ Topology Validation Error!\n\nCould not establish connection to the designated Application Server at: ${targetAppserverUrl}\n\nPlease check that the target node is online, listening on port 3000, and firewall rules accept connections.\n\nDo you want to save the cluster settings anyway?`
          );
          if (!proceedAnyway) {
            setSavingDeployment(false);
            return;
          }
        }
      } catch (err: any) {
        const proceedAnyway = window.confirm(
          `⚠️ Connectivity Verification Failed!\n\nConnection check to Application Server failed with error: ${err.message}\n\nDo you want to save the cluster settings anyway?`
        );
        if (!proceedAnyway) {
          setSavingDeployment(false);
          return;
        }
      }

      const confirmGracefulRestart = window.confirm(
        `🛡️ Cisco Secure Workload - Microsegmentation Notice\n\nSetting this node as a designated downstream "${nodeRole.toUpperCase()}" will transition it to a restricted operating perimeter.\n\nThe node server will perform an automatic reboot to compile operational boundaries.\n\nFollowing reboot, UI access will be quarantined to settings and topology controls. Proceed with save and reboot?`
      );
      if (!confirmGracefulRestart) {
        setSavingDeployment(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/system/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: deploymentMode,
          role: nodeRole,
          appserver_url: targetAppserverUrl,
          dbserver_url: targetDbServerUrl,
          aibroker_url: targetAiBrokerUrl
        })
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);

        if (deploymentMode === 'distributed' && (nodeRole === 'dbserver' || nodeRole === 'aibroker')) {
          alert(`Dynamic configuration finalized! Issuing process reboot to "${nodeRole.toUpperCase()}" node...`);
          // Issue background reboot and reload
          await fetch('/api/system/restart', { method: 'POST' }).catch(() => {});
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          return;
        }

        await testConnectivity();
      } else {
        alert("Failed to save cluster configuration.");
      }
    } catch (err: any) {
      alert("Connectivity update failed: " + err.message);
    } finally {
      setSavingDeployment(false);
    }
  };

  // Dynamic Mode toggling (STANDALONE <-> DISTRIBUTED)
  const handleToggleModeSelection = async (targetMode: 'standalone' | 'distributed') => {
    setSwitchingMode(true);
    try {
      if (targetMode === 'standalone') {
        const confirmCopy = window.confirm("You are reverting to Standalone mode. The system will attempt to grab a complete copy of the database from the remote DB server to preserve current records. Proceed?");
        if (confirmCopy) {
          try {
            const dumpRes = await fetch(`${dbServerUrl}/api/system/db-dump`);
            if (dumpRes.ok) {
              const dbData = await dumpRes.json();
              const saveRes = await fetch('/api/system/db-dump-save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dbData })
              });
              if (saveRes.ok) {
                console.log("[VITALTRUST] Successfully backed up database and stored copy locally.");
              }
            } else {
              console.warn("DB Server returned non-ok status for DB fetch, performing fallback local preservation.");
            }
          } catch (fetchErr) {
            console.error("Failed fetching live copy of remote database. Will proceed back to local baseline.", fetchErr);
          }
        }
      }

      const buildUrl = (ipOrFqdn: string) => {
        let val = ipOrFqdn.trim();
        if (!val) return 'http://localhost:3000';
        if (!/^https?:\/\//i.test(val)) {
          val = 'http://' + val;
        }
        if (!/:[0-9]+$/.test(val)) {
          val = val + ':3000';
        }
        return val;
      };

      // Notify backend to change mode settings dynamically
      const configRes = await fetch('/api/system/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: targetMode,
          role: targetMode === 'standalone' ? 'standalone' : 'appserver',
          appserver_url: buildUrl(applicationServerUrl),
          dbserver_url: buildUrl(dbServerUrl),
          aibroker_url: buildUrl(aiBrokerUrl)
        })
      });

      if (configRes.ok) {
        setDeploymentMode(targetMode);
        if (targetMode === 'standalone') {
          setNodeRole('standalone');
        } else {
          setNodeRole('appserver');
        }
        // Live verify peer positions
        const nodeRes = await fetch('/api/system/nodes');
        const nodeData = await nodeRes.json();
        if (nodeData && nodeData.nodes) {
          setTopologyNodes(nodeData.nodes);
        }
        alert(`Successfully transitioned to ${targetMode.toUpperCase()} state. Config applied dynamically.`);
      } else {
        alert("Error applying active mode layout on server.");
      }
    } catch (err: any) {
      alert("Error executing dynamic layout swap: " + err.message);
    } finally {
      setSwitchingMode(false);
    }
  };

  // Test Node Connectivity check
  const testConnectivity = async () => {
    setTestingConnectivity(true);
    try {
      const res = await fetch('/api/system/nodes');
      if (res.ok) {
        const data = await res.json();
        if (data && data.nodes) {
          setTopologyNodes(data.nodes);
        }
      }
    } catch (e) {
      console.error("Failed testing nodes ping:", e);
    } finally {
      setTestingConnectivity(false);
    }
  };

  const assistantFamily = getModelFamily(selectedModel);
  const agentFamily = getModelFamily(agentSelectedModel);
  const bedrockCredentialsActive = assistantFamily === 'bedrock' || agentFamily === 'bedrock';
  const usesProvider = (family: 'openai' | 'groq' | 'gemini' | 'bedrock') =>
    assistantFamily === family || agentFamily === family;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="border-b border-red-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="text-[#7c1a1a]" size={22} />
            Central System Settings & Controls
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Configure target LLM models, Cisco Duo directory parameters, deployment schemas, and Cisco AI Defense guardrails.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider bg-red-50 text-[#7c1a1a] border border-red-100/60">
            System Mode: {deploymentMode.toUpperCase()}
          </span>
          <span className="px-3 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider bg-slate-900 text-white">
            Role: {user.role === 'admin' ? 'Administrator' : user.role.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Modern High-Contrast Tab Switcher */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/60 font-medium">
        <button
          onClick={() => { setActiveSubTab('deployment'); }}
          className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
            activeSubTab === 'deployment'
              ? 'bg-[#7c1a1a] text-white shadow-md shadow-red-950/20 border border-[#7c1a1a]'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
          }`}
        >
          <Network size={15} />
          DEPLOYMENT
        </button>

        <button
          onClick={() => { setActiveSubTab('model'); }}
          className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
            activeSubTab === 'model'
              ? 'bg-[#7c1a1a] text-white shadow-md shadow-red-950/20 border border-[#7c1a1a]'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
          }`}
        >
          <BrainCircuit size={15} />
          AI SETTINGS
        </button>

        <button
          onClick={() => { setActiveSubTab('security'); }}
          className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
            activeSubTab === 'security'
              ? 'bg-[#7c1a1a] text-white shadow-md shadow-red-950/20 border border-[#7c1a1a]'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
          }`}
        >
          <ShieldCheck size={15} />
          SECURITY CONTROLS
        </button>
      </div>

      {/* Tabs Subviews */}
      <div className="space-y-6">
        {/* Tab 1: AI Model Settings */}
        {activeSubTab === 'model' && (
          <form onSubmit={handleSaveModelSettings} className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-[#7c1a1a] to-[#a32d2d] text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <BrainCircuit size={22} className="text-red-100" />
                  <div>
                    <h4 className="text-sm font-bold tracking-wide uppercase">AI Model Configurations</h4>
                    <p className="text-[11px] text-red-100 mt-0.5">Map model parameters & secure authorization variables</p>
                  </div>
                </div>
                <span className="text-[10px] text-white/80 font-bold bg-white/10 px-3 py-1 rounded-md border border-white/20">
                  VPC BOUNDARY
                </span>
              </div>

              <div className="p-8 space-y-6">
                {/* AI Assistant model */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="text-xs font-black uppercase text-slate-700 tracking-wider">
                      AI Assistant Model
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      LLM for interactive human-driven consultations via the AI Assistant chatbot.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-[#fafafa] border border-slate-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 appearance-none focus:outline-none cursor-pointer pr-10"
                      >
                        {MODELS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                      <Sparkles className="text-amber-500" size={12} />
                      <span>Routing under </span>
                      <span className="font-extrabold text-[#7c1a1a] uppercase">{assistantFamily}</span>
                    </div>
                  </div>
                </div>

                {/* AI Agents model */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                      <Bot size={14} className="text-[#7c1a1a]" />
                      AI Agents Model
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      LLM for autonomous background agents (chart updater, overnight triage nurse).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <select
                        value={agentSelectedModel}
                        onChange={(e) => setAgentSelectedModel(e.target.value)}
                        className="w-full bg-[#fafafa] border border-slate-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 appearance-none focus:outline-none cursor-pointer pr-10"
                      >
                        {MODELS.map((m) => (
                          <option key={`agent-${m}`} value={m}>{m}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                      <Sparkles className="text-amber-500" size={12} />
                      <span>Agents routing under </span>
                      <span className="font-extrabold text-[#7c1a1a] uppercase">{agentFamily}</span>
                    </div>
                  </div>
                </div>

                {/* API Keys Configuration */}
                <div className="space-y-5">
                  <h5 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                    <Key size={14} className="text-[#7c1a1a]" />
                    API Credentials
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* OpenAI */}
                    <div className={`p-5 rounded-2xl border transition-all ${usesProvider('openai') ? 'border-[#7c1a1a] bg-red-50/15' : 'border-slate-100 bg-[#fafafa]'}`}>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-700">OpenAI API Key</label>
                        <div className="flex items-center gap-1.5">
                          {serverKeysConfig.openaiAvailable && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-extrabold uppercase border border-emerald-100">● .env Default</span>
                          )}
                          {usesProvider('openai') && (
                            <span className="text-[9px] bg-red-50 text-[#7c1a1a] px-1.5 py-0.5 rounded font-extrabold uppercase border border-red-100">Active</span>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type={showOpenaiKey ? "text" : "password"}
                          value={openaiKey}
                          onChange={(e) => setOpenaiKey(e.target.value)}
                          placeholder={serverKeysConfig.openaiAvailable ? "Using key from environment (.env) - enter text to override" : "sk-..."}
                          className="w-full bg-white border border-slate-200 focus:border-[#7c1a1a] rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-800 focus:outline-none transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showOpenaiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Provides backend capabilities for OpenAI GPT/o3 model suites.</p>
                    </div>

                    {/* Groq */}
                    <div className={`p-5 rounded-2xl border transition-all ${usesProvider('groq') ? 'border-[#7c1a1a] bg-red-50/15' : 'border-slate-100 bg-[#fafafa]'}`}>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-700">Groq API Key</label>
                        {usesProvider('groq') && (
                          <span className="text-[10px] bg-red-50 text-[#7c1a1a] px-2 py-0.5 rounded font-extrabold uppercase border border-red-100">Active</span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showGroqKey ? "text" : "password"}
                          value={groqKey}
                          onChange={(e) => setGroqKey(e.target.value)}
                          placeholder="gsk-..."
                          className="w-full bg-white border border-slate-200 focus:border-[#7c1a1a] rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-800 focus:outline-none transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGroqKey(!showGroqKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showGroqKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Pipes queries through LLAMA, Qwen, or Kimi styles.</p>
                    </div>

                    {/* Gemini */}
                    <div className={`p-5 rounded-2xl border transition-all ${usesProvider('gemini') ? 'border-[#7c1a1a] bg-red-50/15' : 'border-slate-100 bg-[#fafafa]'}`}>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-700">Gemini API Key</label>
                        <div className="flex items-center gap-1.5">
                          {serverKeysConfig.geminiAvailable && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-extrabold uppercase border border-emerald-100">● .env Default</span>
                          )}
                          {usesProvider('gemini') && (
                            <span className="text-[9px] bg-red-50 text-[#7c1a1a] px-1.5 py-0.5 rounded font-extrabold uppercase border border-red-100">Active</span>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type={showGeminiKey ? "text" : "password"}
                          value={geminiKey}
                          onChange={(e) => setGeminiKey(e.target.value)}
                          placeholder={serverKeysConfig.geminiAvailable ? "Using key from environment (.env) - enter text to override" : "AIzaSy..."}
                          className="w-full bg-white border border-slate-200 focus:border-[#7c1a1a] rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-800 focus:outline-none transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGeminiKey(!showGeminiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Official Google Gemini flash capabilities key binding.</p>
                    </div>
                  </div>
                </div>

                {/* AWS Bedrock Section */}
                <div className={`p-6 rounded-3xl border transition-all ${bedrockCredentialsActive ? 'border-[#7c1a1a] bg-red-50/15' : 'border-slate-200 bg-[#fafafa]'}`}>
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Database size={16} className="text-[#7c1a1a]" />
                      <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
                        AWS Bedrock Credentials
                      </span>
                      {bedrockCredentialsActive && (
                        <span className="text-[10px] bg-[#7c1a1a] text-white px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide">In Use</span>
                      )}
                      {serverKeysConfig.awsBedrockAvailable && (
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-extrabold uppercase border border-emerald-100">● .env Default</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowHowToIntegrate(true)}
                      className="text-[10px] text-[#7c1a1a] hover:underline font-extrabold flex items-center gap-1 transition-all"
                    >
                      <HelpCircle size={12} />
                      IAM Guide?
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Region */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-500 font-bold block">AWS Region</label>
                      <div className="relative">
                        <select
                          value={awsRegion}
                          onChange={(e) => setAwsRegion(e.target.value)}
                          className="w-full bg-white border border-slate-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2 text-xs text-slate-800 appearance-none focus:outline-none"
                        >
                          {REGIONS.map(reg => (
                            <option key={reg} value={reg}>{reg}</option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={14} />
                        </div>
                      </div>
                    </div>

                    {/* Custom DNS Name Optional */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-500 font-bold block">AWS Bedrock Custom DNS Name (Optional)</label>
                      <input
                        type="text"
                        value={awsCustomDns}
                        onChange={(e) => setAwsCustomDns(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>

                    {/* Access Key */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-500 font-bold block">AWS Access Key</label>
                      <div className="relative">
                        <input
                          type={showAwsAccessKey ? "text" : "password"}
                          value={awsAccessKey}
                          onChange={(e) => setAwsAccessKey(e.target.value)}
                          placeholder={serverKeysConfig.awsBedrockAvailable ? "Using key from environment (.env) - enter text to override" : "AKIA..."}
                          className="w-full bg-white border border-slate-200 focus:border-[#7c1a1a] rounded-xl pl-4 pr-10 py-2 text-xs text-slate-800 focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAwsAccessKey(!showAwsAccessKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showAwsAccessKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Secret Key */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-500 font-bold block">AWS Secret Key</label>
                      <div className="relative">
                        <input
                          type={showAwsSecretKey ? "text" : "password"}
                          value={awsSecretKey}
                          onChange={(e) => setAwsSecretKey(e.target.value)}
                          placeholder={serverKeysConfig.awsBedrockAvailable ? "Using secret from environment (.env) - enter text to override" : "Enter AWS Secret Key"}
                          className="w-full bg-white border border-slate-200 focus:border-[#7c1a1a] rounded-xl pl-4 pr-10 py-2 text-xs text-slate-800 focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAwsSecretKey(!showAwsSecretKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showAwsSecretKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Autonomous AI Agents */}
                <div className="p-6 rounded-3xl border border-slate-200 bg-[#fafafa] space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <Bot size={16} className="text-[#7c1a1a]" />
                      <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
                        Autonomous AI Agents
                      </span>
                    </div>
                    <span className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-extrabold uppercase">Phase 2</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Background agents run on the AI Broker without human chat input. Agent scheduler wiring ships in the next build — save preferences here now.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800">Chart Updater Agent</label>
                        <button
                          type="button"
                          onClick={() => setAgentChartUpdaterEnabled(!agentChartUpdaterEnabled)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${agentChartUpdaterEnabled ? 'bg-[#7c1a1a]' : 'bg-slate-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${agentChartUpdaterEnabled ? 'translate-x-5' : ''}`} />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">Periodically updates patient vitals and AI chart notes (simulated bedside nursing).</p>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase">Interval (minutes)</label>
                        <input
                          type="number"
                          min={5}
                          max={1440}
                          value={agentChartUpdaterIntervalMin}
                          onChange={(e) => setAgentChartUpdaterIntervalMin(Math.max(5, parseInt(e.target.value, 10) || 60))}
                          className="w-full bg-[#fafafa] border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-[#7c1a1a] focus:outline-none"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono">Identity: agent_chart_updater (local)</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800">Overnight Triage Agent</label>
                        <button
                          type="button"
                          onClick={() => setAgentTriageEnabled(!agentTriageEnabled)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${agentTriageEnabled ? 'bg-[#7c1a1a]' : 'bg-slate-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${agentTriageEnabled ? 'translate-x-5' : ''}`} />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">Monitors vitals and sends AI-crafted alerts to assigned nurses and doctors.</p>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase">Check interval (minutes)</label>
                        <input
                          type="number"
                          min={5}
                          max={120}
                          value={agentTriageIntervalMin}
                          onChange={(e) => setAgentTriageIntervalMin(Math.max(5, parseInt(e.target.value, 10) || 20))}
                          className="w-full bg-[#fafafa] border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-[#7c1a1a] focus:outline-none"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-[10px] text-slate-600 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agentNightShiftOnly}
                          onChange={(e) => setAgentNightShiftOnly(e.target.checked)}
                          className="rounded border-slate-300 text-[#7c1a1a] focus:ring-red-200"
                        />
                        Night shift window only (19:00 – 07:00)
                      </label>
                      <p className="text-[10px] text-slate-400 font-mono">Identity: agent_triage_nurse (local) · Duo mapping: pending</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold uppercase tracking-wide">
                  <Lock size={12} className="text-[#7c1a1a]" />
                  <span>Keys reside locally. No transmission outside model API targets.</span>
                </div>

                <div className="flex items-center gap-3">
                  <AnimatePresence>
                    {saveSuccess && (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 font-bold uppercase flex items-center gap-1.5"
                      >
                        <Check size={14} className="stroke-[3]" />
                        Settings Saved!
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    className="bg-[#7c1a1a] text-white hover:bg-red-900 border border-[#7c1a1a] px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-red-950/20 active:translate-y-px"
                  >
                    <Save size={14} />
                    Save Model Settings
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Deployment Topology Grid */}
        {activeSubTab === 'deployment' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Network size={22} className="text-red-400" />
                  <div>
                    <h4 className="text-sm font-bold tracking-wide uppercase">DISTRIBUTED DEPLOYMENT CONFIGURATION</h4>
                    <p className="text-[11px] text-gray-300 mt-0.5">Manage single-node standalone status and distributed node instances</p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Structure Form / Restricted Person Block */}
                {((nodeRole === 'dbserver' || nodeRole === 'aibroker') && !adminBypassRestricted) ? (
                  <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center max-w-xl mx-auto space-y-4">
                    <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center border border-amber-200">
                      <Shield size={24} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Restricted Local Persona</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        This host is currently operating in role-restricted capacity as a <span className="font-extrabold uppercase font-mono bg-slate-200/60 px-1 py-0.5 rounded text-slate-800">{nodeRole === 'dbserver' ? 'Database Server' : 'AI Broker'}</span>. 
                        Cluster-wide deployment architecture is centrally managed and must be configured from the **Application Server**.
                      </p>
                    </div>
                    {user.role === 'admin' && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setAdminBypassRestricted(true)}
                          className="px-4 py-2 bg-[#7c1a1a] hover:bg-red-850 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-all shadow-md cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <ShieldAlert size={14} />
                          Override Lockout (Unlock Config)
                        </button>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200/60 max-w-xs mx-auto">
                      <p className="text-[10px] font-mono text-slate-400">
                        Connected Application Server IP: {applicationServerUrl}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Mode Selector Option */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <div>
                        <label className="text-xs font-black uppercase text-slate-700 tracking-wider">
                          DEPLOYMENT ARCHITECTURE MODE
                        </label>
                        <p className="text-[10px] text-slate-400 mt-0.5">Choose between Single-Node Standalone or Multi-Node Posture Clustering.</p>
                      </div>
                      <div className="relative">
                        <select
                          value={deploymentMode}
                          onChange={(e) => handleToggleModeSelection(e.target.value as any)}
                          className="w-full bg-[#fafafa] border border-slate-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 appearance-none focus:outline-none cursor-pointer"
                        >
                          <option value="standalone">STANDALONE (Single Host)</option>
                          <option value="distributed">DISTRIBUTED DEPLOYMENT</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={14} />
                        </div>
                      </div>
                    </div>

                    {/* Dynamic config fields */}
                    {(deploymentMode === 'distributed') ? (
                      <form onSubmit={handleSaveDeploymentConfig} className="space-y-6 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Application server URL */}
                          <div className="space-y-1.5 animate-fadeIn">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                              Application Server IP / FQDN
                            </label>
                            <input
                              type="text"
                              value={applicationServerUrl}
                              onChange={(e) => setApplicationServerUrl(e.target.value)}
                              placeholder="Enter IP or FQDN"
                              className="w-full bg-[#fafafa] border border-slate-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none font-mono"
                              required
                            />
                          </div>

                          {/* Database server URL */}
                          <div className="space-y-1.5 animate-fadeIn">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                              Database Server IP / FQDN
                            </label>
                            <input
                              type="text"
                              value={dbServerUrl}
                              onChange={(e) => setDbServerUrl(e.target.value)}
                              placeholder="Enter IP or FQDN"
                              className="w-full bg-[#fafafa] border border-slate-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none font-mono"
                              required
                            />
                          </div>

                          {/* AI Broker URL */}
                          <div className="space-y-1.5 animate-fadeIn">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                              AI Broker IP / FQDN
                            </label>
                            <input
                              type="text"
                              value={aiBrokerUrl}
                              onChange={(e) => setAiBrokerUrl(e.target.value)}
                              placeholder="Enter IP or FQDN"
                              className="w-full bg-[#fafafa] border border-slate-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none font-mono"
                              required
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={savingDeployment}
                            className="bg-slate-900 text-white hover:bg-slate-800 border border-slate-900 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:translate-y-px text-center shadow"
                          >
                            <Save size={14} className={savingDeployment ? "animate-spin" : ""} />
                            {savingDeployment ? "SAVING CLUSTER CLOUD NETWORKS..." : "SAVE DEPLOYMENT TOPOLOGY"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center animate-fadeIn">
                        <p className="text-xs text-slate-500 font-medium">
                          Clustering configurations are inactive in **Standalone Mode**. Re-registering to distributed topology automatically delegates security policy synchronization.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Topology Live Node Map Section */}
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden space-y-6">
                    {/* Grid overlay for tech look */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(244,63,94,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(244,63,94,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
                    
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center relative z-10 gap-3">
                      <div>
                        <h5 className="text-[10px] font-black uppercase text-red-500 tracking-widest flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          ZTNA & Microsegmentation Mesh
                        </h5>
                        <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Interactive Infrastructure Node Map</h4>
                      </div>
                      
                      {/* Scan trigger button — distributed deployments only */}
                      {deploymentMode === 'distributed' && (
                        <button
                          type="button"
                          onClick={testConnectivity}
                          disabled={testingConnectivity}
                          className="text-[10px] bg-[#7c1a1a] text-white font-black uppercase tracking-widest border border-red-900/60 px-4 py-2 rounded-xl hover:bg-red-900 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-red-950/45 disabled:opacity-55 cursor-pointer max-w-max self-start sm:self-auto"
                        >
                          <Activity size={12} className={testingConnectivity ? "animate-spin" : ""} />
                          {testingConnectivity ? "Scanning System..." : "Test deployment connectivity"}
                        </button>
                      )}
                    </div>

                    {/* Infrastructure visual nodes diagram */}
                    {deploymentMode === 'standalone' ? (
                      <div className="flex justify-center items-center py-6 relative z-10 w-full">
                        <div className="w-full max-w-lg p-6 rounded-2xl bg-slate-900/90 border-2 border-emerald-500 shadow-xl shadow-emerald-950/20 text-center space-y-4 relative transition-all duration-300 hover:scale-[1.01]">
                          <span className="absolute -top-2.5 right-6 px-3 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-500 rounded-md text-[8px] font-black uppercase tracking-wider">
                            STANDALONE DEPLOYMENT
                          </span>
                          
                          <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 mb-1">
                            <Server size={24} />
                          </div>
                          
                          <div>
                            <h5 className="text-sm font-bold uppercase tracking-wider text-slate-100">Vital Trust Standalone Node</h5>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">Consolidated Host Services</p>
                          </div>

                          <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/85 space-y-1.5 text-left text-[10px] text-slate-300 font-medium font-sans">
                            <div className="flex justify-between border-b border-white/5 pb-1">
                              <span>Application Web Server:</span>
                              <span className="text-emerald-400 font-bold uppercase tracking-wide">Active (Secure Port 3000)</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-1">
                              <span>Health Records Database:</span>
                              <span className="text-slate-100 font-bold uppercase tracking-wide">Active (Local File DB)</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-1">
                              <span>AI Prompt Broker Service:</span>
                              <span className="text-slate-100 font-bold uppercase tracking-wide">Active (Unified Co-locator)</span>
                            </div>
                            <div className="flex justify-between">
                              <span>System Endpoint Routing:</span>
                              <span className="text-emerald-400 font-mono select-all overflow-hidden text-ellipsis max-w-[220px] whitespace-nowrap">
                                {applicationServerUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-center gap-2 text-[9px] font-bold uppercase pt-1 text-emerald-400">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-emerald-300" />
                            <span>System Status: Online & Secured</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center justify-center relative z-10 py-4">
                        
                        {/* Web Server node card */}
                        <div className="md:col-span-3">
                          <div className={`p-5 rounded-2xl bg-slate-900/90 border-2 ${
                            (topologyNodes?.appserver?.status === "Online" || deploymentMode === 'standalone')
                              ? 'border-emerald-500 shadow-md shadow-emerald-950/20'
                              : 'border-red-600 shadow-md shadow-red-950/20'
                          } text-center space-y-2 relative transition-all duration-300 hover:scale-[1.02]`}>
                            {(nodeRole === 'appserver' || nodeRole === 'standalone') && (
                              <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-red-900 text-white border border-red-500 rounded-md text-[8px] font-bold uppercase tracking-wider">
                                MY ROLE
                              </span>
                            )}
                            <div className="mx-auto w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 mb-1">
                              <Server size={18} />
                            </div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-200">Application Server</h5>
                            <p className="text-[9px] font-mono text-slate-400 select-all max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{applicationServerUrl}</p>
                            <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase pt-1">
                              <span className={`w-2 h-2 rounded-full ${
                                (topologyNodes?.appserver?.status === "Online" || deploymentMode === 'standalone') ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                              }`} />
                              <span className={(topologyNodes?.appserver?.status === "Online" || deploymentMode === 'standalone') ? 'text-emerald-400' : 'text-red-400'}>
                                {(topologyNodes?.appserver?.status === "Online" || deploymentMode === 'standalone') ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Web -> DB Connection lane */}
                        <div className="hidden md:block md:col-span-1 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-[8px] font-bold uppercase text-slate-500 tracking-wider mb-1">ZTNA</span>
                            <svg className="w-full h-4" viewBox="0 0 40 20" fill="none">
                              <path d="M0,10 L40,10" stroke="#334155" strokeWidth="2" strokeDasharray="3,3" />
                              <path d="M0,10 L40,10" 
                                stroke={(topologyNodes?.dbserver?.status === "Online" || deploymentMode === 'standalone') ? '#10b981' : '#dc2626'} 
                                strokeWidth="2" 
                                strokeDasharray="4,4"
                                style={{
                                  strokeDashoffset: 5,
                                  animation: "dash 1.2s linear infinite"
                                }}
                              />
                            </svg>
                          </div>
                        </div>

                        {/* Database server node card */}
                        <div className="md:col-span-3">
                          <div className={`p-5 rounded-2xl bg-slate-900/90 border-2 ${
                            (topologyNodes?.dbserver?.status === "Online" || deploymentMode === 'standalone')
                              ? 'border-emerald-500 shadow-md shadow-emerald-950/20'
                              : 'border-red-600 shadow-md shadow-red-950/20'
                          } text-center space-y-2 relative transition-all duration-300 hover:scale-[1.02]`}>
                            {nodeRole === 'dbserver' && (
                              <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-red-900 text-white border border-red-500 rounded-md text-[8px] font-bold uppercase tracking-wider">
                                MY ROLE
                              </span>
                            )}
                            <div className="mx-auto w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 mb-1">
                              <Database size={18} />
                            </div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-200">Database Server</h5>
                            <p className="text-[9px] font-mono text-slate-400 select-all max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{dbServerUrl}</p>
                            <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase pt-1">
                              <span className={`w-2 h-2 rounded-full ${
                                (topologyNodes?.dbserver?.status === "Online" || deploymentMode === 'standalone') ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                              }`} />
                              <span className={(topologyNodes?.dbserver?.status === "Online" || deploymentMode === 'standalone') ? 'text-emerald-400' : 'text-red-400'}>
                                {(topologyNodes?.dbserver?.status === "Online" || deploymentMode === 'standalone') ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* DB -> AI Connection lane */}
                        <div className="hidden md:block md:col-span-1 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-[8px] font-bold uppercase text-slate-500 tracking-wider mb-1">POLICY</span>
                            <svg className="w-full h-4" viewBox="0 0 40 20" fill="none">
                              <path d="M0,10 L40,10" stroke="#334155" strokeWidth="2" strokeDasharray="3,3" />
                              <path d="M0,10 L40,10" 
                                stroke={(topologyNodes?.aibroker?.status === "Online" || deploymentMode === 'standalone') ? '#10b981' : '#dc2626'} 
                                strokeWidth="2" 
                                strokeDasharray="4,4"
                                style={{
                                  strokeDashoffset: 5,
                                  animation: "dash 1.2s linear infinite"
                                }}
                              />
                            </svg>
                          </div>
                        </div>

                        {/* AI Broker Node card */}
                        <div className="md:col-span-3">
                          <div className={`p-5 rounded-2xl bg-slate-900/90 border-2 ${
                            (topologyNodes?.aibroker?.status === "Online" || deploymentMode === 'standalone')
                              ? 'border-emerald-500 shadow-md shadow-emerald-950/20'
                              : 'border-red-600 shadow-md shadow-red-950/20'
                          } text-center space-y-2 relative transition-all duration-300 hover:scale-[1.02]`}>
                            {nodeRole === 'aibroker' && (
                              <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-red-900 text-white border border-red-500 rounded-md text-[8px] font-bold uppercase tracking-wider">
                                MY ROLE
                              </span>
                            )}
                            <div className="mx-auto w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 mb-1">
                              <BrainCircuit size={18} />
                            </div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-200">AI Broker Node</h5>
                            <p className="text-[9px] font-mono text-slate-400 select-all max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{aiBrokerUrl}</p>
                            <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase pt-1">
                              <span className={`w-2 h-2 rounded-full ${
                                (topologyNodes?.aibroker?.status === "Online" || deploymentMode === 'standalone') ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                              }`} />
                              <span className={(topologyNodes?.aibroker?.status === "Online" || deploymentMode === 'standalone') ? 'text-emerald-400' : 'text-red-400'}>
                                {(topologyNodes?.aibroker?.status === "Online" || deploymentMode === 'standalone') ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* Operational legend & posture */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-bold text-slate-400 pt-4 border-t border-slate-800/80">
                      <div className="flex items-start gap-2 max-w-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 mt-1 shrink-0" />
                        <span className="leading-relaxed">
                          <strong>Cisco Secure Access (ZTNA)</strong> controls routing postures and isolates DB Server access to authorised agents only.
                        </span>
                      </div>
                      <div className="flex items-start gap-2 max-w-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500/80 mt-1 shrink-0" />
                        <span className="leading-relaxed">
                          <strong>Cisco Secure Workload</strong> segments local microservices to avoid cross-tenant clinical records scraping.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Factory Reset Section - Admin Only (Restricted on AI Broker Host) */}
            {user.role === 'admin' && !(deploymentMode === 'distributed' && nodeRole === 'aibroker') && (
              <div className="bg-white rounded-3xl border border-red-100 shadow-xl overflow-hidden">
                <div className="p-6 md:p-8 space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-[#7c1a1a] shrink-0 border border-red-100">
                      <RotateCcw size={22} className={resetting ? "animate-spin" : ""} />
                    </div>
                    <div className="space-y-1 block">
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">EHR Recovery & Baseline Database Wipe</h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                        Clear all live transactional database tables (patients history, clinical vitals logs, user credentials, schedules, prescriptions) and restore the system back to baseline clinical blueprint testing records. This action is irreversible.
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 flex items-start gap-3">
                    <span className="text-amber-600 font-bold text-xs shrink-0 pt-0.5">⚠️ WARNING:</span>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-bold">
                      This operation erases all OIDC credentials matched during SSO, discards administrative modifications, and resets system state tables for safety baselines. Use with extreme caution.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowFactoryResetModal(true)}
                      disabled={resetting}
                      className="bg-slate-900 text-white hover:bg-red-600 transition-all border border-slate-900 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow hover:border-red-600"
                    >
                      <RotateCcw size={14} className={resetting ? "animate-spin" : ""} />
                      {resetting ? "Performing Recovery..." : "Factory Reset Baseline Database"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Security Controls (Cisco AI Defense) */}
        {activeSubTab === 'security' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-slate-950 to-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={22} className="text-red-400" />
                  <div>
                    <h4 className="text-sm font-bold tracking-wide uppercase font-sans">Cisco AI defense controls</h4>
                    <p className="text-[11px] text-gray-300 mt-0.5">Inline Threat Protection, Guardrails & Policy Filters</p>
                  </div>
                </div>
                <span className="text-[9px] text-[#ff4c4c] bg-red-950/25 px-2.5 py-0.5 border border-[#7c1a1a]/40 rounded font-black uppercase tracking-wider">
                  ZTNA Shielded
                </span>
              </div>

              <div className="p-8 space-y-6">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 bg-[#7c1a1a]/5 rounded-xl flex items-center justify-center text-[#7c1a1a] border border-[#7c1a1a]/20 shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Threat Mitigation Gateway</h5>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed font-semibold">
                        Cisco AI Defense intercepts model prompt payloads. It protects operations against Prompt Injections, formatting traps, and leaks of protected clinical SSNs or patient metadata dynamically.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1.5 min-w-[170px] bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 text-right">
                      ENABLE AI DEFENSE GUARDRAILS
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !aiDefenseEnabled;
                        setAiDefenseEnabled(nextVal);
                        localStorage.setItem('vt_ai_defense_enabled', String(nextVal));
                        window.dispatchEvent(new Event('vt_settings_updated'));
                      }}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-all duration-300 focus:outline-none ${
                        aiDefenseEnabled ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-md cursor-pointer" />
                    </button>
                    <span className="text-[10px] text-slate-400 font-bold block text-right mt-1">
                      {aiDefenseEnabled ? "Route active via Cisco Portal" : "Bypass security / Send direct"}
                    </span>
                  </div>
                </div>

                {aiDefenseEnabled && (
                  <form onSubmit={handleSaveSecuritySettings} className="space-y-6">
                    <div className="border-t border-slate-100 pt-6">
                      <h5 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-3 bg-[#7c1a1a] rounded" />
                        AI Defense Settings
                      </h5>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
                        <div className="space-y-1.5">
                          <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                            Defense Mode
                          </label>
                          <select
                            value={aiDefenseMode}
                            onChange={(e) => setAiDefenseMode(e.target.value)}
                            className="w-full bg-[#fafafa] border border-slate-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none transition-all cursor-pointer"
                          >
                            <option value="Via API">Via API</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                            Select API Server
                          </label>
                          <select
                            value={
                              aiDefenseServer !== "https://us.api.inspect.aidefense.security.cisco.com" &&
                              aiDefenseServer !== "https://ap.api.inspect.aidefense.security.cisco.com" &&
                              aiDefenseServer !== "https://eu.api.inspect.aidefense.security.cisco.com" &&
                              aiDefenseServer !== "https://uae.api.inspect.aidefense.security.cisco.com"
                                ? "custom"
                                : aiDefenseServer
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "custom") {
                                setAiDefenseServer("https://");
                                setAiDefenseGateway("https://");
                              } else {
                                setAiDefenseServer(val);
                                setAiDefenseGateway(val);
                              }
                            }}
                            className="w-full bg-[#fafafa] border border-slate-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none transition-all cursor-pointer font-mono"
                          >
                            <option value="https://us.api.inspect.aidefense.security.cisco.com">US Server</option>
                            <option value="https://ap.api.inspect.aidefense.security.cisco.com">AP Server</option>
                            <option value="https://eu.api.inspect.aidefense.security.cisco.com">EU Server</option>
                            <option value="https://uae.api.inspect.aidefense.security.cisco.com">UAE Server</option>
                            <option value="custom">✍️ Custom Tenant Gateway URL...</option>
                          </select>
                        </div>

                        {aiDefenseServer !== "https://us.api.inspect.aidefense.security.cisco.com" &&
                          aiDefenseServer !== "https://ap.api.inspect.aidefense.security.cisco.com" &&
                          aiDefenseServer !== "https://eu.api.inspect.aidefense.security.cisco.com" &&
                          aiDefenseServer !== "https://uae.api.inspect.aidefense.security.cisco.com" && (
                            <div className="space-y-1.5 md:col-span-2">
                              <label className="text-[10px] font-black uppercase text-[#7c1a1a] tracking-wider flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-[#7c1a1a] rounded-full animate-pulse" />
                                Custom Cisco AI Defense Gateway URL (Specific Tenant Integration URL)
                              </label>
                              <input
                                type="text"
                                value={aiDefenseServer}
                                onChange={(e) => {
                                  setAiDefenseServer(e.target.value);
                                  setAiDefenseGateway(e.target.value);
                                }}
                                placeholder="https://<tenant-id>.<region>.api.inspect.aidefense.security.cisco.com"
                                className="w-full bg-[#fafafa] border border-rose-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2.5 text-xs text-slate-800 font-mono focus:outline-none transition-all"
                                required
                              />
                              <p className="text-[11px] text-slate-500 font-medium">
                                Check your Cisco AI Defense Administration portal settings to copy your exact endpoint integration URL (which usually includes your tenant subdomain).
                              </p>
                            </div>
                          )}

                        <div className="space-y-1.5 font-mono">
                          <label className="text-xs font-black uppercase font-sans text-slate-500 tracking-wider">
                            Cisco AI Defense API Key
                          </label>
                          <input
                            type="password"
                            value={aiDefenseApiKey}
                            onChange={(e) => setAiDefenseApiKey(e.target.value)}
                            placeholder="••••••••••••••••••••••••••••••••••••••••"
                            className="w-full bg-[#fafafa] border border-slate-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                            Prompt Sender Posture
                          </label>
                          <select
                            value={aiDefensePromptSource}
                            onChange={(e) => setAiDefensePromptSource(e.target.value)}
                            className="w-full bg-[#fafafa] border border-slate-200 focus:border-[#7c1a1a] rounded-xl px-4 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none transition-all cursor-pointer"
                          >
                            <option value="server">Send Prompt from Server itself</option>
                            <option value="browser">Send Prompt from Browser</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Rule policy definition matrix */}
                    <div className="space-y-4">
                      <div>
                        <h6 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                          Enabled Rules
                        </h6>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">Toggle dynamic safety triggers on or off and configure response postures</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-w-4xl">
                        {Object.entries(aiDefenseRules).map(([ruleName, ruleConfig]) => {
                          const typedRule = ruleConfig as { enabled: boolean; action: 'Ignore' | 'Block' | 'Alert' };
                          const isChecked = typedRule.enabled;
                          const action = typedRule.action;

                          // Dynamic background class based on action and checked state
                          let bgClass = "bg-[#fafafa] border-slate-100 hover:border-slate-200 text-slate-600";
                          let selectClass = "bg-white text-slate-700 border-slate-200 focus:border-slate-300";
                          let checkboxAccent = "accent-slate-500";
                          
                          if (isChecked) {
                            if (action === 'Ignore') {
                              bgClass = "bg-emerald-600 text-white border-transparent shadow shadow-emerald-500/25";
                              selectClass = "bg-emerald-700 text-white border-transparent focus:ring-0";
                              checkboxAccent = "accent-emerald-400";
                            } else if (action === 'Block') {
                              bgClass = "bg-red-600 text-white border-transparent shadow shadow-red-500/25";
                              selectClass = "bg-red-700 text-white border-transparent focus:ring-0";
                              checkboxAccent = "accent-red-400";
                            } else if (action === 'Alert') {
                              bgClass = "bg-orange-500 text-white border-transparent shadow shadow-orange-500/25";
                              selectClass = "bg-orange-650 text-white border-transparent focus:ring-0";
                              checkboxAccent = "accent-orange-400";
                            }
                          }

                          return (
                            <div
                              key={ruleName}
                              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${bgClass}`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    setAiDefenseRules((prev) => ({
                                      ...prev,
                                      [ruleName]: { ...prev[ruleName], enabled: e.target.checked }
                                    }));
                                  }}
                                  className={`w-4 h-4 cursor-pointer rounded border-slate-300 focus:ring-0 ${checkboxAccent}`}
                                />
                                <span className="text-xs font-bold uppercase tracking-wider">
                                  {ruleName}
                                </span>
                              </div>
                              <select
                                value={action}
                                disabled={!isChecked}
                                onChange={(e) => {
                                  setAiDefenseRules((prev) => ({
                                    ...prev,
                                    [ruleName]: { ...prev[ruleName], action: e.target.value as any }
                                  }));
                                }}
                                className={`text-[11px] font-bold rounded-lg px-2.5 py-1.5 border focus:outline-none transition-all ${
                                  !isChecked ? 'opacity-40 bg-slate-100 text-slate-400 cursor-not-allowed' : 'cursor-pointer'
                                } ${selectClass}`}
                              >
                                <option value="Ignore">Ignore</option>
                                <option value="Block">Block</option>
                                <option value="Alert">Alert</option>
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                      {defenseTestMessage && (
                        <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                          defenseTestStatus === 'testing' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                          defenseTestStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {defenseTestStatus === 'testing' && <Loader2 className="animate-spin w-4 h-4 shrink-0" />}
                          {defenseTestStatus === 'success' && <Shield className="w-4 h-4 shrink-0 text-emerald-600" />}
                          {defenseTestStatus === 'error' && <Shield className="w-4 h-4 shrink-0 text-rose-600" />}
                          <span>{defenseTestMessage}</span>
                        </div>
                      )}
                      <div className="flex justify-end gap-3.5">
                        <button
                          type="button"
                          disabled={defenseTestStatus === 'testing'}
                          onClick={handleTestSecurityConnection}
                          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border transition-all shadow-md active:translate-y-px cursor-pointer ${
                            defenseTestStatus === 'testing' ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed shadow-none' :
                            'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                          }`}
                        >
                          <Shield size={14} className={defenseTestStatus === 'testing' ? 'animate-pulse text-amber-500' : 'text-slate-500'} />
                          {defenseTestStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                        </button>

                        <button
                          type="submit"
                          disabled={defenseTestStatus === 'testing'}
                          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:translate-y-px cursor-pointer ${
                            defenseTestStatus === 'testing' ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed shadow-none' :
                            'bg-[#7c1a1a] text-white hover:bg-red-800 border border-[#7c1a1a] shadow-red-950/20'
                          }`}
                        >
                          <Save size={14} />
                          Save AI Defense Settings
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Attack vs Defense Security Matrix */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                Threat Matrix: Attack vector vs Cisco Defense policy
              </h4>
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-4">Attack Vector Description</th>
                      <th className="p-4">Secure Threat Outcome</th>
                      <th className="p-4">Cisco Security Control Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600 font-medium font-semibold">
                    <tr>
                      <td className="p-4 font-bold text-slate-700">Prompt Hijack / Injection</td>
                      <td className="p-4">Malicious prompt neutralized. System disclaimer applied.</td>
                      <td className="p-4"><span className="bg-amber-100/60 text-amber-800 px-2 py-0.5 rounded text-[10px] font-black uppercase">Cisco AI Defense Inspection</span></td>
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-slate-700">Protected Patient PII Leak</td>
                      <td className="p-4">Scanning triggers DLPs; intercepts social security numbers.</td>
                      <td className="p-4"><span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-black uppercase">DLP Scanning Shield</span></td>
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-slate-700">High-Risk SQL Injection</td>
                      <td className="p-4">Isolated remote dbserver routes prevent query parameters leaks.</td>
                      <td className="p-4"><span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[10px] font-black uppercase">ZTNA Isolation connector</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Guide details popup modal */}
      <AnimatePresence>
        {showHowToIntegrate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 max-w-lg w-full space-y-5"
            >
              <div className="flex items-center justify-between border-b border-light pb-3">
                <div className="flex items-center gap-2 text-slate-800 font-black uppercase text-xs tracking-wider">
                  <ShieldCheck className="text-red-700" size={20} />
                  AWS Bedrock Integration Guide
                </div>
                <button
                  type="button"
                  onClick={() => setShowHowToIntegrate(false)}
                  className="text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-slate-600 text-xs leading-relaxed font-semibold">
                <div>
                  <h5 className="font-bold text-slate-800 text-sm mb-1">1. Configure IAM policies</h5>
                  <p>
                    Assign a granular Invoke Model policy to an IAM user in your AWS account. Ensure Bedrock permissions (`bedrock:InvokeModel`) are enabled for your selected Claude or Nova models.
                  </p>
                </div>
                
                <div>
                  <h5 className="font-bold text-slate-800 text-sm mb-1">2. Paste Security Credentials</h5>
                  <p>
                    Enter your <strong>AWS Access Key</strong> and <strong>AWS Secret Key</strong> into the fields on the left. These keys reside only in ephemeral browser localStorage and are processed end-to-end.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-slate-800 text-sm mb-1">3. VPC Microsegmentation (Cisco Secure Workload)</h5>
                  <p>
                    Ensure your container workspace allows outgoing endpoint traffic to `bedrock-runtime.*.amazonaws.com`.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-slate-800 text-sm mb-1">4. Zero Trust Proxy DNS (Cisco Secure Access)</h5>
                  <p>
                    Piping model inference queries through a secure corporate proxy helps protect telemetry logs and mask patient SSN metadata. Use the optional Custom DNS input to route traffic securely.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowHowToIntegrate(false)}
                  className="bg-[#7c1a1a] text-slate-100 hover:bg-red-900 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all"
                >
                  Understood
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showFactoryResetModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 max-w-md w-full space-y-6 animate-scaleUp">
              <div className="flex items-center gap-3 text-red-600">
                <RotateCcw size={28} className="animate-spin-slow text-red-600" />
                <h3 className="text-xl font-bold tracking-tight text-slate-900">Factory Reset Baseline Database?</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-bold">
                You are about to reset the dynamic configuration database to factory default. This will completely wipe all authentication logs, clinician edits, clinical histories, and reload pure default records.
              </p>
              <div className="text-xs text-red-600 font-bold bg-red-50 p-3 rounded-xl border border-red-100">
                ⚠️ WARNING: This action is destructive and cannot be undone. Active user sessions will be logged out.
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setShowFactoryResetModal(false)} 
                  className="px-5 py-2.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleFactoryReset} 
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-500/20 transition-all cursor-pointer"
                >
                  Confirm Factory Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {statusMessage && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 max-w-sm w-full text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Check size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-950">System Restored</h3>
              <p className="text-xs text-slate-600 font-medium">{statusMessage.text}</p>
              <p className="text-[10px] text-slate-400 font-mono italic">Rebooting application node...</p>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
