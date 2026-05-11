import { useState, useEffect, useRef, useCallback } from 'react';

interface DanmakuMessage {
  id: string;
  text: string;
  top: number;
  duration: number;
}

const MOCK_DANMAKU = [
  '🔥 Amazing!', 'Love this stream!', '❤️❤️❤️', 'So talented!',
  'How do you do that?', 'Incredible technique!', 'First time here, love it!',
  'Subscribed!', '👏👏👏', 'Best stream today', 'Can you explain that?',
  'Wow this is beautiful', 'Take my ORA 💰', '🎨 Art goals',
  'This is why I love AURA', 'Keep going!', 'Genius level',
  'My favorite creator', '🌟🌟🌟', 'Teaching us so much',
];

interface DanmakuProps {
  enabled: boolean;
  className?: string;
}

export default function Danmaku({ enabled, className = '' }: DanmakuProps) {
  const [messages, setMessages] = useState<DanmakuMessage[]>([]);
  const idRef = useRef(0);

  const addMessage = useCallback(() => {
    const text = MOCK_DANMAKU[Math.floor(Math.random() * MOCK_DANMAKU.length)];
    const id = `d${idRef.current++}`;
    const top = 5 + Math.random() * 80;
    const duration = 6 + Math.random() * 4;
    setMessages(prev => [...prev.slice(-30), { id, text, top, duration }]);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(addMessage, 2000 + Math.random() * 1000);
    return () => clearInterval(interval);
  }, [enabled, addMessage]);

  useEffect(() => {
    if (!enabled) setMessages([]);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {messages.map(msg => (
        <div
          key={msg.id}
          className="absolute whitespace-nowrap text-sm text-white/90 px-2 py-0.5 rounded bg-black/20"
          style={{
            top: `${msg.top}%`,
            animation: `danmakuSlide ${msg.duration}s linear forwards`,
          }}
          onAnimationEnd={() => setMessages(prev => prev.filter(m => m.id !== msg.id))}
        >
          {msg.text}
        </div>
      ))}
      <style>{`
        @keyframes danmakuSlide {
          0% { right: -300px; opacity: 1; }
          90% { opacity: 1; }
          100% { right: 110%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
