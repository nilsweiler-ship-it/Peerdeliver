export const DELIVERY_STATUS = {
  PENDING: 'pending',
  REQUESTED: 'requested',
  MATCHED: 'matched',
  ACCEPTED: 'accepted',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export const DELIVERY_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['requested', 'cancelled', 'expired'],
  requested: ['matched', 'cancelled'],
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
