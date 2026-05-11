import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, X, Gift, Heart, Trophy, Users, Flame, Coins } from 'lucide-react';
import { liveStreams, creators } from '@/data/mock';
import type { DanmakuMessage } from '@/data/mock';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export default function LivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chatMessage, setChatMessage] = useState('');
  const [showTipPicker, setShowTipPicker] = useState(false);
  const [tipCurrent, setTipCurrent] = useState(342);
  const [messages, setMessages] = useState<DanmakuMessage[]>([]);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; color: string }[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);

  const stream = liveStreams[0]; // default to first stream
  const creator = creators.find((c) => c.id === (id || stream?.creatorId));

  // Initialize danmaku
  useEffect(() => {
    if (stream) {
      setMessages(stream.danmaku);
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Simulate new messages
  useEffect(() => {
    const names = ['user_x', 'fan_88', 'night_rider', 'crypto_bro', 'aura_fan', 'love_art'];
    const texts = ['Amazing!', 'Love it! 🔥', 'Keep going!', 'So good!', 'Wow!', 'Best stream ever', '❤️❤️❤️', 'Hello from Japan!'];

    const interval = setInterval(() => {
      const newMsg: DanmakuMessage = {
        id: `d-${Date.now()}`,
        username: names[Math.floor(Math.random() * names.length)],
        content: texts[Math.floor(Math.random() * texts.length)],
        isTip: Math.random() < 0.15,
        tipAmount: Math.random() < 0.15 ? [5, 10, 25, 50][Math.floor(Math.random() * 4)] : undefined,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev.slice(-50), newMsg]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const sendChat = () => {
    if (!chatMessage.trim()) return;
    const msg: DanmakuMessage = {
      id: `d-${Date.now()}`,
      username: 'aurora_dreamer',
      content: chatMessage,
      isTip: false,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    setChatMessage('');
  };

  const sendTip = (amount: number) => {
    const msg: DanmakuMessage = {
      id: `d-${Date.now()}`,
      username: 'aurora_dreamer',
      content: `Tipped ${amount} ORA!`,
      isTip: true,
      tipAmount: amount,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    setTipCurrent((prev) => Math.min(prev + amount, stream?.tipGoal || 500));
    setShowTipPicker(false);

    // Floating hearts burst
    for(let i=0; i<5; i++) {
        setTimeout(() => {
            const heartId = Date.now() + i;
            setFloatingHearts((prev) => [...prev, { id: heartId, x: Math.random() * 60 + 20, color: '#F59E0B' }]);
            setTimeout(() => {
                setFloatingHearts((prev) => prev.filter((h) => h.id !== heartId));
            }, 2500);
        }, i * 100);
    }
  };
  
  const sendHeart = () => {
       const heartId = Date.now();
       setFloatingHearts((prev) => [...prev, { id: heartId, x: Math.random() * 40 + 50, color: '#E94560' }]);
       setTimeout(() => {
           setFloatingHearts((prev) => prev.filter((h) => h.id !== heartId));
       }, 2500);
  }

  if (!stream || !creator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1A2E] text-gray-500">
        No live stream available
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Stream video area */}
      <div className="relative flex-1 h-full w-full overflow-hidden group/video">
        {/* Simulated video */}
        <div className="absolute inset-0">
          <img src={stream.thumbnail} alt="" className="w-full h-full object-cover animate-pulse-slow scale-105" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />
        </div>

        {/* Floating hearts */}
        {floatingHearts.map((heart) => (
          <div
            key={heart.id}
            className="absolute bottom-32 right-8 animate-float-up pointer-events-none z-20"
            style={{ left: `${heart.x}%`, color: heart.color }}
          >
            <Heart className="w-8 h-8 fill-current drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]" />
          </div>
        ))}

        {/* Top controls */}
        <div className="absolute top-0 left-0 right-0 p-4 pt-12 flex items-center justify-between z-30 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-3 bg-[#16213E]/60 backdrop-blur-md rounded-full p-1.5 pr-5 border border-white/10 shadow-lg">
            <div className="relative">
                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
                <img
                src={creator.avatar}
                alt=""
                className="relative w-9 h-9 rounded-full border-2 border-red-500 object-cover"
                />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white text-sm font-bold drop-shadow-md">{creator.displayName}</span>
                {creator.isVerified && <span className="text-aura-gold text-[10px] bg-aura-gold/20 px-1 rounded-sm border border-aura-gold/20">✓</span>}
              </div>
              <div className="flex items-center gap-2">
                 <Badge className="bg-red-500 text-white text-[9px] px-1.5 py-0 border-none animate-pulse">LIVE</Badge>
                 <span className="text-gray-300 text-[10px] font-medium flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {stream.viewerCount.toLocaleString()}
                 </span>
              </div>
            </div>
            <button className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full ml-1 transition-colors border border-white/5">
              Follow
            </button>
          </div>

          <div className="flex items-center gap-3">
             {/* Leaderboard Trigger */}
             <Sheet>
                <SheetTrigger asChild>
                    <button className="w-10 h-10 rounded-full bg-[#16213E]/60 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-aura-gold/20 transition-colors">
                        <Trophy className="w-5 h-5 text-aura-gold" />
                    </button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-[#1A1A2E]/95 backdrop-blur-xl border-l border-white/10 w-[85%] sm:w-[350px] p-0 text-white">
                    <SheetHeader className="p-6 border-b border-white/5">
                        <SheetTitle className="text-white flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-aura-gold" />
                            Top Tippers
                        </SheetTitle>
                    </SheetHeader>
                    <div className="p-4 space-y-4">
                        {[
                            { name: 'crypto_whale', amount: 5000, rank: 1 },
                            { name: 'patron_vip', amount: 2500, rank: 2 },
                            { name: 'night_owl', amount: 1200, rank: 3 },
                            { name: 'fan_007', amount: 800, rank: 4 },
                            { name: 'lurker_king', amount: 500, rank: 5 },
                        ].map((user) => (
                            <div key={user.rank} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm
                                    ${user.rank === 1 ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-black' : 
                                      user.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' : 
                                      user.rank === 3 ? 'bg-gradient-to-br from-orange-300 to-orange-600 text-black' : 
                                      'bg-white/10 text-gray-400'}`}>
                                    {user.rank}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-sm">{user.name}</p>
                                    <p className="text-xs text-aura-gold font-mono">{user.amount} ORA</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SheetContent>
             </Sheet>

            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-[#16213E]/60 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Tip Goal Bar */}
        <div className="absolute top-24 right-4 z-20">
            <div className="bg-black/40 backdrop-blur-md rounded-2xl p-2 border border-white/10 w-12 flex flex-col items-center gap-1">
                <Flame className="w-5 h-5 text-orange-500 animate-pulse" fill="currentColor" />
                <div className="w-1.5 h-24 bg-white/10 rounded-full overflow-hidden relative">
                    <div 
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-orange-600 to-yellow-400 transition-all duration-1000"
                        style={{ height: `${(tipCurrent / stream.tipGoal) * 100}%` }}
                    />
                </div>
                 <span className="text-[9px] font-bold text-white">{Math.round((tipCurrent / stream.tipGoal) * 100)}%</span>
            </div>
        </div>

        {/* Chat Overlay (Bottom Left) */}
        <div className="absolute bottom-[88px] left-0 w-full max-w-[85%] pl-4 z-20 mask-image-gradient pointer-events-none">
           <div ref={chatRef} className="max-h-[350px] overflow-y-auto space-y-3 scrollbar-hide pb-2 px-1">
             {messages.map((msg, _i) => (
              <div key={msg.id} className="animate-in slide-in-from-left-4 fade-in duration-300 origin-bottom-left">
                {msg.isTip ? (
                  <div className="bg-gradient-to-r from-aura-gold/90 to-aura-gold/40 border-l-4 border-[#FFD700] backdrop-blur-xl rounded-r-2xl px-4 py-2 w-fit max-w-[95%] shadow-[0_5px_15px_rgba(0,0,0,0.3)]">
                    <div className="flex items-center gap-2 mb-0.5">
                       <span className="text-sm font-black text-[#1A1A2E] drop-shadow-none uppercase tracking-wide">{msg.username}</span>
                       <Badge className="bg-[#1A1A2E]/80 text-aura-gold text-[10px] border-none px-1.5 py-0">TIP {msg.tipAmount}</Badge>
                    </div>
                    <p className="text-sm text-[#1A1A2E] font-bold leading-tight">{msg.content}</p>
                  </div>
                ) : (
                   <div className="bg-[#16213E]/60 backdrop-blur-md rounded-2xl rounded-tl-sm px-3 py-1.5 w-fit max-w-[90%] border border-white/5 shadow-sm">
                      <span className="text-xs font-bold text-gray-400 mr-2">{msg.username}</span>
                      <span className="text-sm text-white font-medium">{msg.content}</span>
                   </div>
                )}
              </div>
             ))}
           </div>
        </div>
        
        {/* Bottom Interaction Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 z-30 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="flex items-center gap-3">
             <div className="relative flex-1 group">
               <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="Say something nice..."
                className="w-full bg-white/5 backdrop-blur-xl text-white text-sm rounded-full px-5 py-3 pr-12 placeholder:text-gray-500 border border-white/10 focus:border-aura-accent/50 focus:bg-white/10 focus:outline-none transition-all shadow-inner"
              />
              <button
                onClick={sendChat}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-aura-accent hover:bg-[#D63B55] flex items-center justify-center transition-all active:scale-95 shadow-lg"
              >
                <Send className="w-4 h-4 text-white ml-0.5" />
              </button>
             </div>
             
             <button
                onClick={() => setShowTipPicker(!showTipPicker)}
                className="w-12 h-12 rounded-full bg-gradient-to-tr from-aura-gold to-[#FDB931] flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.4)] animate-pulse-slow hover:scale-110 transition-transform border-2 border-[#1A1A2E]"
             >
                <Gift className="w-6 h-6 text-[#1A1A2E]" strokeWidth={2.5} />
             </button>
             
             <button
                onClick={sendHeart}
                className="w-12 h-12 rounded-full bg-[#16213E]/60 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors active:scale-90 shadow-lg"
             >
                <Heart className="w-6 h-6 text-aura-accent fill-aura-accent" />
             </button>
          </div>
          
           {/* Tip picker popup */}
          {showTipPicker && (
            <div className="absolute bottom-24 right-4 bg-[#1A1A2E]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 animate-in slide-in-from-bottom-4 zoom-in-95 shadow-2xl shadow-black/80 w-64">
              <div className="flex justify-between items-center mb-3">
                  <span className="text-white font-bold text-sm">Send a Gift</span>
                  <button onClick={() => setShowTipPicker(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[10, 50, 100, 500].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => sendTip(amount)}
                    className="group bg-[#16213E] hover:bg-aura-gold border border-white/5 hover:border-aura-gold rounded-xl py-3 flex flex-col items-center gap-1 transition-all duration-300"
                  >
                    <Coins className="w-5 h-5 text-aura-gold group-hover:text-[#1A1A2E]" />
                    <span className="text-sm font-black text-white group-hover:text-[#1A1A2E]">{amount}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS for floating hearts & scrollbar hide */}
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
          50% { transform: translateY(-150px) scale(1.2) rotate(10deg); opacity: 0.8; }
          100% { transform: translateY(-300px) scale(0.5) rotate(-10deg); opacity: 0; }
        }
        .animate-float-up {
          animation: float-up 2.5s ease-out forwards;
        }
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        .mask-image-gradient {
            mask-image: linear-gradient(to top, black 80%, transparent 100%);
            -webkit-mask-image: linear-gradient(to top, black 80%, transparent 100%);
        }
      `}</style>
    </div>
  );
}
