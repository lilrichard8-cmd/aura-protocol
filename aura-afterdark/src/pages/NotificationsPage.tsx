import { useState, useMemo } from 'react';
import { Bell, Check, Filter } from 'lucide-react';
import { mockNotifications } from '@/data/mockNotifications';
import { Notification, NotificationGroup, NotificationFilter } from '@/types/notifications';

const filterTabs: { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'earnings', label: 'Earnings' },
  { key: 'social', label: 'Social' },
  { key: 'governance', label: 'Governance' },
];

const getNotificationIcon = (type: Notification['type']) => {
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

const filterNotificationsByType = (notifications: Notification[], filter: NotificationFilter): Notification[] => {
  if (filter === 'all') return notifications;
  
  switch (filter) {
    case 'earnings':
      return notifications.filter(n => ['tip', 'subscriber', 'staking'].includes(n.type));
    case 'social':
      return notifications.filter(n => ['follower', 'curation'].includes(n.type));
    case 'governance':
      return notifications.filter(n => ['proposal', 'coin_holder'].includes(n.type));
    default:
      return notifications;
  }
};

const groupNotificationsByTime = (notifications: Notification[]): NotificationGroup[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const groups: NotificationGroup[] = [
    { label: 'Today', notifications: [] },
    { label: 'This Week', notifications: [] },
    { label: 'Earlier', notifications: [] },
  ];
  
  notifications.forEach(notification => {
    const timestamp = notification.timestamp;
    if (timestamp.includes('h ago') || timestamp.includes('m ago')) {
      groups[0].notifications.push(notification);
    } else if (timestamp.includes('d ago')) {
      groups[1].notifications.push(notification);
    } else {
      groups[2].notifications.push(notification);
    }
  });
  
  return groups.filter(group => group.notifications.length > 0);
};

export default function NotificationsPage() {
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [notifications, setNotifications] = useState(mockNotifications);
  
  const filteredNotifications = useMemo(() => 
    filterNotificationsByType(notifications, activeFilter),
    [notifications, activeFilter]
  );
  
  const groupedNotifications = useMemo(() => 
    groupNotificationsByTime(filteredNotifications),
    [filteredNotifications]
  );
  
  const unreadCount = notifications.filter(n => !n.isRead).length;
  
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };
  
  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };
  
  return (
    <div className="min-h-screen bg-aura-bg text-aura-text md:pl-64">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Bell className="w-8 h-8 text-aura-accent" />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-aura-accent text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold">Notifications</h1>
              <p className="text-aura-text-secondary">
                {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
              </p>
            </div>
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 bg-aura-accent/20 hover:bg-aura-accent/30 text-aura-accent rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>
        
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-aura-surface rounded-lg p-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeFilter === tab.key
                  ? 'bg-aura-accent text-white shadow-lg'
                  : 'text-aura-text-secondary hover:text-aura-text hover:bg-aura-surface/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Notifications */}
        {groupedNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-aura-text-secondary mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No notifications</h3>
            <p className="text-aura-text-secondary">
              {activeFilter === 'all' 
                ? "You're all caught up! No new notifications."
                : `No ${activeFilter} notifications at the moment.`}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedNotifications.map(group => (
              <div key={group.label}>
                <h2 className="text-lg font-semibold mb-4 text-aura-text-secondary">
                  {group.label}
                </h2>
                <div className="space-y-3">
                  {group.notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-lg border transition-all cursor-pointer hover:bg-aura-surface/30 ${
                        notification.isRead
                          ? 'bg-aura-card border-aura-border opacity-70'
                          : 'bg-aura-surface border-aura-accent/30 shadow-sm'
                      }`}
                      onClick={() => !notification.isRead && markAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <img
                            src={notification.avatar || '/api/placeholder/40/40'}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-aura-accent rounded-full flex items-center justify-center text-xs">
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold mb-1">{notification.title}</h3>
                              <p className="text-sm text-aura-text-secondary mb-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-aura-text-secondary">
                                <span>{notification.timestamp}</span>
                                {notification.data?.amount && (
                                  <span className="px-2 py-1 bg-aura-gold/20 text-aura-gold rounded">
                                    {notification.data.amount} {notification.data.currency}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {!notification.isRead && (
                              <div className="w-3 h-3 bg-aura-accent rounded-full flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}