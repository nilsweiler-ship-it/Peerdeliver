import { PublicUser } from './user';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: PublicUser;
  content: string;
  readAt?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  deliveryRequestId: string;
  participants: PublicUser[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}
