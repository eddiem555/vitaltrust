import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Send, Bot, Database, Sparkles, User as UserIcon, Lock, Key, Settings, AlertTriangle, RotateCcw } from 'lucide-react';
import { User } from '../../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function getModelFamily(model: string): 'openai' | 'groq' | 'gemini' | 'bedrock' {
  const m = model.toLowerCase();
  if (m.includes('openai') || m.startsWith('o3')) return 'openai';
  if (m.includes('llama') || m.includes('qwen') || m.includes('kimi')) return 'groq';
  if (m.includes('gemini')) return 'gemini';
  if (m.includes('bedrock')) return 'bedrock';
  return 'openai';
}

const getInitialMessage = (u: User) => {
  const clinicalExamples: Record<string, string> = {
    admin: `* "Query the audit logs for recent high-risk SSO logins"
* "List the active Vital Trust users"
* "How many appointments do we have in August?"`,
    doctor: `* "Perform a clinical deep dive on patient profile patient1"
* "Prescribe lisinopril 10mg once daily to patient patient1"
* "Provide a summary of my current assigned patient roster"`,
    nurse: `* "Give me a roster of patients on my ward"
* "Record new vital signs for patient patient1: HR: 78, Temp: 98.4, BP: 120/80"
* "Show the bedside medication schedules for patient patient1"`,
    patient: `* "What medications are in my current health regime?"
* "Do I have any upcoming appointments scheduled?"
* "What were my last checked lab results and vitals?"`
  };
  const examples = clinicalExamples[u.role] || clinicalExamples.patient;
  const roleLabel =
    u.role === 'admin' ? 'Administrator' :
    u.role === 'doctor' ? `Dr. ${u.realName}` :
    u.role === 'nurse' ? `Nurse ${u.realName}` :
    u.realName;

  return `Hello ${roleLabel}! I am your Vital Trust Virtual Health Assistant with MCP Tool Integration.

I can help with Vital Trust data via secure MCP tools and general inquires.

Examples:
${examples}
* "Tell me how AI works in a few of paragraphs."`;
};

function clearAllAiChatHistory() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('vt_ai_chat_')) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export default function VitalTrustAIChatbot({ user }: { user: User; key?: string }) {
  // Load configuration from localStorage
  const [selectedModel, setSelectedModel] = useState<string>('OpenAI GPT-5');
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [groqKey, setGroqKey] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [awsRegion, setAwsRegion] = useState<string>('us-east-1');
  const [awsAccessKey, setAwsAccessKey] = useState<string>('');
  const [awsSecretKey, setAwsSecretKey] = useState<string>('');
  const [awsCustomDns, setAwsCustomDns] = useState<string>('null');
  const [aiDefenseEnabled, setAiDefenseEnabled] = useState<boolean>(false);

  // Server credentials configuration availability
  const [serverKeysConfig, setServerKeysConfig] = useState<{
    geminiAvailable: boolean;
    openaiAvailable: boolean;
    activeProvider: string;
  }>({
    geminiAvailable: false,
    openaiAvailable: false,
    activeProvider: 'local'
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatBootSynced, setChatBootSynced] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initially on mount — sync boot id so redeploys clear stale browser chat history
  useEffect(() => {
    setSelectedModel(localStorage.getItem('vt_ai_selected_model') || 'OpenAI GPT-5');
    setOpenaiKey(localStorage.getItem('vt_ai_openai_key') || '');
    setGroqKey(localStorage.getItem('vt_ai_groq_key') || '');
    setGeminiKey(localStorage.getItem('vt_ai_gemini_key') || '');
    setAwsRegion(localStorage.getItem('vt_ai_aws_region') || 'us-east-1');
    setAwsAccessKey(localStorage.getItem('vt_ai_aws_access_key') || '');
    setAwsSecretKey(localStorage.getItem('vt_ai_aws_secret_key') || '');
    setAwsCustomDns(localStorage.getItem('vt_ai_aws_custom_dns') || 'null');
    setAiDefenseEnabled(localStorage.getItem('vt_ai_defense_enabled') === 'true');

    fetch('/api/ai/config')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          setServerKeysConfig({
            geminiAvailable: !!data.geminiAvailable,
            openaiAvailable: !!data.openaiAvailable,
            activeProvider: data.activeProvider || 'local'
          });
          const bootId = data.bootInstanceId as string | undefined;
          if (bootId) {
            const storedBootId = localStorage.getItem('vt_boot_instance_id');
            if (storedBootId !== bootId) {
              clearAllAiChatHistory();
              localStorage.setItem('vt_boot_instance_id', bootId);
            }
          }
        }
        setChatBootSynced(true);
      })
      .catch(err => {
        console.error('Error fetching server config:', err);
        setChatBootSynced(true);
      });
  }, []);

  useEffect(() => {
    const updateDefenseState = () => {
      setAiDefenseEnabled(localStorage.getItem('vt_ai_defense_enabled') === 'true');
    };
    window.addEventListener('storage', updateDefenseState);
    window.addEventListener('vt_settings_updated', updateDefenseState);
    return () => {
      window.removeEventListener('storage', updateDefenseState);
      window.removeEventListener('vt_settings_updated', updateDefenseState);
    };
  }, []);

  // Messages State loaded dynamically from localStorage depending on the active user identity
  const [messages, setMessages] = useState<Message[]>([]);

  // Synchronize and load/reload the correct message stream whenever the authenticated user ID switches
  useEffect(() => {
    if (!chatBootSynced) return;
    try {
      const stored = localStorage.getItem(`vt_ai_chat_${user.id}`);
      if (stored) {
        setMessages(JSON.parse(stored));
      } else {
        setMessages([
          {
            role: 'assistant',
            content: getInitialMessage(user)
          }
        ]);
      }
    } catch (e) {
      console.error('Error loading chat history from localStorage:', e);
    }
  }, [user.id, user.realName, chatBootSynced]);

  // Keep a ref of the loaded active user to prevent leakage of stale state during unmount/transition periods
  const prevUserId = useRef(user.id);

  // Save messages to local storage, carefully guarded against user.id mismatch/stale overwrites
  useEffect(() => {
    if (prevUserId.current !== user.id) {
      // The user session has flipped; prevent any execution that commits the old session's logs to the new user ID.
      prevUserId.current = user.id;
      return;
    }

    if (messages.length === 0) return;

    try {
      localStorage.setItem(`vt_ai_chat_${user.id}`, JSON.stringify(messages));
    } catch (e) {
      console.error('Error saving chat history to localStorage:', e);
    }
  }, [messages, user.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Check if chosen model has required API credentials
  const activeFamily = getModelFamily(selectedModel);
  let isConfigured = false;
  if (activeFamily === 'openai') {
    isConfigured = openaiKey.trim().length > 0 || serverKeysConfig.openaiAvailable;
  } else if (activeFamily === 'groq') {
    isConfigured = groqKey.trim().length > 0;
  } else if (activeFamily === 'gemini') {
    isConfigured = geminiKey.trim().length > 0 || serverKeysConfig.geminiAvailable;
  } else if (activeFamily === 'bedrock') {
    isConfigured = awsAccessKey.trim().length > 0 && awsSecretKey.trim().length > 0 && awsRegion.trim().length > 0;
  }

  const sendPrompt = async (userMsg: string) => {
    if (!userMsg.trim() || isTyping || !isConfigured) return;

    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const historyToPass = messages
        .slice(-10)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMsg,
          history: historyToPass,
          selectedModel: selectedModel,
          apiKeys: {
            openaiKey,
            groqKey,
            geminiKey,
            awsRegion,
            awsAccessKey,
            awsSecretKey,
            awsCustomDns
          },
          userId: user.id,
          userName: user.realName,
          userRole: user.role,
          aiDefenseEnabled: aiDefenseEnabled,
          aiDefenseGateway: localStorage.getItem('vt_ai_defense_gateway') || 'https://us.api.inspect.aidefense.security.cisco.com',
          aiDefenseApiKey: localStorage.getItem('vt_ai_defense_api_key') || '',
          aiDefensePromptSource: localStorage.getItem('vt_ai_defense_prompt_source') || 'server',
          aiDefenseRules: (() => {
            const rulesStr = localStorage.getItem('vt_ai_defense_rules');
            if (rulesStr) {
              try {
                return JSON.parse(rulesStr);
              } catch (e) {
                return null;
              }
            }
            return null;
          })()
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP Error ${response.status}`);
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response
      }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Failed to generate AI response: ${err.message || 'Connecting error'}. Please verify your API Key credentials on the Settings page and try again.`
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping || !isConfigured) return;

    const userMsg = input.trim();
    setInput('');
    await sendPrompt(userMsg);
  };

  const handleRepeatPrompt = async (prompt: string) => {
    await sendPrompt(prompt);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="border-b border-red-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">
            Virtual Health Assistant
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1">
            General AI assistance plus secure MCP access to Vital Trust clinical and operational data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider ${
            isConfigured 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              : 'bg-red-50 text-[#7c1a1a] border border-red-100'
          }`}>
            {isConfigured ? '● Active Care Channel' : '⚠️ Configuration Required'}
          </span>
        </div>
      </div>

      {!isConfigured ? (
        /* Configuration alert card matching corporate shades of red theme */
        <div className="bg-white rounded-3xl border border-red-100 shadow-xl overflow-hidden max-w-2xl mx-auto">
          <div className="p-6 bg-gradient-to-r from-[#7c1a1a] to-[#a32d2d] text-white flex items-center gap-3">
            <AlertTriangle size={24} className="text-red-100 animate-pulse" />
            <div>
              <h4 className="text-sm font-bold tracking-wide uppercase">AI Assistant Inactive</h4>
              <p className="text-[11px] text-red-100 mt-0.5">Credentials or engine settings are unconfigured</p>
            </div>
          </div>
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-[#7c1a1a] shadow-sm mx-auto">
              <Key size={26} />
            </div>
            <div className="space-y-2">
              <h4 className="text-base font-extrabold text-[#7c1a1a]">
                Credentials Setup Required
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                To activate your secure Virtual Assistant, please configure your model target and provide the associated credentials in the central <span className="font-extrabold text-[#7c1a1a]">Settings</span> page.
              </p>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 max-w-md mx-auto flex items-start gap-3 text-left text-xs text-blue-800 leading-relaxed">
              <Database size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>System Guidance:</strong> You can quickly reach the set up console by clicking on the <strong>Settings</strong> link right under the <strong>AI Assistant</strong> catalog in the left sidebar menu.
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Full-width active clinical chatbot stream */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl flex flex-col overflow-hidden h-[68vh] min-h-[500px]">
          
          {/* Header Action Stream Bar */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Secure Channel - {selectedModel}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const welcomeMsg = [
                    {
                      role: 'assistant' as const,
                      content: getInitialMessage(user)
                    }
                  ];
                  setMessages(welcomeMsg);
                  try {
                    localStorage.setItem(`vt_ai_chat_${user.id}`, JSON.stringify(welcomeMsg));
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="text-[10px] text-[#7c1a1a] hover:text-red-900 font-black uppercase tracking-widest bg-red-50 hover:bg-red-100/70 border border-red-100 px-3 py-1.5 rounded-lg transition-all"
              >
                Reset Chat
              </button>
            </div>
          </div>

          {/* Message Panel */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 shrink-0 flex items-center justify-center text-[#7c1a1a] shadow-sm">
                    <Bot size={18} />
                  </div>
                )}
                
                {(() => {
                  const isViolation = m.role === 'assistant' && (
                    m.content.startsWith('Violation detected:') || 
                    m.content.startsWith('POLICY VIOLATION:')
                  );

                  if (isViolation) {
                    const lines = m.content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                    let violations = lines.slice(1);
                    if (violations.length === 0 && m.content.startsWith('POLICY VIOLATION:')) {
                      violations = [m.content.replace('POLICY VIOLATION:', '').trim()];
                    }

                    return (
                      <div className="flex flex-col gap-3 w-full max-w-xl my-1">
                        {violations.map((violation, vidx) => (
                          <div 
                            key={vidx}
                            id={`violation-card-${vidx}`}
                            className="bg-[#c91818] text-white px-5 py-4 rounded-xl flex items-center gap-4 shadow-lg border border-red-800 hover:shadow-xl transition-all"
                          >
                            {/* Left indicator bulb */}
                            <div className="w-8 h-8 rounded-full bg-[#822121] border border-red-900/30 flex-shrink-0 shrink-0" />
                            <div className="text-left space-y-0.5">
                              <div className="text-[10.5px] text-red-200/90 font-bold uppercase tracking-widest leading-none">
                                Violation detected:
                              </div>
                              <div className="text-xs font-bold font-mono uppercase tracking-wider leading-relaxed">
                                {violation}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  return (
                    <div className={`max-w-[75%] p-5 rounded-2xl text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#7c1a1a] text-white rounded-tr-none shadow-lg shadow-red-950/5'
                        : 'bg-slate-50 border border-slate-100 rounded-tl-none whitespace-pre-line'
                    } ${m.role === 'user' ? 'flex items-start gap-3' : ''}`}>
                      {m.role === 'user' && (
                        <button
                          type="button"
                          onClick={() => handleRepeatPrompt(m.content)}
                          disabled={isTyping}
                          title="Repeat this prompt"
                          aria-label="Repeat this prompt"
                          className="shrink-0 mt-0.5 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      <div className={m.role === 'user' ? 'flex-1' : undefined}>{m.content}</div>
                    </div>
                  );
                })()}

                {m.role === 'user' && (
                  <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-600 font-semibold uppercase text-xs">
                    <UserIcon size={14} />
                  </div>
                )}
              </motion.div>
            ))}

            {isTyping && (
              <div className="flex gap-3 justify-start items-center">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 text-[#7c1a1a] flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div className="flex gap-1 bg-slate-50 border border-slate-100 px-4 py-3.5 rounded-2xl">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            
            <div ref={scrollRef} />
          </div>

          {/* Form panel */}
          <form onSubmit={handleSend} className="p-6 border-t border-slate-100 bg-slate-50/35">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask Vital Trust virtual assistant...`}
                className="w-full pl-6 pr-16 py-4 bg-white border border-slate-200 focus:border-[#7c1a1a] focus:shadow-md focus:shadow-red-50/50 rounded-2xl outline-none transition-all placeholder:text-slate-400 font-medium text-sm text-slate-800"
              />
              <button
                type="submit"
                className="absolute right-2.5 p-3 bg-[#7c1a1a] text-white rounded-xl hover:bg-red-900 transition-all flex items-center justify-center shadow-md shadow-red-950/10 animate-fade-in"
              >
                <Send size={16} />
              </button>
            </div>
            
            {aiDefenseEnabled && (
              <p className="mt-3 text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
                <Sparkles className="text-amber-500 animate-pulse" size={12} />
                Protected by Cisco AI Defense guardrails
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
