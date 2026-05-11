import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Plus, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/I18nContext';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

  // Hide bottom nav on detail/chat pages
  if (location.pathname.startsWith('/post/') || location.pathname.startsWith('/chat/')) {
    return null;
  }

  const navItems = [
    { path: '/', icon: Home, label: t.nav.home },
    { path: '/explore', icon: Search, label: t.nav.explore },
    { path: '/create', icon: Plus, label: t.nav.create, isFab: true },
    { path: '/messages', icon: MessageSquare, label: t.nav.messages },
    { path: '/profile', icon: User, label: t.nav.profile },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/40 safe-area-bottom pb-1 transition-all duration-300">
      <div className="flex items-center justify-around px-2 max-w-lg mx-auto h-[60px] relative">
        {navItems.map(({ path, icon: Icon, label, isFab }) => {
          const isActive = location.pathname === path;
          
          if (isFab) {
            return (
              <div key={path} className="relative -top-6">
                <button
                  onClick={() => navigate(path)}
                  className="group flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-aura to-aura-light text-white shadow-lg shadow-aura/40 hover:scale-105 active:scale-95 transition-all duration-300 ring-4 ring-background"
                >
                  <Icon className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" strokeWidth={2.5} />
                </button>
              </div>
            );
          }

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-1 active:scale-90 transition-all duration-300 relative group",
                isActive ? "text-aura" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={label}
            >
              <Icon 
                className={cn(
                  "w-[26px] h-[26px] transition-all duration-300",
                  isActive ? "fill-current text-aura scale-110" : "text-muted-foreground group-hover:text-foreground"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {isActive && (
                <div className="absolute -bottom-2 w-8 h-0.5 rounded-full bg-gradient-to-r from-aura/50 via-aura to-aura/50 animate-in fade-in slide-in-from-bottom-1 duration-300" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
