import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Minus, Send } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { callIrisChat } from '@/lib/iris-chat';

interface Message {
  id: number;
  role: 'user' | 'iris';
  text: string;
}

// LLM key NEVER lives in the browser bundle. The Gemini call now goes
// through supabase/functions/iris-chat. See src/lib/iris-chat.ts.
const callGeminiAPI = callIrisChat;

export default function IrisChat() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'iris', text: '' }, // placeholder, will use t
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [buttonDragging, setButtonDragging] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [buttonPos, setButtonPos] = useState({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const buttonDragOffset = useRef({ x: 0, y: 0 });
  const longPressTimer = useRef<number | undefined>(undefined);
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(1);

  // Initialize position
  useEffect(() => {
    if (!pos.x && !pos.y) {
      setPos({ 
        x: window.innerWidth - 400, 
        y: window.innerHeight - 500 
      });
    }
    if (!buttonPos.x && !buttonPos.y) {
      setButtonPos({ 
        x: 24, 
        y: window.innerHeight - 120 
      });
    }
  }, [pos.x, pos.y, buttonPos.x, buttonPos.y]);

  // Update greeting when locale changes
  useEffect(() => {
    setMessages(prev => {
      const copy = [...prev];
      if (copy[0] && copy[0].id === 0) {
        copy[0] = { ...copy[0], text: t.iris.greeting };
      }
      return copy;
    });
  }, [t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
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
    } catch (error) {
      const errorReply: Message = { 
        id: idCounter.current++, 
        role: 'iris', 
        text: 'Sorry, I\'m a bit busy right now. Try again shortly 🌸' 
      };
      setMessages(prev => [...prev, errorReply]);
    } finally {
      setLoading(false);
    }
  };

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    setDragging(true);
    const rect = chatRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  }, []);

  // Floating button drag
  const onButtonMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    longPressTimer.current = window.setTimeout(() => {
      setButtonDragging(true);
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      buttonDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }, 300);
  }, []);

  const onButtonMouseUp = useCallback((_e: React.MouseEvent) => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
    }
    if (!buttonDragging) {
      // Calculate initial chat window position based on button position
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const chatWidth = 384; // w-80 md:w-96 -> 384px
      const chatHeight = 500; // Estimated chat window height
      
      let newX = buttonPos.x;
      let newY = buttonPos.y;
      
      // If button is on the right half of the screen, show window to the upper-left
      if (buttonPos.x > windowWidth / 2) {
        newX = buttonPos.x - chatWidth - 20; // 20px gap
      } else {
        // If button is on the left half, show window to the upper-right
        newX = buttonPos.x + 56 + 20; // button width + gap
      }
      
      // Vertical position: above the button if possible, but within screen bounds
      newY = Math.max(20, buttonPos.y - chatHeight + 56); // 56 is button height
      
      // Ensure window stays within screen bounds
      newX = Math.max(20, Math.min(newX, windowWidth - chatWidth - 20));
      newY = Math.max(20, Math.min(newY, windowHeight - chatHeight - 20));
      
      setPos({ x: newX, y: newY });
      setOpen(true);
    }
    setButtonDragging(false);
  }, [buttonDragging, buttonPos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  useEffect(() => {
    if (!buttonDragging) return;
    const onMove = (e: MouseEvent) => {
      const newButtonPos = { x: e.clientX - buttonDragOffset.current.x, y: e.clientY - buttonDragOffset.current.y };
      setButtonPos(newButtonPos);
      
      // If chat window is open, move it along with the button
      if (open && !minimized) {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const chatWidth = 384;
        const chatHeight = 500;
        
        let newX = newButtonPos.x;
        let newY = newButtonPos.y;
        
        // If button is on the right half, show window to the upper-left
        if (newButtonPos.x > windowWidth / 2) {
          newX = newButtonPos.x - chatWidth - 20;
        } else {
          // If button is on the left half, show window to the upper-right
          newX = newButtonPos.x + 56 + 20;
        }
        
        // Vertical position: above the button if possible, within screen bounds
        newY = Math.max(20, newButtonPos.y - chatHeight + 56);
        
        // Ensure window stays within screen bounds
        newX = Math.max(20, Math.min(newX, windowWidth - chatWidth - 20));
        newY = Math.max(20, Math.min(newY, windowHeight - chatHeight - 20));
        
        setPos({ x: newX, y: newY });
      }
    };
    const onUp = () => setButtonDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [buttonDragging, open, minimized]);

  // Bubble button
  if (!open) {
    const buttonStyle: React.CSSProperties = buttonPos.x || buttonPos.y
      ? { position: 'fixed', left: buttonPos.x, top: buttonPos.y, zIndex: 50 }
      : { position: 'fixed', bottom: '1.5rem', left: '1.5rem', zIndex: 50 };

    return (
      <button
        style={buttonStyle}
        onMouseDown={onButtonMouseDown}
        onMouseUp={onButtonMouseUp}
        className={`w-14 h-14 rounded-full bg-gradient-to-tr from-aura to-ora text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform text-2xl ${
          buttonDragging ? 'cursor-grabbing' : 'cursor-pointer'
        }`}
        title="Iris AI"
      >
        🌸
      </button>
    );
  }

  // Minimized bar
  if (minimized) {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-6 z-50 flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 shadow-lg cursor-pointer" onClick={() => setMinimized(false)}>
        <span className="text-lg">🌸</span>
        <span className="text-sm font-medium">{t.iris.title}</span>
        <button onClick={(e) => { e.stopPropagation(); setOpen(false); setMinimized(false); }} className="p-1 hover:bg-accent rounded-full">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const style: React.CSSProperties = pos.x || pos.y
    ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 50 }
    : { position: 'fixed', bottom: '5rem', right: '1.5rem', zIndex: 50 };

  return (
    <div 
      ref={chatRef} 
      style={style} 
      className={`w-80 md:w-96 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[70vh] ${
        dragging ? 'cursor-grabbing' : ''
      }`}
    >
      {/* Title bar - draggable */}
      <div onMouseDown={onMouseDown} className={`flex items-center justify-between px-4 py-3 bg-gradient-to-r from-aura/10 to-ora/10 border-b border-border select-none ${
        dragging ? 'cursor-grabbing' : 'cursor-move'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🌸</span>
          <span className="font-semibold text-sm">{t.iris.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1.5 hover:bg-accent rounded-lg transition-colors">
            <Minus className="w-4 h-4" />
          </button>
          <button onClick={() => { setOpen(false); setMinimized(false); }} className="p-1.5 hover:bg-accent rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
              msg.role === 'user'
                ? 'bg-aura text-white rounded-br-md'
                : 'bg-secondary text-foreground rounded-bl-md'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-3 py-2 rounded-2xl text-sm bg-secondary text-foreground rounded-bl-md flex items-center gap-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-aura rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-aura rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-aura rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && send()}
            placeholder={loading ? 'Waiting...' : t.iris.placeholder}
            disabled={loading}
            className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-aura/30 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button 
            onClick={send} 
            disabled={loading || !input.trim()}
            className="p-2 rounded-xl bg-aura text-white hover:bg-aura/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
