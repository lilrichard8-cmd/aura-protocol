/**
 * Iris chat — calls the Supabase Edge Function that proxies Gemini.
 *
 * Why a proxy?
 *   - The Gemini API key MUST NEVER ship to the browser. Previous versions
 *     hard-coded it in IrisChat.tsx and shipped to production. That key is
 *     now revoked. Do not put any LLM key back in src/.
 *   - The Edge Function (supabase/functions/iris-chat) reads
 *     GEMINI_API_KEY from its secrets, applies the system prompt, and
 *     returns just the answer text.
 *
 * Failure mode: if the proxy is unreachable we return a friendly fallback
 * so the UI never crashes.
 */
import { supabase, SUPABASE_CONFIGURED } from './supabase';

export interface ChatMessage {
  role: 'user' | 'iris';
  text: string;
}

export async function callIrisChat(messages: ChatMessage[]): Promise<string> {
  const userMessages = messages
    .filter((m) => m.role === 'user' && m.text.trim())
    .map((m) => m.text);

  if (userMessages.length === 0) {
    return 'What would you like to know? 🌸';
  }

  if (!SUPABASE_CONFIGURED || !supabase) {
    return "I'm not configured to chat right now. Try again later 🌸";
  }

  try {
    const { data, error } = await supabase.functions.invoke('iris-chat', {
      body: { messages: userMessages },
    });
    if (error) throw error;
    const text = (data as { text?: string } | null)?.text;
    if (text && typeof text === 'string') return text;
    throw new Error('Empty response');
  } catch (err) {
    // Surface only generic message — never leak proxy internals to the UI.
    console.error('[iris-chat] proxy error', err);
    return "Sorry, I'm a bit busy right now. Try again shortly 🌸";
  }
}
