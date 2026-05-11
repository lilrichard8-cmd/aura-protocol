import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Eye, Heart, DollarSign, Star, Send, Users, Gift, Lock, Crown } from 'lucide-react';
import { mockLiveStreams } from '@/data/mockLive';
import { ChatMessage } from '@/types/live';
import TipModal from '@/components/TipModal';

const mockChatMessages: ChatMessage[] = [
  { id: '1', username: 'crypto_whale', message: '🔥🔥🔥 Amazing work!', timestamp: Date.now() - 5000 },
  { id: '2', username: 'art_lover', message: 'Can you paint a dragon?', timestamp: Date.now() - 4500 },
  { id: '3', username: 'patron_vip', message: 'Tipped 25 ORA', timestamp: Date.now() - 4000, isTip: true, tipAmount: 25 },
  { id: '4', username: 'nightowl', message: 'Love the colors!', timestamp: Date.now() - 3500 },
  { id: '5', username: 'mystery_fan', message: 'First time here, this is incredible', timestamp: Date.now() - 3000 },
  { id: '6', username: 'system', message: 'shadow_artist joined the stream', timestamp: Date.now() - 2500, isSystem: true },
  { id: '7', username: 'diamond_hands', message: 'Tipped 100 ORA', timestamp: Date.now() - 2000, isTip: true, tipAmount: 100 },
  { id: '8', username: 'creative_soul', message: 'Your technique is amazing!', timestamp: Date.now() - 1500 },
];

export default function LiveViewPage() {
  const { id } = useParams<{ id: string }>();
  const [chatMessage, setChatMessage] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [chatMessages, setChatMessages] = useState(mockChatMessages);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Find the stream (in real app, fetch by ID)
  const stream = mockLiveStreams.find(s => s.id === id) || mockLiveStreams[0];
  
  useEffect(() => {
    // Simulate new chat messages
    const interval = setInterval(() => {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        username: ['fan_42', 'night_viewer', 'art_seeker'][Math.floor(Math.random() * 3)],
        message: ['Amazing!', 'Love this stream', '🔥🔥', 'So talented', 'Keep going!'][Math.floor(Math.random() * 5)],
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev.slice(-20), newMessage]); // Keep last 20 messages
    }, 8000);
    
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  const sendMessage = () => {
    if (!chatMessage.trim()) return;
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      username: 'You',
      message: chatMessage,
      timestamp: Date.now(),
    };
    
    setChatMessages(prev => [...prev, newMessage]);
    setChatMessage('');
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    return minutes < 1 ? 'now' : `${minutes}m ago`;
  };
  
  return (
    <div className="min-h-screen bg-aura-bg text-aura-text">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 max-w-8xl mx-auto">
        {/* Video Player */}
        <div className="lg:col-span-3">
          <div className="relative bg-black rounded-lg overflow-hidden mb-6">
            <div className="aspect-video flex items-center justify-center">
              <img
                src={stream.thumbnail}
                alt=""
                className="w-full h-full object-cover"
              />
              
              {/* Video Player Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60">
                {/* Top Bar */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-sm font-medium">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      LIVE
                    </div>
                    <div className="flex items-center gap-1 px-3 py-1 bg-black/50 text-white rounded-full text-sm">
                      <Eye className="w-4 h-4" />
                      {stream.viewerCount.toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button className="w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors">
                      <Heart className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* Bottom Bar */}
                <div className="absolute bottom-4 left-4 right-4">
                  {/* Tip Progress */}
                  {stream.tipGoal && (
                    <div className="mb-4">
                      <div className="bg-black/50 rounded p-3">
                        <div className="flex justify-between text-sm text-white mb-2">
                          <span>Tip Goal Progress</span>
                          <span>${stream.tipCurrent} / ${stream.tipGoal}</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-aura-gold h-2 rounded-full transition-all"
                            style={{ width: `${((stream.tipCurrent || 0) / stream.tipGoal) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Stream Info */}
          <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <img
                  src={stream.creator.avatar}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{stream.creator.displayName}</h2>
                    {stream.creator.isVerified && (
                      <Star className="w-5 h-5 text-aura-gold" fill="currentColor" />
                    )}
                  </div>
                  <p className="text-aura-text-secondary">@{stream.creator.username}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSubscribed(!isSubscribed)}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    isSubscribed
                      ? 'bg-aura-surface border border-aura-border text-aura-text'
                      : 'bg-aura-accent hover:bg-aura-accent-hover text-white'
                  }`}
                >
                  {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
                
                <button className="flex items-center gap-2 px-4 py-2 bg-aura-surface hover:bg-aura-surface/80 border border-aura-border rounded-lg transition-colors">
                  <Lock className="w-4 h-4" />
                  Private Show
                </button>
              </div>
            </div>
            
            <h1 className="text-2xl font-bold mb-2">{stream.title}</h1>
            
            <div className="flex items-center gap-6 text-sm text-aura-text-secondary">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {stream.viewerCount.toLocaleString()} viewers
              </span>
              <span className="capitalize">{stream.category}</span>
              {stream.isTicketed && (
                <span className="flex items-center gap-1 text-aura-gold">
                  <Crown className="w-4 h-4" />
                  Premium Show - ${stream.ticketPrice}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Chat Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-aura-card rounded-lg border border-aura-border h-full flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-aura-border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Live Chat
                </h3>
                <button
                  onClick={() => setShowTipModal(true)}
                  className="flex items-center gap-1 px-3 py-1 bg-aura-gold hover:bg-aura-gold-hover text-black rounded-lg text-sm font-medium transition-colors"
                >
                  <Gift className="w-4 h-4" />
                  Tip
                </button>
              </div>
            </div>
            
            {/* Chat Messages */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-96 lg:max-h-[500px]">
              {chatMessages.map(message => (
                <div key={message.id} className="text-sm">
                  {message.isSystem ? (
                    <p className="text-aura-text-secondary italic text-center">
                      {message.message}
                    </p>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium ${
                          message.username === 'You' ? 'text-aura-accent' : 'text-aura-text'
                        }`}>
                          {message.username}
                        </span>
                        {message.isTip && (
                          <span className="px-2 py-0.5 bg-aura-gold text-black text-xs font-bold rounded">
                            ${message.tipAmount}
                          </span>
                        )}
                        <span className="text-xs text-aura-text-secondary">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                      <p className={`text-aura-text-secondary break-words ${
                        message.isTip ? 'text-aura-gold font-medium' : ''
                      }`}>
                        {message.message}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat Input */}
            <div className="p-4 border-t border-aura-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Say something..."
                  className="flex-1 px-3 py-2 bg-aura-surface border border-aura-border rounded-lg focus:outline-none focus:border-aura-accent text-sm"
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatMessage.trim()}
                  className="px-3 py-2 bg-aura-accent hover:bg-aura-accent-hover disabled:bg-aura-surface disabled:text-aura-text-secondary text-white rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tip Modal */}
      {showTipModal && (
        <TipModal
          recipientName={stream.creator.displayName}
          recipientAvatar={stream.creator.avatar}
          onClose={() => setShowTipModal(false)}
        />
      )}
    </div>
  );
}