import { PublicUser } from './user';

export interface Rating {
  id: string;
  deliveryRequestId: string;
  fromUserId: string;
  fromUser?: PublicUser;
  toUserId: string;
  toUser?: PublicUser;
  score: number;
  comment?: string;
  createdAt: string;
}
