import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, Inbox, Mail, Shield, X, Trash2, RefreshCcw } from 'lucide-react';
import { User, ChatMessage } from '../../types';
import { api } from '../../services/api';
import { canSendMessage } from '../../messaging-rules';

interface MessagesPanelProps {
  user: User;
}

type DirectoryUser = Pick<User, 'id' | 'role' | 'realName'>;

export default function MessagesPanel({ user }: MessagesPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allUsers, setAllUsers] = useState<DirectoryUser[]>([]);
  const [filter, setFilter] = useState<'all' | 'inbox' | 'sent'>('all');
  const [showCompose, setShowCompose] = useState(false);
  const [compose, setCompose] = useState({ receiverId: '', content: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMessages = async () => {
    setIsRefreshing(true);
    try {
      const [msgs, users] = await Promise.all([api.getMessages(user.id), api.getMessageDirectory()]);
      setMessages(msgs);
      setAllUsers(users);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [user.id]);

  const recipients = useMemo(
    () => allUsers.filter((u) => u.id !== user.id && canSendMessage(user.role, u.role)),
    [allUsers, user.id, user.role]
  );

  const nameFor = (id: string) => allUsers.find((u) => u.id === id)?.realName || id;

  const filtered = messages
    .filter((m) => {
      if (filter === 'inbox') return m.receiverId === user.id;
      if (filter === 'sent') return m.senderId === user.id;
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((m) => next.delete(m.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((m) => next.add(m.id));
        return next;
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await api.deleteMessages([...selected], user.id);
      setMessages((prev) => prev.filter((m) => !selected.has(m.id)));
      setSelected(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to delete messages.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSend = async () => {
    if (!compose.receiverId || !compose.content.trim()) {
      setError('Select a recipient and enter a message.');
      return;
    }
    const recipient = recipients.find((u) => u.id === compose.receiverId);
    if (!recipient || !canSendMessage(user.role, recipient.role)) {
      setError('This recipient is not allowed by messaging policy.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await api.sendMessage({
        senderId: user.id,
        receiverId: compose.receiverId,
        content: compose.content.trim(),
      });
      setMessages((prev) => [...prev, res.message]);
      setCompose({ receiverId: '', content: '' });
      setShowCompose(false);
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="font-bold text-slate-800 tracking-tight text-xl">Secure Messages</h3>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Shield size={12} className="text-emerald-500" />
            Clinical messaging mesh — patient-to-patient blocked
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              <Trash2 size={14} /> Delete ({selected.size})
            </button>
          )}
          <button
            onClick={() => setShowCompose(true)}
            className="px-4 py-2 bg-epic-blue text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-epic-dark transition-colors"
          >
            <Send size={14} /> New Message
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {(['all', 'inbox', 'sent'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              filter === f ? 'bg-epic-blue text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f === 'inbox' && <Inbox size={12} className="inline mr-1" />}
            {f === 'sent' && <Mail size={12} className="inline mr-1" />}
            {f}
          </button>
        ))}
        <button
          onClick={fetchMessages}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-epic-blue hover:bg-epic-dark text-white rounded-xl transition-all disabled:opacity-50 font-bold text-xs uppercase tracking-wider"
        >
          <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          REFRESH
        </button>
      </div>

      <div className="clinical-card overflow-hidden">
        {filtered.length > 0 ? (
          <>
            <div className="flex items-center gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-epic-blue focus:ring-epic-blue cursor-pointer"
                aria-label="Select all messages"
              />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select all</span>
            </div>
            <div className="divide-y divide-slate-50">
              {filtered.map((msg) => {
                const isSent = msg.senderId === user.id;
                return (
                  <div
                    key={msg.id}
                    className={`p-6 flex gap-4 ${isSent ? 'bg-red-50/30' : 'hover:bg-slate-50'} ${selected.has(msg.id) ? 'ring-1 ring-inset ring-epic-blue/30' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(msg.id)}
                      onChange={() => toggleSelect(msg.id)}
                      className="w-4 h-4 mt-1 rounded border-slate-300 text-epic-blue focus:ring-epic-blue cursor-pointer shrink-0"
                      aria-label={`Select message ${msg.id}`}
                    />
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSent ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                      <MessageSquare size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap justify-between gap-2 mb-1">
                        <p className="text-sm font-bold text-slate-900">
                          {isSent ? `To: ${nameFor(msg.receiverId)}` : `From: ${nameFor(msg.senderId)}`}
                        </p>
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Date(msg.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-12 text-center text-slate-400">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No messages in this view.</p>
          </div>
        )}
      </div>

      {error && !showCompose && (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      )}

      <AnimatePresence>
        {showCompose && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCompose(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-800">Compose Message</h3>
                <button onClick={() => setShowCompose(false)} className="p-2 hover:bg-slate-200 rounded-full"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Recipient</label>
                  <select
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-epic-blue"
                    value={compose.receiverId}
                    onChange={(e) => setCompose({ ...compose, receiverId: e.target.value })}
                  >
                    <option value="">Select recipient…</option>
                    {recipients.map((u) => (
                      <option key={u.id} value={u.id}>{u.realName} ({u.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Message</label>
                  <textarea
                    rows={4}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-epic-blue resize-none"
                    value={compose.content}
                    onChange={(e) => setCompose({ ...compose, content: e.target.value })}
                    placeholder="Enter your secure clinical message…"
                  />
                </div>
                {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="w-full py-3 bg-epic-blue text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Send size={16} /> {sending ? 'Sending…' : 'Send Secure Message'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
