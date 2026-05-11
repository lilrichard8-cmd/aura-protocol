import { Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '@/components/common/NotificationBell';
import { useI18n } from '@/context/I18nContext';

export default function Header() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled 
          ? 'bg-background/85 backdrop-blur-2xl border-b border-border/50 shadow-lg shadow-black/5' 
          : 'bg-gradient-to-b from-background/20 to-transparent'
      }`}
    >
      <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
        <h1 className={`text-xl font-bold tracking-tight transition-all duration-300 ${
          scrolled 
            ? 'bg-gradient-to-r from-aura via-aura-light to-aura bg-clip-text text-transparent' 
            : 'text-aura drop-shadow-sm'
        }`}>
{t.header.title}
        </h1>
        
        <div className="flex items-center gap-3">
          {/* ORA Balance Pill */}
          <button onClick={() => navigate('/wallet')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ora/15 hover:bg-ora/25 text-ora text-xs font-semibold transition-all duration-300 hover:scale-105 active:scale-95 border border-ora/30 hover:border-ora/50 shadow-sm hover:shadow-ora/20">
            <Wallet className="w-3.5 h-3.5" />
            <span>245.8</span>
          </button>

          {/* Notification Bell */}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
