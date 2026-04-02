export type UserRole = 'sender' | 'driver' | 'both' | 'admin';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  verificationStatus: VerificationStatus;
  averageRating?: number;
  totalRatings: number;
  totalDeliveries: number;
  co2Saved: number;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
  averageRating?: number;
  totalRatings: number;
  totalDeliveries: number;
  co2Saved: number;
}
