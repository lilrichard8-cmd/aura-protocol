import { Notification } from '@/types/notifications';
import { creators } from './mock';

export const mockNotifications: Notification[] = [
  // Today
  {
    id: 'n1',
    type: 'tip',
    title: 'New Tip Received',
    message: 'crypto_whale sent you a tip of 100 ORA',
    avatar: creators[0].avatar,
    timestamp: '2h ago',
    isRead: false,
    data: { amount: 100, currency: 'ORA' }
  },
  {
    id: 'n2',
    type: 'follower',
    title: 'New Admirer',
    message: 'nightowl_dreamer started following you',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    timestamp: '4h ago',
    isRead: false,
  },
  {
    id: 'n3',
    type: 'curation',
    title: 'Content Curated',
    message: 'Your post "New artwork just dropped!" was curated by the community',
    avatar: creators[0].avatar,
    timestamp: '6h ago',
    isRead: true,
  },
  {
    id: 'n4',
    type: 'subscriber',
    title: 'New Subscriber',
    message: 'art_lover subscribed to your Gold tier',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
    timestamp: '8h ago',
    isRead: true,
  },
  
  // This Week  
  {
    id: 'n5',
    type: 'coin_holder',
    title: 'New Creator Coin Holder',
    message: 'Someone bought 500 LUNA tokens',
    avatar: creators[0].avatar,
    timestamp: '2d ago',
    isRead: true,
    data: { amount: 500, currency: 'LUNA' }
  },
  {
    id: 'n6',
    type: 'proposal',
    title: 'Proposal Vote Result',
    message: 'Your governance proposal "Community Fund Distribution" passed',
    avatar: '/api/placeholder/40/40',
    timestamp: '3d ago',
    isRead: true,
    data: { proposalId: 'prop_123' }
  },
  {
    id: 'n7',
    type: 'staking',
    title: 'Staking Reward',
    message: 'You earned 25 ORA from staking rewards',
    avatar: '/api/placeholder/40/40',
    timestamp: '4d ago',
    isRead: true,
    data: { amount: 25, currency: 'ORA' }
  },
  {
    id: 'n8',
    type: 'tip',
    title: 'New Tip Received',
    message: 'patron_vip sent you a tip of 50 ORA',
    avatar: creators[1].avatar,
    timestamp: '5d ago',
    isRead: true,
    data: { amount: 50, currency: 'ORA' }
  },
  
  // Earlier
  {
    id: 'n9',
    type: 'follower',
    title: 'New Admirer',
    message: 'shadow_artist started following you',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    timestamp: '1w ago',
    isRead: true,
  },
  {
    id: 'n10',
    type: 'curation',
    title: 'Content Curated',
    message: 'Your gallery "Shadow series continues" received high curation signals',
    avatar: creators[1].avatar,
    timestamp: '1w ago',
    isRead: true,
  },
  {
    id: 'n11',
    type: 'subscriber',
    title: 'New Subscriber',
    message: 'mystery_fan subscribed to your Silver tier',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
    timestamp: '2w ago',
    isRead: true,
  },
  {
    id: 'n12',
    type: 'staking',
    title: 'Staking Reward',
    message: 'You earned 75 ORA from staking rewards',
    avatar: '/api/placeholder/40/40',
    timestamp: '2w ago',
    isRead: true,
    data: { amount: 75, currency: 'ORA' }
  }
];