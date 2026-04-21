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
  pickupAddress: Address;
  deliveryAddress: Address;
  packageSize: PackageSize;
  packageWeight?: number;
  packageDescription?: string;
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
  stripePaymentIntentId?: string;
  clientSecret?: string | null;
  createdAt: string;
  updatedAt: string;
}
