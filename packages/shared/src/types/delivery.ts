export type Packaging = 'none' | 'reused' | 'cardboard' | 'other';

import { PublicUser } from './user';

export type PackageSize = 'S' | 'M' | 'L';

export type DeliveryStatus =
  | 'pending'
  | 'requested'
  | 'matched'
  | 'accepted'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'expired';

export type PaymentStatus =
  | 'unpaid'
  | 'authorised'
  | 'captured'
  | 'refunded'
  | 'voided'
  | 'failed';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address {
  label: string;
  point: GeoPoint;
}

export interface DeliveryRequest {
  id: string;
  senderId: string;
  sender?: PublicUser;
  driverId?: string;
  driver?: PublicUser;
  recipientId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  pickupAddress: Address;
  deliveryAddress: Address;
  packageSize: PackageSize;
  packageWeight?: number;
  packageDescription?: string;
  /** What the parcel is wrapped in. 'none' = handed over unpackaged. */
  packaging?: Packaging;
  declaredValue?: number;
  budgetCHF: number;
  platformFeeCHF?: number;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  status: DeliveryStatus;
  pickupCode?: string;
  deliveryCode?: string;
  co2SavedKg?: number;
  cancelledBy?: string;
  cancelReason?: string;
  paymentStatus?: PaymentStatus;
  driverPayoutCHF?: number;
  refundedCHF?: number;
  refundedAt?: string;
  twintRef?: string;
  twintPhone?: string;
  stripePaymentIntentId?: string;
  /** Present when created in real (Stripe) mode — the app confirms with this. */
  clientSecret?: string | null;
  createdAt: string;
  updatedAt: string;
}
