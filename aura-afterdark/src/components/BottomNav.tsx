import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Plus, MessageSquare, User, Wallet, Coins } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on live stream page
  if (location.pathname.startsWith('/live/')) return null;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#16213E]/80 backdrop-blur-xl border-t border-white/5 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2 relative">
        
        {/* Home */}
        <button
          onClick={() => navigate('/')}
          className={`flex flex-col items-center justify-center gap-1 w-14 transition-colors ${
            isActive('/') ? 'text-aura-accent' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Home className={`w-6 h-6 transition-transform duration-300 ${isActive('/') ? 'fill-current scale-110 drop-shadow-[0_0_8px_rgba(233,69,96,0.6)]' : ''}`} strokeWidth={isActive('/') ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium tracking-wide">Home</span>
        </button>

        {/* Discover */}
        <button
          onClick={() => navigate('/discover')}
          className={`flex flex-col items-center justify-center gap-1 w-14 transition-colors ${
            isActive('/discover') ? 'text-aura-accent' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Search className={`w-6 h-6 transition-transform duration-300 ${isActive('/discover') ? 'scale-110 drop-shadow-[0_0_8px_rgba(233,69,96,0.6)]' : ''}`} strokeWidth={isActive('/discover') ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium tracking-wide">Discover</span>
        </button>

        {/* Wallet */}
        <button
          onClick={() => navigate('/wallet')}
          className={`flex flex-col items-center justify-center gap-1 w-14 transition-colors ${
            isActive('/wallet') ? 'text-aura-accent' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Wallet className={`w-6 h-6 transition-transform duration-300 ${isActive('/wallet') ? 'scale-110 drop-shadow-[0_0_8px_rgba(233,69,96,0.6)]' : ''}`} strokeWidth={isActive('/wallet') ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium tracking-wide">Wallet</span>
        </button>

        {/* Staking */}
        <button
          onClick={() => navigate('/staking')}
          className={`flex flex-col items-center justify-center gap-1 w-14 transition-colors ${
            isActive('/staking') ? 'text-aura-accent' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Coins className={`w-6 h-6 transition-transform duration-300 ${isActive('/staking') ? 'scale-110 drop-shadow-[0_0_8px_rgba(233,69,96,0.6)]' : ''}`} strokeWidth={isActive('/staking') ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium tracking-wide">Staking</span>
        </button>

        {/* Enhanced CREATE BUTTON (Floating) */}
        <div className="relative -top-6">
          <div className="absolute inset-0 rounded-full bg-aura-accent/30 blur-xl animate-pulse-slow" />
          <button
            onClick={() => navigate('/create')}
            className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-aura-accent via-[#FF5E78] to-[#D63B55] flex items-center justify-center shadow-[0_8px_25px_rgba(233,69,96,0.5)] border-4 border-[#16213E] transform transition-all duration-300 active:scale-90 hover:scale-110 hover:shadow-[0_12px_40px_rgba(233,69,96,0.7)] z-10 group"
          >
            {/* Rotating glow ring */}
            <div className="absolute inset-0 rounded-full border-2 border-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                 style={{ 
                   background: 'conic-gradient(from 0deg, transparent, rgba(255, 94, 120, 0.8), transparent)',
                   animation: 'spin 2s linear infinite'
                 }} />
            <Plus className="w-8 h-8 text-white drop-shadow-2xl group-hover:rotate-90 transition-transform duration-300" strokeWidth={3} />
          </button>
        </div>

        {/* Enhanced Messages */}
        <button
          onClick={() => navigate('/messages')}
          className={`flex flex-col items-center justify-center gap-1 w-14 transition-all duration-300 relative ${
            isActive('/messages') ? 'text-aura-accent' : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="relative">
            <MessageSquare className={`w-6 h-6 transition-all duration-300 ${isActive('/messages') ? 'fill-current scale-110 drop-shadow-[0_0_12px_rgba(233,69,96,0.8)]' : ''}`} strokeWidth={isActive('/messages') ? 2.5 : 1.5} />
            {/* Enhanced notification dot */}
            <div className="absolute -top-1 -right-1">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-[#16213E] shadow-lg"></span>
            </div>
          </div>
          <span className="text-[10px] font-medium tracking-wide">DMs</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => navigate('/profile')}
          className={`flex flex-col items-center justify-center gap-1 w-14 transition-colors ${
            isActive('/profile') ? 'text-aura-accent' : 'text-gray-400 hover:text-white'
          }`}
        >
          <User className={`w-6 h-6 transition-transform duration-300 ${isActive('/profile') ? 'fill-current scale-110 drop-shadow-[0_0_8px_rgba(233,69,96,0.6)]' : ''}`} strokeWidth={isActive('/profile') ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium tracking-wide">Me</span>
        </button>

      </div>
    </nav>
  );
}
