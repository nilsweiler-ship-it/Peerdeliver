export type Packaging = 'none' | 'reused' | 'cardboard' | 'other';

import { PublicUser } from './user';

/**
 * Package size.
 *
 * The boundary that matters commercially sits between L and XL, not between the
 * smaller classes: Swiss Post's Sperrgut tops out at 30 kg / 200 cm, and above
 * that there is no postal option at all — the alternative jumps from CHF 31 to a
 * Möbeltaxi at CHF 100+. XL exists to name that segment, because it is the one
 * where a peer with an estate car is genuinely the cheapest way to move
 * something rather than a marginal saving.
 */
export type PackageSize = 'S' | 'M' | 'L' | 'XL';

export type DeliveryStatus =
  | 'pending'
  /** A driver claimed this delivery; the sender decides. */
  | 'requested'
  /** The sender picked this driver's route; the driver decides. */
  | 'offered'
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
  recipientEmail: string;
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
  /** Set only while status is 'offered' — which route the sender targeted. */
  offeredRouteId?: string | null;
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
