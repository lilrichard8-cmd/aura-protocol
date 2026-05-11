import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Plus, 
  MessageSquare, 
  User, 
  ShoppingBag,
  Sparkles,
  Vote,
  Radio,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Users,
  Trophy,
  Gift,
  Coins,
  BarChart3,
  Bell,
  Settings
} from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';

const navigationItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/discover', icon: Search, label: 'Discover' },
  { path: '/dashboard', icon: BarChart3, label: 'Dashboard' },
  { path: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
  { path: '/curation', icon: Sparkles, label: 'Curation' },
  { path: '/creator-coin', icon: Coins, label: 'Creator Coin' },
  { path: '/rankings', icon: Trophy, label: 'Rankings' },
  { path: '/rewards', icon: Gift, label: 'Rewards' },
  { path: '/incentives', icon: Sparkles, label: 'Incentives' },
  { path: '/following', icon: Users, label: 'Following' },
  { path: '/governance', icon: Vote, label: 'Governance' },
  { path: '/staking', icon: Coins, label: 'Staking' },
  { path: '/create', icon: Plus, label: 'Create' },
  { path: '/live-browse', icon: Radio, label: 'Live' },
  { path: '/messages', icon: MessageSquare, label: 'Messages' },
  { path: '/notifications', icon: Bell, label: 'Notifications' },
  { path: '/wallet', icon: Wallet, label: 'Wallet' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('aura-sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('aura-sidebar-collapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  // Hide sidebar on live stream page
  if (location.pathname.startsWith('/live/')) return null;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside className={`fixed left-0 top-0 z-40 h-full transition-all duration-300 ease-out hidden md:block ${
      collapsed ? 'w-20' : 'w-64'
    } bg-[#16213E]/95 backdrop-blur-xl border-r border-white/10`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {!collapsed && (
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2 group cursor-pointer">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 group-hover:from-aura-accent group-hover:to-[#D63B55] transition-all duration-500">AURA</span>
            <span className="text-aura-accent/80 text-[8px] font-bold tracking-[0.15em] uppercase border-l-2 border-aura-accent/20 pl-2 group-hover:text-white transition-colors">After Dark</span>
          </h1>
        )}
        
        <div className="flex items-center gap-2">
          {!collapsed && <NotificationBell />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group relative ${
                active
                  ? 'bg-aura-accent/20 text-aura-accent border border-aura-accent/30 shadow-lg shadow-aura-accent/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title={collapsed ? item.label : ''}
            >
              {/* Active indicator */}
              {active && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-aura-accent rounded-r-full" />
              )}
              
              <Icon className={`w-5 h-5 transition-all duration-300 ${
                active ? 'scale-110 drop-shadow-[0_0_8px_rgba(233,69,96,0.6)]' : 'group-hover:scale-105'
              }`} strokeWidth={active ? 2.5 : 1.5} />
              
              {!collapsed && (
                <span className={`font-medium text-sm transition-colors ${
                  active ? 'text-aura-accent' : 'text-gray-300 group-hover:text-white'
                }`}>
                  {item.label}
                </span>
              )}
              
              {/* Notification badges */}
              {item.path === '/messages' && !collapsed && (
                <div className="ml-auto">
                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                    2
                  </span>
                </div>
              )}
              
              {item.path === '/messages' && collapsed && (
                <div className="absolute -top-1 -right-1">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-[#16213E]"></span>
                </div>
              )}
            </button>
          );
        })}
      </nav>
      
      {/* Bottom section */}
      <div className="p-4 border-t border-white/10">
        <div className={`bg-aura-gold/10 border border-aura-gold/20 rounded-lg p-3 ${collapsed ? 'text-center' : ''}`}>
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aura-gold opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-aura-gold"></span>
                </span>
                <span className="text-xs font-medium text-gray-400">ORA Balance</span>
              </div>
              <span className="text-aura-gold font-mono font-bold text-sm">2,450.75</span>
            </>
          ) : (
            <div className="relative">
              <Wallet className="w-5 h-5 text-aura-gold mx-auto" />
              <div className="absolute -top-1 -right-1">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-aura-gold opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-aura-gold"></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}