import { useState, useRef, useEffect } from 'react';
import { Bell, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mockNotifications } from '@/data/mockNotifications';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const unreadNotifications = mockNotifications.filter(n => !n.isRead);
  const recentNotifications = mockNotifications.slice(0, 5);
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'tip': return '💰';
      case 'follower': return '👤';
      case 'subscriber': return '⭐';
      case 'curation': return '✨';
      case 'coin_holder': return '🪙';
      case 'proposal': return '🗳️';
      case 'staking': return '💎';
      default: return '📝';
    }
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleNotificationClick = (id: string) => {
    setIsOpen(false);
    // In a real app, mark as read and navigate to relevant page
    navigate('/notifications');
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-aura-text-secondary hover:text-aura-text transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadNotifications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-aura-accent text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-aura-card border border-aura-border rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="p-4 border-b border-aura-border">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Notifications</h3>
              <span className="text-sm text-aura-text-secondary">
                {unreadNotifications.length} unread
              </span>
            </div>
          </div>
          
          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-12 h-12 text-aura-text-secondary mx-auto mb-3 opacity-50" />
                <p className="text-sm text-aura-text-secondary">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-aura-border">
                {recentNotifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification.id)}
                    className={`p-4 hover:bg-aura-surface cursor-pointer transition-colors ${
                      !notification.isRead ? 'bg-aura-accent/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <img
                          src={notification.avatar || '/api/placeholder/32/32'}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-aura-accent rounded-full flex items-center justify-center text-xs">
                          {getNotificationIcon(notification.type)}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm mb-1">{notification.title}</p>
                            <p className="text-xs text-aura-text-secondary line-clamp-2 mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-aura-text-secondary">
                              <span>{notification.timestamp}</span>
                              {notification.data?.amount && (
                                <span className="px-1.5 py-0.5 bg-aura-gold/20 text-aura-gold rounded text-xs">
                                  {notification.data.amount} {notification.data.currency}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-aura-accent rounded-full flex-shrink-0 mt-1" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-3 border-t border-aura-border">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-aura-accent hover:bg-aura-accent/10 rounded-lg transition-colors"
            >
              View All Notifications
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}