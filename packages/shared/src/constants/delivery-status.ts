export const DELIVERY_STATUS = {
  PENDING: 'pending',
  REQUESTED: 'requested',
  OFFERED: 'offered',
  MATCHED: 'matched',
  ACCEPTED: 'accepted',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

/**
 * Legal status moves. Enforced server-side in updateDeliveryStatus.
 *
 * This table existed but had no importers anywhere — validation that looks like
 * protection and provides none is worse than an obvious gap, because it stops
 * anyone asking whether the transition is checked. It is now the single source
 * of truth for the generic status endpoint.
 *
 * Note what is deliberately absent: nothing transitions *into* 'requested' or
 * 'offered' here. Those two are entered only through assignDelivery and
 * offerToRoute, which carry guards the generic endpoint cannot express — payout
 * eligibility, route ownership, vehicle capacity.
 */
export const DELIVERY_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['cancelled', 'expired'],
  requested: ['matched', 'cancelled'],
  offered: ['cancelled'],
  matched: ['accepted', 'cancelled'],
  accepted: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  expired: [],
};

export const PACKAGE_SIZES = {
  S: { label: 'Small', maxKg: 5, description: 'Fits in a bag' },
  M: { label: 'Medium', maxKg: 15, description: 'Fits in a backpack' },
  L: { label: 'Large', maxKg: 30, description: 'Needs car trunk space' },
} as const;
