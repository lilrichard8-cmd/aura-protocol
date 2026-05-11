import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Coins, Image, Lock, Play, DollarSign, MoreVertical, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { conversations, messagesByConversation } from '@/data/mock';
import type { Message, Conversation } from '@/data/mock';

export default function MessagesPage() {
  const navigate = useNavigate();
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [localMessages, setLocalMessages] = useState<Record<string, Message[]>>(messagesByConversation);
  const [, setShowPPVUnlock] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = activeConv ? (localMessages[activeConv.id] || []) : [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeConv]);

  const sendMessage = () => {
    if (!messageText.trim() || !activeConv) return;
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      senderId: 'me',
      senderName: 'You',
      senderAvatar: '',
      content: messageText,
      timestamp: 'Just now',
      isOwn: true,
      isPaid: false,
      isPPV: false,
    };
    setLocalMessages((prev) => ({
      ...prev,
      [activeConv.id]: [...(prev[activeConv.id] || []), newMsg],
    }));
    setMessageText('');
  };

  const unlockPPV = (msgId: string) => {
    setLocalMessages((prev) => {
      const convId = activeConv!.id;
      return {
        ...prev,
        [convId]: prev[convId].map((m) =>
          m.id === msgId ? { ...m, ppvUnlocked: true } : m
        ),
      };
    });
    setShowPPVUnlock(null);
  };

  // Conversation List
  if (!activeConv) {
    return (
      <div className="min-h-screen pb-24 md:pb-8 bg-[#1A1A2E]">
        <header className="sticky top-0 z-30 bg-[#1A1A2E]/90 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between md:ml-64">
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              Messages
              <Badge className="bg-aura-accent text-white text-[10px] h-5 px-1.5 rounded-full">3 New</Badge>
            </h1>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-full hover:bg-white/5">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-4 space-y-2 md:ml-64">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConv(conv)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all duration-300 border border-transparent hover:border-white/5 group active:scale-[0.98]"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-aura-accent/50 to-transparent group-hover:from-aura-accent group-hover:to-[#D63B55] transition-colors">
                  <img
                    src={conv.participantAvatar}
                    alt={conv.participantName}
                    className="w-full h-full rounded-full bg-[#1A1A2E] object-cover border-2 border-[#1A1A2E]"
                  />
                </div>
                {conv.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-[#1A1A2E] shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-white group-hover:text-aura-accent transition-colors">{conv.participantName}</span>
                  <span className="text-[10px] text-gray-500 font-medium">{conv.lastMessageTime}</span>
                </div>
                <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-gray-200 font-medium' : 'text-gray-500 group-hover:text-gray-400'}`}>
                  {conv.unreadCount > 0 && <span className="text-aura-accent mr-1">●</span>}
                  {conv.lastMessage}
                </p>
              </div>
              {conv.unreadCount > 0 && (
                <div className="w-5 h-5 bg-aura-accent rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-[0_0_10px_rgba(233,69,96,0.4)] animate-pulse">
                  {conv.unreadCount}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Chat View
  return (
    <div className="fixed inset-0 z-40 bg-[#1A1A2E] flex flex-col">
      {/* Chat Header */}
      <header className="sticky top-0 z-30 bg-[#1A1A2E]/95 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-4 h-16 md:ml-64">
          <button
            onClick={() => setActiveConv(null)}
            className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center -ml-2 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          
          <div
            className="flex items-center gap-3 flex-1 cursor-pointer group"
            onClick={() => navigate(`/creator/${activeConv.participantId}`)}
          >
            <div className="relative">
              <img src={activeConv.participantAvatar} alt="" className="w-10 h-10 rounded-full bg-[#1A1A2E] object-cover border border-white/10" />
              {activeConv.isOnline && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#1A1A2E]" />
              )}
            </div>
            <div>
              <span className="text-sm font-bold text-white group-hover:text-aura-accent transition-colors block">{activeConv.participantName}</span>
              <p className="text-[10px] text-green-400 font-medium flex items-center gap-1">
                {activeConv.isOnline ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Online
                  </>
                ) : 'Offline'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-full hover:bg-white/5">
              <Phone className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-full hover:bg-white/5">
              <Video className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-lg mx-auto w-full scroll-smooth bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-[0.03]"
      >
        <div className="text-center py-4">
           <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Encrypted via Solana</p>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.isOwn ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-500 fade-in`}>
            <div className={`max-w-[75%] flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}>
              
              {/* PPV message */}
              {msg.isPPV && (
                <div className="rounded-2xl overflow-hidden border border-white/10 mb-1 shadow-2xl shadow-black/50 max-w-xs group bg-[#16213E]">
                  <div className="relative aspect-[3/4] min-w-[220px]">
                    <img
                      src={msg.ppvThumbnail}
                      alt=""
                      className={`w-full h-full object-cover transition-all duration-700 ${!msg.ppvUnlocked ? 'blur-xl scale-110 opacity-60' : ''}`}
                    />
                    
                    {/* Glass overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#16213E]/80" />

                    {!msg.ppvUnlocked ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 z-10">
                        <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-pulse-slow">
                          <Lock className="w-6 h-6 text-white/90 drop-shadow-md" />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => unlockPPV(msg.id)}
                          className="w-full bg-gradient-to-r from-aura-accent to-[#D63B55] hover:from-[#FF5E78] hover:to-aura-accent hover:shadow-[0_0_20px_rgba(233,69,96,0.5)] text-white text-xs font-bold rounded-xl h-10 border border-white/10 transition-all duration-300 transform active:scale-95"
                        >
                          <Coins className="w-3.5 h-3.5 mr-1.5 text-white" />
                          UNLOCK {msg.ppvPrice} ORA
                        </Button>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group cursor-pointer hover:bg-black/10 transition-colors">
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform border border-white/20 shadow-lg">
                          <Play className="w-7 h-7 text-white fill-white ml-1 drop-shadow-md" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-[#1A1A2E] border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exclusive Content</span>
                    {!msg.ppvUnlocked && <Lock className="w-3 h-3 text-aura-accent" />}
                  </div>
                </div>
              )}

              {/* Voice message */}
              {msg.isVoice && (
                <div className={`rounded-2xl px-4 py-3 shadow-md backdrop-blur-md border flex items-center gap-3 mb-1 ${
                  msg.isOwn 
                    ? 'bg-gradient-to-br from-aura-accent to-[#D63B55] border-white/10 text-white' 
                    : 'bg-[#16213E]/80 border-white/5 text-gray-200'
                }`}>
                  <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 ${msg.isOwn ? 'bg-white/20' : 'bg-aura-accent/20'}`}>
                    <Play className={`w-3.5 h-3.5 ml-0.5 ${msg.isOwn ? 'text-white fill-white' : 'text-aura-accent fill-aura-accent'}`} />
                  </button>
                  <div className="flex gap-0.5 items-center h-4">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-0.5 rounded-full ${msg.isOwn ? 'bg-white/80' : 'bg-aura-accent/60'}`}
                        style={{ 
                          height: `${Math.random() * 12 + 4}px`, 
                          opacity: Math.random() * 0.5 + 0.5 
                        }}
                      />
                    ))}
                  </div>
                  <span className={`text-[10px] font-mono ${msg.isOwn ? 'text-white/80' : 'text-gray-500'}`}>{msg.voiceDuration}s</span>
                </div>
              )}

              {/* Paid message (tip) */}
              {msg.isPaid && !msg.isPPV && (
                <div className="bg-gradient-to-r from-aura-gold/10 to-[#1A1A2E] border border-aura-gold/30 rounded-2xl px-4 py-3 flex items-center gap-3 mb-1 shadow-[0_0_20px_rgba(245,158,11,0.1)] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-aura-gold/5 animate-pulse-slow" />
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-aura-gold to-amber-700 flex items-center justify-center border border-aura-gold/30 shadow-lg relative z-10">
                     <Coins className="w-5 h-5 text-white" />
                  </div>
                  <div className="relative z-10">
                    <span className="text-sm text-aura-gold font-black block tracking-wide drop-shadow-sm">
                      TIPPED {msg.paidAmount} ORA
                    </span>
                    <span className="text-[10px] text-aura-gold/70 font-medium">Transaction Verified</span>
                  </div>
                </div>
              )}

              {/* Regular text message */}
              {msg.content && !msg.isPaid && (
                <div className={`rounded-2xl px-5 py-3 shadow-lg backdrop-blur-sm border mb-1 relative group transition-all hover:scale-[1.01] ${
                  msg.isOwn
                    ? 'bg-gradient-to-br from-aura-accent to-[#D63B55] text-white rounded-tr-sm border-white/10'
                    : 'bg-[#16213E]/80 text-gray-100 rounded-tl-sm border-white/5'
                }`}>
                  <p className="text-sm leading-relaxed font-normal">{msg.content}</p>
                </div>
              )}

              <span className={`text-[9px] font-medium px-1 opacity-60 ${msg.isOwn ? 'text-right' : 'text-left'} text-gray-400`}>
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Tip overlay */}
      {showTip && (
        <div className="absolute bottom-24 left-4 right-4 max-w-lg mx-auto bg-[#16213E] border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/80 z-20 animate-in slide-in-from-bottom-4 zoom-in-95">
          <div className="flex items-center justify-between mb-4">
             <p className="text-sm text-white font-bold flex items-center gap-2">
              <Coins className="w-4 h-4 text-aura-gold" />
              Send a Tip
            </p>
            <button onClick={() => setShowTip(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
          </div>
          
          <div className="grid grid-cols-4 gap-3">
            {[5, 10, 25, 50].map((amount) => (
              <button
                key={amount}
                onClick={() => {
                  const tipMsg: Message = {
                    id: `m-${Date.now()}`,
                    senderId: 'me',
                    senderName: 'You',
                    senderAvatar: '',
                    content: '',
                    timestamp: 'Just now',
                    isOwn: true,
                    isPaid: true,
                    paidAmount: amount,
                    isPPV: false,
                  };
                  setLocalMessages((prev) => ({
                    ...prev,
                    [activeConv.id]: [...(prev[activeConv.id] || []), tipMsg],
                  }));
                  setShowTip(false);
                }}
                className="flex flex-col items-center justify-center gap-1 bg-aura-gold/5 hover:bg-aura-gold/20 border border-aura-gold/20 hover:border-aura-gold/50 text-aura-gold py-3 rounded-xl transition-all duration-300 active:scale-95 group"
              >
                <span className="text-lg font-black group-hover:scale-110 transition-transform">{amount}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">ORA</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="sticky bottom-0 bg-[#1A1A2E]/95 backdrop-blur-xl border-t border-white/5 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-white/5">
            <Image className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowTip(!showTip)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border ${showTip ? 'bg-aura-gold text-[#1A1A2E] border-aura-gold shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-aura-gold/10 text-aura-gold border-aura-gold/20 hover:bg-aura-gold/20'}`}
          >
            <DollarSign className="w-5 h-5 font-bold" strokeWidth={3} />
          </button>
          <div className="flex-1 relative group">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Message..."
              className="w-full bg-[#0F172A] text-white text-sm rounded-full px-5 py-3 pr-12 placeholder:text-gray-600 border border-white/5 focus:border-aura-accent/50 focus:ring-1 focus:ring-aura-accent/50 focus:outline-none transition-all shadow-inner"
            />
            <button
              onClick={sendMessage}
              disabled={!messageText.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-aura-accent hover:bg-[#D63B55] disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-lg active:scale-90"
            >
              <Send className="w-4 h-4 text-white ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
