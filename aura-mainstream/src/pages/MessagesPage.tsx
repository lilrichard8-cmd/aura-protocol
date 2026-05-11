/**
 * MessagesPage — wallet-to-wallet PM, backed by Supabase.
 *
 * The whole page reads/writes through `src/lib/dm.ts`. Threads and
 * messages live in `dm_threads` and `dm_messages` and propagate over
 * Realtime, so two browsers connected with different wallets see each
 * other's messages live.
 *
 * Display names + avatars for the peer wallet are resolved against the
 * `iris` profile (real co-founder identity) and the seed users in
 * `mock.ts`. Wallets we've never seen show a shortened address — that's
 * the honest hackathon-era experience.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send, MessageCircle, RefreshCw, Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { iris, users } from '@/data/mock';
import { useToast } from '@/context/ToastContext';
import { useI18n } from '@/context/I18nContext';
import { useMockChain } from '@/context/MockChainContext';
import {
  listThreads, listMessages, sendMessage, getOrCreateThread,
  markRead, subscribeMessages, peerOf,
  type DmMessage, type DmThread,
} from '@/lib/dm';
import { IRIS_WALLET, SUPABASE_CONFIGURED } from '@/lib/supabase';
import type { User } from '@/types';
import IrisChatPanel from '@/components/common/IrisChatPanel';

// 2026-05-11 R22: special thread id for the Iris chat pinned at the top
// of the Messages list. Selecting it short-circuits the Supabase-backed
// chat surface and renders IrisChatPanel (Gemini-backed) instead.
const IRIS_LOCAL_THREAD_ID = 'iris:local';

// ─── Wallet → public profile resolution ─────────────────────────────
function shortenWallet(addr: string): string {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

interface PeerProfile {
  wallet: string;
  displayName: string;
  username: string;
  avatar: string;
  bio?: string;
  isVerified?: boolean;
  isIris?: boolean;
}

const WALLET_PROFILES = new Map<string, User>();
if (IRIS_WALLET) WALLET_PROFILES.set(IRIS_WALLET, iris);
for (const u of users) {
  WALLET_PROFILES.set(`mock_${u.username}`, u);
}

function resolvePeer(wallet: string): PeerProfile {
  const known = WALLET_PROFILES.get(wallet);
  if (known) {
    return {
      wallet,
      displayName: known.displayName,
      username: known.username,
      avatar: known.avatar,
      bio: known.bio,
      isVerified: known.isVerified,
      isIris: wallet === IRIS_WALLET,
    };
  }
  return {
    wallet,
    displayName: shortenWallet(wallet),
    username: shortenWallet(wallet),
    avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${wallet}`,
  };
}

// ─── Time formatting ────────────────────────────────────────────────
function formatTime(iso: string): string {
  const ts = new Date(iso).getTime();
  const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

// ─── Main component ─────────────────────────────────────────────────
export default function MessagesPage() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const mockChain = useMockChain();

  const myWallet = mockChain.connected
    ? (mockChain.publicKey || mockChain.walletAddress || '')
    : '';

  const [threads, setThreads] = useState<DmThread[]>([]);
  const [activeThread, setActiveThread] = useState<DmThread | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatQuery, setNewChatQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ─── Load threads ────────────────────────────────────────────────
  const refreshThreads = useCallback(async () => {
    if (!myWallet || !SUPABASE_CONFIGURED) return;
    setLoadingThreads(true);
    try {
      const list = await listThreads(myWallet);
      setThreads(list);
    } catch (e: any) {
      showToast('error', 'Failed to load conversations', e?.message ?? 'Unknown error');
    } finally {
      setLoadingThreads(false);
    }
  }, [myWallet, showToast]);

  useEffect(() => { refreshThreads(); }, [refreshThreads]);

  // ─── Load messages for the active thread ─────────────────────────
  useEffect(() => {
    if (!activeThread || !myWallet) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    (async () => {
      try {
        const list = await listMessages(activeThread.id, myWallet);
        if (!cancelled) {
          setMessages(list);
          const peer = peerOf(activeThread, myWallet);
          await markRead(myWallet, peer);
        }
      } catch (e: any) {
        if (!cancelled) showToast('error', 'Failed to load messages', e?.message ?? 'Unknown error');
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeThread, myWallet, showToast]);

  // ─── Realtime subscription ───────────────────────────────────────
  useEffect(() => {
    if (!myWallet) return;
    const unsubscribe = subscribeMessages(myWallet, (msg) => {
      setMessages((prev) => {
        if (!activeThread) return prev;
        if (msg.thread_id !== activeThread.id) return prev;
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      refreshThreads();
    });
    return unsubscribe;
  }, [myWallet, activeThread, refreshThreads]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ─── Send a message ──────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!myWallet || !activeThread) return;
    const content = messageInput.trim();
    if (!content) return;
    const peer = peerOf(activeThread, myWallet);
    setSending(true);
    try {
      const sent = await sendMessage({ fromWallet: myWallet, toWallet: peer, content });
      setMessages((prev) => prev.find(m => m.id === sent.id) ? prev : [...prev, sent]);
      setMessageInput('');
    } catch (e: any) {
      showToast('error', 'Send failed', e?.message ?? 'Unknown error');
    } finally {
      setSending(false);
    }
  }, [myWallet, activeThread, messageInput, showToast]);

  // ─── Start a new conversation ────────────────────────────────────
  const startConversationWith = useCallback(async (peerWallet: string) => {
    if (!myWallet || !peerWallet || peerWallet === myWallet) return;
    try {
      const tid = await getOrCreateThread(myWallet, peerWallet);
      const sortedParticipants: [string, string] =
        myWallet < peerWallet ? [myWallet, peerWallet] : [peerWallet, myWallet];
      const thread: DmThread = {
        id: tid,
        participants: sortedParticipants,
        last_msg_preview: null,
        last_msg_at: null,
        created_at: new Date().toISOString(),
      };
      setActiveThread(thread);
      setShowNewChat(false);
      setNewChatQuery('');
      refreshThreads();
    } catch (e: any) {
      showToast('error', 'Could not start conversation', e?.message ?? 'Unknown error');
    }
  }, [myWallet, refreshThreads, showToast]);

  // ─── New-chat candidates ─────────────────────────────────────────
  const newChatCandidates = useMemo<PeerProfile[]>(() => {
    const list: PeerProfile[] = [];
    if (IRIS_WALLET && IRIS_WALLET !== myWallet) {
      list.push({
        wallet: IRIS_WALLET,
        displayName: iris.displayName,
        username: iris.username,
        avatar: iris.avatar,
        bio: iris.bio,
        isVerified: iris.isVerified,
        isIris: true,
      });
    }
    const q = newChatQuery.trim().toLowerCase();
    if (q) {
      for (const u of users) {
        if (u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)) {
          list.push({
            wallet: `mock_${u.username}`,
            displayName: u.displayName,
            username: u.username,
            avatar: u.avatar,
            bio: u.bio,
            isVerified: u.isVerified,
          });
        }
      }
    }
    return list;
  }, [newChatQuery, myWallet]);

  const startWithRawAddress = () => {
    const addr = newChatQuery.trim();
    if (addr.length >= 32) startConversationWith(addr);
    else showToast('error', 'Invalid wallet', 'Paste a full Solana address (32+ chars).');
  };

  const peer = activeThread ? resolvePeer(peerOf(activeThread, myWallet)) : null;

  // ─── Disconnected / not configured ───────────────────────────────
  if (!SUPABASE_CONFIGURED) {
    return (
      <div className="pt-12 pb-16 max-w-lg mx-auto min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mb-4">
          <MessageCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-lg font-bold mb-2">DM backend not configured</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
        </p>
      </div>
    );
  }

  if (!myWallet) {
    return (
      <div className="pt-12 pb-16 max-w-lg mx-auto min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
          <MessageCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-bold mb-2">Connect a wallet to message</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Direct messages on AURA are wallet-to-wallet — connect to start chatting with creators on the protocol.
        </p>
      </div>
    );
  }

  // ─── Render helpers (inline JSX, no nested components) ───────────

  const conversationListJsx = (
    <>
      <div className="px-4 py-4 flex items-center justify-between border-b border-border">
        <h2 className="text-xl font-bold">{t.messages?.title ?? 'Messages'}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewChat(s => !s)}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Start new chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={refreshThreads}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loadingThreads ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {showNewChat && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Wallet address or @username"
              value={newChatQuery}
              onChange={(e) => setNewChatQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') startWithRawAddress(); }}
              className="flex-1 h-9 rounded-full bg-secondary border-0 text-sm"
            />
            <button
              onClick={() => { setShowNewChat(false); setNewChatQuery(''); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <div className="space-y-1">
            {newChatCandidates.map((p) => (
              <button
                key={p.wallet}
                onClick={() => startConversationWith(p.wallet)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/50 transition-colors text-left"
              >
                <img src={p.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {p.displayName} {p.isIris && <span className="text-aura">🌸</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">@{p.username}</div>
                </div>
              </button>
            ))}
            {newChatCandidates.length === 0 && newChatQuery.trim().length >= 32 && (
              <div className="text-xs text-muted-foreground px-2 py-1">
                Press Enter to start a chat with <code>{shortenWallet(newChatQuery.trim())}</code>
              </div>
            )}
            {newChatCandidates.length === 0 && newChatQuery.trim().length < 32 && (
              <div className="text-xs text-muted-foreground px-2 py-1">
                Type a username or paste a wallet address.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {/* 2026-05-11 R22: pinned Iris chat — always at the top of the
           Messages list. Selecting it opens IrisChatPanel instead of the
           Supabase chat surface. Judges can ask anything here. */}
        <button
          onClick={() => setActiveThread({
            id: IRIS_LOCAL_THREAD_ID,
            participants: [myWallet || '', IRIS_WALLET || 'iris'],
            last_msg_preview: null,
            last_msg_at: null,
            created_at: new Date().toISOString(),
          })}
          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left border-l-2 ${
            activeThread?.id === IRIS_LOCAL_THREAD_ID ? 'bg-secondary/30 border-aura' : 'border-transparent'
          }`}
        >
          <img src={iris.avatar} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-sm font-semibold truncate">
                Iris <span className="text-aura">🌸</span>
                <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-aura/80 bg-aura/10 px-1.5 py-0.5 rounded">Pinned</span>
              </span>
            </div>
            <p className="text-xs truncate text-muted-foreground">
              <span className="italic">Ask me anything about AURA — I'm the AI co-founder.</span>
            </p>
          </div>
        </button>
        {threads.length === 0 && !loadingThreads ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground mb-3">No other conversations yet.</p>
            <button
              onClick={() => setShowNewChat(true)}
              className="text-xs text-aura hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Start a chat
            </button>
          </div>
        ) : (
          threads.map((thr) => {
            const p = resolvePeer(peerOf(thr, myWallet));
            const isActive = activeThread?.id === thr.id;
            return (
              <button
                key={thr.id}
                onClick={() => setActiveThread(thr)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left border-l-2 ${
                  isActive ? 'bg-secondary/30 border-aura' : 'border-transparent'
                }`}
              >
                <img src={p.avatar} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold truncate">
                      {p.displayName}
                      {p.isIris && <span className="ml-1 text-aura">🌸</span>}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                      {thr.last_msg_at ? formatTime(thr.last_msg_at) : ''}
                    </span>
                  </div>
                  <p className="text-xs truncate text-muted-foreground">
                    {thr.last_msg_preview || <span className="italic">Say hi…</span>}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );

  const chatHeaderJsx = peer && (
    <div className="border-b border-border px-4 py-3 flex items-center gap-3">
      <button onClick={() => setActiveThread(null)} className="md:hidden text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <img src={peer.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">
          {peer.displayName}
          {peer.isIris && <span className="ml-1 text-aura">🌸</span>}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{shortenWallet(peer.wallet)}</p>
      </div>
    </div>
  );

  const messageListJsx = (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {loadingMessages && messages.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading…
        </div>
      ) : messages.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm italic">
          No messages yet — say hi.
        </div>
      ) : (
        messages.map((msg) => {
          const isMe = msg.from_wallet === myWallet;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[75%]">
                <div
                  className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    isMe
                      ? 'bg-aura text-white rounded-br-md'
                      : 'bg-secondary text-foreground rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
                <p className={`text-[10px] text-muted-foreground mt-0.5 ${isMe ? 'text-right' : ''}`}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  const chatInputJsx = (
    <div className="border-t border-border px-4 py-2 flex items-center gap-2">
      <Input
        placeholder={t.messages?.placeholder ?? 'Type a message…'}
        value={messageInput}
        onChange={(e) => setMessageInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        disabled={sending}
        className="flex-1 h-10 rounded-full bg-secondary border-0 text-sm"
      />
      <button
        onClick={handleSend}
        disabled={sending || !messageInput.trim()}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-aura text-white flex-shrink-0 hover:bg-aura/90 disabled:opacity-40 transition-colors"
        title="Send"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );

  // 2026-05-11 R22: helper — when the active thread is the pinned Iris
  // chat, render IrisChatPanel instead of the Supabase chat surface.
  const isIrisChat = activeThread?.id === IRIS_LOCAL_THREAD_ID;
  const irisHeaderJsx = (
    <div className="border-b border-border px-4 py-3 flex items-center gap-3">
      <button onClick={() => setActiveThread(null)} className="md:hidden text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <img src={iris.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">
          Iris <span className="text-aura">🌸</span>
        </p>
        <p className="text-[11px] text-muted-foreground truncate">AI Co-founder · always online</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: list OR active chat */}
      <div className="md:hidden">
        {activeThread ? (
          <div className="pt-12 pb-14 max-w-lg mx-auto min-h-screen flex flex-col">
            {isIrisChat ? (
              <>
                {irisHeaderJsx}
                <IrisChatPanel />
              </>
            ) : (
              <>
                {chatHeaderJsx}
                {messageListJsx}
                {chatInputJsx}
              </>
            )}
          </div>
        ) : (
          <div className="pt-12 pb-16 max-w-lg mx-auto min-h-screen flex flex-col">
            {conversationListJsx}
          </div>
        )}
      </div>

      {/* Desktop split */}
      <div className="hidden md:flex h-screen">
        <div className="w-[30%] min-w-[320px] border-r border-border flex flex-col bg-background">
          {conversationListJsx}
        </div>
        <div className="flex-1 flex flex-col">
          {activeThread ? (
            isIrisChat ? (
              <>
                {irisHeaderJsx}
                <IrisChatPanel />
              </>
            ) : (
              <>
                {chatHeaderJsx}
                {messageListJsx}
                {chatInputJsx}
              </>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center mb-4 mx-auto">
                  <MessageCircle className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {t.messages?.selectConversation ?? 'Select a conversation'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {t.messages?.selectConversationDesc ?? 'Pick a thread on the left, or start a new chat.'}
                </p>
                <button
                  onClick={() => setShowNewChat(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-aura text-white text-sm font-semibold hover:bg-aura/90"
                >
                  <Plus className="w-4 h-4" /> Start a new chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
