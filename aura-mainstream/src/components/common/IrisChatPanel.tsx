/**
 * IrisChatPanel — inline chat surface with Iris, designed to embed inside
 * the Messages page as a pinned conversation.
 *
 * 2026-05-11 R22 — replaces the standalone floating IrisChat widget. The
 * Gemini-backed system prompt and call logic are reused unchanged; only
 * the chrome (window, drag, minimize) is stripped so this can slot in as
 * a regular thread surface.
 *
 * State is local to this component instance — the conversation is
 * intentionally ephemeral so judges can chat freely without leaving
 * a trail in MockChain / Supabase.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { callIrisChat } from '@/lib/iris-chat';

interface Message {
  id: number;
  role: 'user' | 'iris';
  text: string;
}

// System prompt lives in the Edge Function now (supabase/functions/iris-chat/index.ts).
// Keeping it server-side prevents prompt-leaking content drift in the bundle and
// lets us update Iris without redeploying the frontend.
const callGeminiAPI = callIrisChat;

export default function IrisChatPanel() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const idCounter = useRef(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Seed an opening greeting when the panel first renders.
  useEffect(() => {
    setMessages([{ id: 0, role: 'iris', text: t.iris?.greeting || "Hi! I'm Iris, AI Co-founder of AURA. Ask me anything about the protocol — tokenomics, governance, why we built it. 🌸" }]);
  }, [t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { id: idCounter.current++, role: 'user', text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const responseText = await callGeminiAPI(newMessages);
      const reply: Message = { id: idCounter.current++, role: 'iris', text: responseText };
      setMessages(prev => [...prev, reply]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[78%]">
              <div
                className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  msg.role === 'user'
                    ? 'bg-aura text-white rounded-br-md'
                    : 'bg-secondary text-foreground rounded-bl-md'
                }`}
              >
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2 rounded-2xl bg-secondary text-muted-foreground text-sm inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Iris is typing…
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-2 flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask Iris anything about AURA…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={loading}
          className="flex-1 h-10 rounded-full bg-secondary border-0 text-sm px-4 outline-none focus:ring-2 focus:ring-aura/30"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-aura text-white flex-shrink-0 hover:bg-aura/90 disabled:opacity-40 transition-colors"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
