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

/**
 * Size classes, with the Swiss Post boundary made explicit.
 *
 * L is capped at exactly Post's Sperrgut limit (30 kg, 200 cm) because that is
 * where the competitive situation changes: at or below it Post will carry the
 * item for about CHF 31, so we are competing on convenience. Above it Post
 * declines entirely and the realistic alternative is a Möbeltaxi at CHF 100+.
 */
export const PACKAGE_SIZES = {
  S: { label: 'Small', maxKg: 5, description: 'Fits in a bag' },
  M: { label: 'Medium', maxKg: 15, description: 'Fits in a backpack' },
  L: { label: 'Large', maxKg: 30, description: 'Needs car trunk space' },
  XL: {
    label: 'Extra large',
    maxKg: 120,
    description: 'Too big for the post — sofa, fridge, wardrobe',
  },
} as const;

/** Swiss Post Sperrgut ceiling. Above either figure, Post is not an option. */
export const POST_BULKY_LIMIT = { maxKg: 30, maxLongestEdgeCm: 200 } as const;
