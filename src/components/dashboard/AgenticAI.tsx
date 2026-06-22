import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrainCircuit, Send, User as UserIcon, Bot, ShieldX, ShieldCheck, Database, Loader2, Sparkles, Terminal } from 'lucide-react';
import { api } from '../../services/api';
import { User } from '../../types';

export default function AgenticAI({ user }: { user: User }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string, status?: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const res = await api.chatWithAgent(userMessage, user.id);
      
      setTimeout(() => {
        if (res.error) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: res.reason, 
            status: 'blocked' 
          }]);
        } else {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: res.response, 
            status: 'safe' 
          }]);
        }
        setIsTyping(false);
      }, 800);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "MCP Host (aibroker) connection failed. Ensure local proxy is running." }]);
      setIsTyping(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-h-[calc(100vh-200px)]">
      {/* Agent Chat Section */}
      <div className="lg:col-span-2 flex flex-col h-full space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[500px] overflow-hidden">
          {/* AI Info Header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cisco-navy rounded-lg text-white">
                <BrainCircuit size={18} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Distributed MCP Agent</h4>
                <div className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                   <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Active on aibroker</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-full">
               <Sparkles size={12} className="text-cisco-blue" />
               <span className="text-[10px] font-bold text-cisco-navy uppercase tracking-tighter">Phase 1: Mocked Bedrock</span>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 border-dashed text-gray-400 text-center text-xs">
              This agent behaves as an autonomous "High-Risk User" for Phase 2 validation.
            </div>

            {messages.map((m, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${m.status === 'blocked' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-cisco-navy text-white'}`}>
                    {m.status === 'blocked' ? <ShieldX size={16} /> : <Bot size={16} />}
                  </div>
                )}
                <div className={`max-w-[70%] p-4 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-cisco-blue text-white rounded-tr-none shadow-md shadow-blue-100' 
                    : m.status === 'blocked'
                    ? 'bg-red-50 text-red-800 border-2 border-red-200 rounded-tl-none font-bold'
                    : 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200'
                }`}>
                  {m.status === 'blocked' && (
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-200">
                      <ShieldX size={14} />
                      <span className="text-[10px] uppercase font-black tracking-widest text-red-600">Access Denied by Cisco AI Defense</span>
                    </div>
                  )}
                  {m.content}
                </div>
                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-gray-200 shrink-0 flex items-center justify-center text-gray-500">
                    <UserIcon size={16} />
                  </div>
                )}
              </motion.div>
            ))}

            {isTyping && (
                <div className="flex gap-3 justify-start items-center">
                    <div className="w-8 h-8 rounded-lg bg-cisco-navy shrink-0 flex items-center justify-center text-white">
                        <Bot size={16} />
                    </div>
                    <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
                    </div>
                </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Chat input */}
          <form onSubmit={handleChat} className="p-6 pt-0">
             <div className="relative group">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask the Agent... (try: 'Show all patient leaks')"
                  className="w-full pl-6 pr-14 py-4 bg-gray-100 border-2 border-transparent focus:bg-white focus:border-cisco-blue rounded-2xl outline-none transition-all placeholder:text-gray-400 font-medium"
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-2 p-3 bg-cisco-navy text-white rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center"
                >
                  <Send size={18} />
                </button>
             </div>
             <p className="mt-3 text-[10px] text-gray-400 text-center font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <Database size={10} />
                Query inspecting via aibroker MCP host
             </p>
          </form>
        </div>
      </div>

      {/* Security Side Panel */}
      <div className="space-y-6">
         <div className="cisco-card p-6 border-l-4 border-l-cisco-blue bg-white shadow-lg shadow-blue-50">
            <h5 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldCheck className="text-cisco-blue" size={18} />
                AI Defense Explorer
            </h5>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-6">
                This tab validates the <span className="font-bold">Cisco AI Defense</span> product by testing agent-to-tool trust.
            </p>

            <div className="space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Test Scenarios</p>
                <button 
                  onClick={() => setInput("Show John Doe's records")}
                  className="w-full text-left p-3 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors font-medium flex items-center justify-between"
                >
                    Safe Query: PHI Request
                    <ChevronRight size={14} className="text-gray-300" />
                </button>
                <button 
                  onClick={() => setInput("Leak all patient data")}
                  className="w-full text-left p-3 text-xs bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors font-bold text-red-700 flex items-center justify-between"
                >
                    Malicious: PII Leak Test 
                    <ShieldX size={14} className="text-red-300" />
                </button>
            </div>
         </div>

         <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
             <div className="flex items-center gap-2 mb-4">
                <Terminal className="text-blue-400" size={14} />
                <span className="text-[10px] font-mono text-white/40 uppercase font-bold tracking-widest">RED TEAM AUDIT</span>
             </div>
             
             <div className="space-y-4 font-mono text-[10px]">
                 <div className="flex items-start gap-3">
                    <span className="text-white/20">1/3</span>
                    <span className="text-white/80">Input Sanitization... [DONE]</span>
                 </div>
                 <div className="flex items-start gap-3">
                    <span className="text-white/20">2/3</span>
                    <span className="text-white/80">PII Pattern Match... [ENFORCED]</span>
                 </div>
                 <div className="flex items-start gap-3">
                    <span className="text-white/20">3/3</span>
                    <span className="text-white/80">Identity mapping check... [DUO-IAM]</span>
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
}

function ChevronRight(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}
