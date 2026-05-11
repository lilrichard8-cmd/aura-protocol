import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Send, Gift, Heart, Share2, Star, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { liveStreams, mockChatMessages, mockTipLeaderboard, type ChatMessage } from '@/data/mockP1';
import { useToast } from '@/context/ToastContext';
import { useOraGuard } from '@/hooks/useOraGuard';
import { useI18n } from '@/context/I18nContext';
import { useMockChain } from '@/context/MockChainContext';
import VideoPlayer from '@/components/media/VideoPlayer';
import UserAvatar from '@/components/UserAvatar';
import Danmaku from '@/components/live/Danmaku';
import TipLeaderboard from '@/components/live/TipLeaderboard';
import StreamStats from '@/components/live/StreamStats';
import PPVGate from '@/components/live/PPVGate';
// Twitch-style chrome (2026-05-11): metadata bar, below-player tabs,
// recommended channels rail, chat badges, pinned message, mode strip.
import StreamMetaBar from '@/components/live/StreamMetaBar';
import BelowPlayerTabs from '@/components/live/BelowPlayerTabs';
import ChatBadges, { type ChatBadgeAttrs } from '@/components/live/ChatBadges';
import PinnedMessage from '@/components/live/PinnedMessage';
import RecommendedChannels from '@/components/live/RecommendedChannels';
import ChatModeControls from '@/components/live/ChatModeControls';

interface OraFloat {
  id: string;
  amount: number;
  x: number;
}

const TIP_AMOUNTS = [1, 5, 10, 50];
const SUBSCRIBE_PRICE = 30;
const EMOJIS = ['❤️', '🔥', '😂', '👏', '🎉'];
const DEMO_VIDEO = 'https://www.w3schools.com/html/mov_bbb.mp4';

export default function LiveStreamPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const oraGuard = useOraGuard();
  const mockChain = useMockChain();
  const stream = liveStreams.find(s => s.id === id) || liveStreams[0];
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatMessages);
  const [inputText, setInputText] = useState('');
  const [oraFloats, setOraFloats] = useState<OraFloat[]>([]);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [customTip, setCustomTip] = useState('');
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [ppvUnlocked, setPpvUnlocked] = useState(false);
  const [ppvPaying, setPpvPaying] = useState(false);
  const [celebrationBanner, setCelebrationBanner] = useState<string | null>(null);
  const [totalTips, setTotalTips] = useState(stream.totalTips ?? 0);
  const [followed, setFollowed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Twitch-style additions — theatre mode collapses chat + recommended
  // rail. Slow mode currently presentational only (no enforcement).
  const [theatreMode, setTheatreMode] = useState(false);
  const [slowModeSec] = useState<number | null>(null);
  const [followersOnly] = useState(false);
  const [subOnly] = useState(false);
  // Compute live uptime from the recorded streamDuration in mock data.
  // Falls back to a deterministic 1h-ish baseline if missing.
  const streamStartedAtRef = useRef<number>(
    Date.now() - ((stream.streamDuration ?? 65) * 60 * 1000)
  );
  const [uptimeMs, setUptimeMs] = useState(Date.now() - streamStartedAtRef.current);
  useEffect(() => {
    const t = setInterval(() => setUptimeMs(Date.now() - streamStartedAtRef.current), 1000);
    return () => clearInterval(t);
  }, []);

  // Recommended channels = other live streams (excluding this one).
  const recommended = useMemo(
    () => liveStreams.filter(s => s.id !== stream.id && s.isLive),
    [stream.id],
  );

  // Pinned message — the host's announcement at the top of chat.
  // Sourced from stream.description if it exists, else a default.
  const pinnedText = stream.description
    || `Hi! Drop a question in chat or tip with the gift icon — first 3 tippers get a shoutout.`;

  // Synthetic badge attribution per chat user. We tag the local user as
  // a tipper when they tip; a fixed mod set is recognised as committee
  // members; subscribers come from mockChain.subscribedCreators.
  const myUserId = mockChain.publicKey || 'local-user';
  const localTippedAmount = useRef(0);
  const computeBadges = (userId: string): ChatBadgeAttrs => {
    const isMe = userId === myUserId;
    return {
      isSubscriber: isMe ? mockChain.subscribedCreators.includes(stream.host.id) : Math.random() > 0.7,
      subscriberMonths: isMe ? 1 : Math.floor(Math.random() * 18),
      isMod: ['mod1', 'mod2', 'committee-1'].includes(userId) || (!isMe && Math.random() > 0.92),
      isOG: !isMe && Math.random() > 0.85,
      isTopTipper: isMe ? localTippedAmount.current > 0 : Math.random() > 0.9,
    };
  };

  // Below-player tabs — fully synthetic for the demo.
  const aboutTab = {
    bio: stream.description
      || `${stream.host.displayName} streams ${stream.category} on AURA. Follow to get notified when I go live.`,
    socials: {
      twitter: 'https://twitter.com/' + stream.host.username,
      website: undefined,
    },
    creatorCoinSymbol: stream.coinPrice ? '$' + stream.host.username.slice(0, 4).toUpperCase() : null,
    creatorCoinPrice: stream.coinPrice ?? null,
    creatorCoinHolders: stream.subscriberCount ?? null,
  };
  const scheduleTab = useMemo(() => [
    { id: 'sch-1', title: 'Weekly office hours',  startsAt: Date.now() + 2 * 86400000, durationMin: 60 },
    { id: 'sch-2', title: 'Creator Coin AMA',     startsAt: Date.now() + 5 * 86400000, durationMin: 45 },
    { id: 'sch-3', title: 'Behind-the-scenes',    startsAt: Date.now() + 9 * 86400000, durationMin: 90 },
  ], []);
  const vodsTab = useMemo(() => [
    { id: 'vod-1', title: 'Last week’s creator chat',  thumb: stream.coverImage, durationMin: 84,  views: 1840,  postedAt: Date.now() - 7 * 86400000 },
    { id: 'vod-2', title: 'Building on AURA — part 2', thumb: stream.coverImage, durationMin: 62,  views: 925,   postedAt: Date.now() - 14 * 86400000 },
  ], [stream.coverImage]);
  const clipsTab = useMemo(() => [
    { id: 'clip-1', title: 'When the chat actually clapped',     thumb: stream.coverImage, views: 4400, clippedAt: Date.now() - 2 * 86400000 },
    { id: 'clip-2', title: 'A surprisingly good explanation',     thumb: stream.coverImage, views: 1200, clippedAt: Date.now() - 6 * 86400000 },
  ], [stream.coverImage]);

  const isSubscribed = mockChain.subscribedCreators.includes(stream.host.id);
  const showPPV = stream.isPPV && !ppvUnlocked;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const spawnOraFloat = (amount: number) => {
    const fid = crypto.randomUUID();
    const x = 20 + Math.random() * 60;
    setOraFloats(prev => [...prev, { id: fid, amount, x }]);
    setTimeout(() => setOraFloats(prev => prev.filter(f => f.id !== fid)), 2000);
  };

  const showCelebration = (amount: number) => {
    setCelebrationBanner(`🎉 You tipped ${amount} ORA!`);
    setTimeout(() => setCelebrationBanner(null), 3000);
  };

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const msg: ChatMessage = {
      id: `c${Date.now()}`,
      user: { id: 'me', username: 'me', displayName: 'Me', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80', bio: '', followers: 0, following: 0, isVerified: false },
      content: inputText,
      timestamp: t.live.justNow,
    };
    setMessages(prev => [...prev, msg]);
    setInputText('');
  };

  const sendEmoji = (emoji: string) => {
    const msg: ChatMessage = {
      id: `e${Date.now()}`,
      user: { id: 'me', username: 'me', displayName: 'Me', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80', bio: '', followers: 0, following: 0, isVerified: false },
      content: emoji,
      timestamp: t.live.justNow,
    };
    setMessages(prev => [...prev, msg]);
  };

  const handleTip = async (amount: number) => {
    if (!mockChain.connected) { showToast('error', 'Connect wallet first', ''); return; }
    if (amount <= 0) return;
    if (!oraGuard.ensure(amount, 'Tip')) return;
    setTipping(true);
    try {
      await mockChain.tipCreator(stream.host.id, amount);
      spawnOraFloat(amount);
      showCelebration(amount);
      setTotalTips(prev => prev + amount);
      const tipMsg: ChatMessage = {
        id: `tip${Date.now()}`,
        user: { id: 'me', username: 'me', displayName: 'Me', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80', bio: '', followers: 0, following: 0, isVerified: false },
        content: `Tipped ${amount} ORA 🎁`,
        timestamp: t.live.justNow,
        isTip: true,
        tipAmount: amount,
      };
      setMessages(prev => [...prev, tipMsg]);
      showToast('success', `Tipped ${amount} ORA!`, `Balance: ${(mockChain.oraBalance - amount).toFixed(2)} ORA remaining`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (/insufficient/i.test(msg)) {
        oraGuard.ensure(amount, 'Tip');
      } else {
        showToast('error', 'Tip failed', msg);
      }
    }
    setTipping(false);
    setShowTipModal(false);
    setCustomTip('');
  };

  const handleSubscribe = async () => {
    if (!mockChain.connected) { showToast('error', 'Connect wallet first', ''); return; }
    if (!oraGuard.ensure(SUBSCRIBE_PRICE, 'Subscription')) return;
    try {
      await mockChain.subscribeToCreator(stream.host.id, SUBSCRIBE_PRICE);
      showToast('success', `Subscribed to ${stream.host.displayName}!`, `${SUBSCRIBE_PRICE} ORA/month`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (/insufficient/i.test(msg)) {
        oraGuard.ensure(SUBSCRIBE_PRICE, 'Subscription');
      } else {
        showToast('error', 'Subscribe failed', msg);
      }
    }
  };

  const handlePPVPay = async () => {
    if (!mockChain.connected) { showToast('error', 'Connect wallet first', ''); return; }
    const ppvCost = stream.ppvPrice ?? 25;
    if (!oraGuard.ensure(ppvCost, 'Premium stream')) return;
    setPpvPaying(true);
    try {
      await mockChain.tipCreator(stream.host.id, ppvCost);
      setPpvUnlocked(true);
      showToast('success', 'Stream unlocked!', 'Enjoy the premium content');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (/insufficient/i.test(msg)) {
        oraGuard.ensure(ppvCost, 'Premium stream');
      } else {
        showToast('error', 'Payment failed', msg);
      }
    }
    setPpvPaying(false);
  };

  return (
    <div className="min-h-screen bg-black md:bg-background flex flex-col md:flex-row relative">
      {/* Recommended-channels rail (Twitch-style) — desktop only.
          Hidden in theatre mode for a cleaner full-width feel. */}
      {!theatreMode && <RecommendedChannels streams={recommended} />}
      {/* ORA Float Animations */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {oraFloats.map(f => (
          <div
            key={f.id}
            className="absolute bottom-24 text-ora font-bold text-2xl"
            style={{ left: `${f.x}%`, animation: 'oraFloat 2s ease-out forwards' }}
          >
            ✨ +{f.amount} ORA
          </div>
        ))}
      </div>

      {/* Celebration Banner */}
      {celebrationBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500/90 to-ora/90 text-white font-bold text-lg shadow-2xl animate-bounce">
          {celebrationBanner}
        </div>
      )}

      {/* Video Area */}
      <div className="relative flex-1 md:flex-[3]">
        <div className="relative w-full aspect-video md:aspect-auto md:h-screen">
          <VideoPlayer
            src={DEMO_VIDEO}
            poster={stream.coverImage}
            className="w-full h-full"
          />

          {/* Danmaku overlay */}
          <Danmaku enabled={danmakuEnabled && !showPPV} />

          {/* PPV Gate */}
          {showPPV && (
            <PPVGate
              price={stream.ppvPrice ?? 25}
              hostName={stream.host.displayName}
              onPay={handlePPVPay}
              paying={ppvPaying}
            />
          )}

          {/* Top Bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30">
            <button onClick={() => navigate('/live')} className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors">
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
            <div className="flex items-center gap-2">
              {stream.isLive && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500 text-white text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {t.live.liveBadge}
                </div>
              )}
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/40 text-white text-xs">
                <Eye className="w-3 h-3" />
                {stream.viewerCount.toLocaleString()}
              </div>
              <button
                onClick={() => setDanmakuEnabled(!danmakuEnabled)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${danmakuEnabled ? 'bg-cyan-500/80 text-white' : 'bg-black/40 text-white/60'}`}
              >
                <MessageSquare className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Mobile floating action buttons (TikTok-style) */}
          <div className="absolute right-3 bottom-20 flex flex-col gap-3 md:hidden z-30">
            <button
              onClick={() => { setFollowed(!followed); }}
              className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center"
            >
              <Heart className={`w-5 h-5 ${followed ? 'fill-red-500 text-red-500' : 'text-white'}`} />
            </button>
            <button
              onClick={() => setShowTipModal(true)}
              className="w-10 h-10 rounded-full bg-ora/80 flex items-center justify-center"
            >
              <Gift className="w-5 h-5 text-white" />
            </button>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); showToast('success', 'Link copied!', 'Share link copied to clipboard'); }} className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Host Info - mobile bottom */}
          <div className="absolute bottom-4 left-4 right-16 md:hidden z-30">
            <div className="flex items-center gap-2">
              <UserAvatar src={stream.host.avatar} displayName={stream.host.displayName} username={stream.host.username} className="w-8 h-8 rounded-full border border-white/50" />
              <div>
                <p className="text-white text-sm font-semibold">{stream.host.displayName}</p>
                <p className="text-white/60 text-xs">{stream.category}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: Twitch-style metadata + tabs below the video.
            2026-05-11: replaced the old StreamStats/About-this-stream
            collapsible with a proper StreamMetaBar + BelowPlayerTabs
            so the layout matches what evaluators are used to. */}
        <div className="hidden md:block">
          <StreamMetaBar
            host={stream.host}
            title={stream.title}
            category={stream.category}
            tags={stream.tags}
            viewerCount={stream.viewerCount}
            uptimeMs={uptimeMs}
            followed={followed}
            isSubscribed={isSubscribed}
            subscribePrice={SUBSCRIBE_PRICE}
            onFollow={() => setFollowed(!followed)}
            onSubscribe={handleSubscribe}
            onShare={() => {
              navigator.clipboard.writeText(window.location.href);
              showToast('success', 'Link copied!', 'Share link copied to clipboard');
            }}
          />
          <BelowPlayerTabs
            about={aboutTab}
            schedule={scheduleTab}
            vods={vodsTab}
            clips={clipsTab}
          />
          <div className="px-4 py-3 space-y-3">
            <StreamStats
              initialViewers={stream.viewerCount}
              initialLikes={Math.floor(stream.viewerCount * 0.3)}
              totalTips={totalTips}
              isLive={stream.isLive}
            />
            <TipLeaderboard entries={mockTipLeaderboard} />
          </div>
        </div>
      </div>

      {/* Chat Panel — Twitch-style: pinned banner up top, badges per row,
          mode strip + composer at the bottom. The redundant Desktop Host
          Info bar has moved up into the StreamMetaBar above. */}
      <div className={`flex-1 ${theatreMode ? 'md:hidden' : 'md:flex-[2]'} flex flex-col bg-background/90 md:bg-background md:border-l border-border`}>
        {/* Chat header */}
        <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-bold">Stream Chat</p>
          </div>
          <p className="text-[10px] text-muted-foreground tabular-nums">{messages.length} msgs</p>
        </div>

        {/* Pinned message */}
        <PinnedMessage message={pinnedText} authorName={stream.host.displayName} />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[40vh] md:max-h-none">
          {messages.map(msg => (
            <div key={msg.id} className={`flex items-start gap-2 ${msg.isTip ? 'bg-ora/10 border border-ora/30 rounded-lg p-2' : ''}`}>
              <UserAvatar src={msg.user.avatar} displayName={msg.user.displayName} username={msg.user.username} className="w-6 h-6 rounded-full shrink-0" />
              <div>
                <ChatBadges attrs={computeBadges(msg.user.id)} />
                <span className="text-xs font-semibold text-muted-foreground">{msg.user.displayName}</span>
                {msg.isTip && <span className="text-xs text-ora ml-1">💰 {msg.tipAmount} ORA</span>}
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Emoji bar + Input */}
        <div className="p-3 border-t border-border space-y-2">
          {/* Emoji Quick Reactions */}
          <div className="flex gap-1">
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => sendEmoji(emoji)}
                className="px-2 py-1 rounded-full hover:bg-secondary transition-colors text-sm"
              >
                {emoji}
              </button>
            ))}
          </div>
          {/* Subscribe button for mobile */}
          <div className="flex md:hidden gap-2">
            <Button
              size="sm"
              onClick={handleSubscribe}
              disabled={isSubscribed}
              className={`flex-1 ${isSubscribed ? 'bg-green-500/20 text-green-600' : 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white'}`}
            >
              <Star className="w-3 h-3 mr-1" />
              {isSubscribed ? 'Subscribed ✓' : `Subscribe ${SUBSCRIBE_PRICE} ORA/mo`}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTipModal(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-ora/10 text-ora shrink-0 hover:bg-ora/20 transition-colors"
            >
              <Gift className="w-4 h-4" />
            </button>
            <Input
              placeholder={t.live.sendMessage}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="flex-1 h-9 rounded-full bg-secondary border-0 text-sm"
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage} className="w-9 h-9 rounded-full flex items-center justify-center bg-aura text-white shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Chat-mode strip + theatre mode toggle */}
        <ChatModeControls
          slowModeSeconds={slowModeSec}
          followersOnly={followersOnly}
          subscribersOnly={subOnly}
          isTheatreMode={theatreMode}
          onToggleTheatreMode={() => setTheatreMode(v => !v)}
        />
      </div>

      {/* Theatre mode chat-restore button */}
      {theatreMode && (
        <button
          onClick={() => setTheatreMode(false)}
          className="hidden md:flex fixed top-4 right-4 z-50 px-3 py-2 rounded-md bg-black/70 hover:bg-black/90 text-white text-xs font-bold items-center gap-1.5 shadow-lg"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Show chat
        </button>
      )}

      {/* Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTipModal(false)}>
          <div className="bg-background rounded-t-3xl md:rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Tip {stream.host.displayName}</h3>
            <p className="text-sm text-muted-foreground mb-4">Balance: {mockChain.oraBalance.toFixed(2)} ORA</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {TIP_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  onClick={() => handleTip(amt)}
                  disabled={tipping || mockChain.oraBalance < amt}
                  className="py-2 rounded-xl bg-ora/10 text-ora font-bold text-sm hover:bg-ora/20 transition-colors disabled:opacity-40"
                >
                  {amt} ORA
                </button>
              ))}
            </div>
            {/* Custom tip */}
            <div className="flex gap-2 mb-4">
              <Input
                type="number"
                placeholder="Custom amount"
                value={customTip}
                onChange={e => setCustomTip(e.target.value)}
                className="flex-1 h-9 rounded-xl bg-secondary border-0 text-sm"
                min={1}
              />
              <Button
                size="sm"
                onClick={() => handleTip(Number(customTip))}
                disabled={tipping || !customTip || Number(customTip) <= 0 || mockChain.oraBalance < Number(customTip)}
                className="bg-ora text-white rounded-xl px-4"
              >
                Tip
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">5% platform fee goes to creators & stakers</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes oraFloat {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-120px) scale(1.3); }
        }
      `}</style>
    </div>
  );
}
