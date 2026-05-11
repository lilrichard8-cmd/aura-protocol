export interface LiveStreamCategory {
  id: string;
  name: string;
  icon: string;
}

export interface LiveStreamInfo {
  id: string;
  creatorId: string;
  creator: {
    username: string;
    displayName: string;
    avatar: string;
    isVerified: boolean;
  };
  title: string;
  thumbnail: string;
  category: string;
  viewerCount: number;
  tipGoal?: number;
  tipCurrent?: number;
  isTicketed?: boolean;
  ticketPrice?: number;
  isPrivate?: boolean;
}

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  isTip?: boolean;
  tipAmount?: number;
  isSystem?: boolean;
}