export interface Notification {
  id: string;
  type: 'curation' | 'coin_holder' | 'tip' | 'proposal' | 'staking' | 'follower' | 'subscriber';
  title: string;
  message: string;
  avatar: string;
  timestamp: string;
  isRead: boolean;
  data?: {
    amount?: number;
    currency?: string;
    proposalId?: string;
    creatorId?: string;
  };
}

export interface NotificationGroup {
  label: string;
  notifications: Notification[];
}

export type NotificationFilter = 'all' | 'earnings' | 'social' | 'governance';