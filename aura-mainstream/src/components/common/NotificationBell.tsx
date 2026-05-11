import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@/data/mockP1';
import { useMockChain } from '@/context/MockChainContext';

interface NotificationBellProps {
  className?: string;
}

export default function NotificationBell({ className }: NotificationBellProps) {
  const navigate = useNavigate();
  const mockChain = useMockChain();
  const coinUnread = mockChain.coinTradeNotifications.filter(n => !n.isRead).length;
  const redemptionUnread = (mockChain.redemptionNotifications || []).filter(n => !n.isRead).length;
  const unreadCount = notifications.filter(n => !n.isRead).length + coinUnread + redemptionUnread;

  return (
    <button
      onClick={() => navigate('/notifications')}
      className={`relative p-2 rounded-full hover:bg-secondary/60 active:scale-90 transition-all duration-200 text-foreground hover:text-aura ${className || ''}`}
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-background">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
