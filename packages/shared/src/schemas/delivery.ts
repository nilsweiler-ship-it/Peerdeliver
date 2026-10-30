import { z } from 'zod';
import { PACKAGE_SIZES } from '../constants/delivery-status';

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const addressSchema = z.object({
  label: z.string().min(1),
  point: geoPointSchema,
});

/**
 * Switzerland and Liechtenstein, with a little margin for border towns.
 * Shlep operates here only; a pickup at (0,0) — the default of a broken
 * geocoder — used to be accepted and listed to drivers.
 */
const CH_BOUNDS = { minLat: 45.75, maxLat: 47.85, minLng: 5.9, maxLng: 10.55 };
const inServiceArea = (p: { lat: number; lng: number }) =>
  p.lat >= CH_BOUNDS.minLat && p.lat <= CH_BOUNDS.maxLat && p.lng >= CH_BOUNDS.minLng && p.lng <= CH_BOUNDS.maxLng;

const serviceAddressSchema = addressSchema.refine((a) => inServiceArea(a.point), {
  message: 'Shlep ist im Moment nur in der Schweiz und in Liechtenstein verfügbar.',
  path: ['point'],
});

/** Great-circle distance in km, for the "pickup is the drop-off" check. */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** On the Swiss 5-Rappen grid: what TWINT and every till in the country use. */
const onRappenGrid = (chf: number) => Math.abs(chf * 20 - Math.round(chf * 20)) < 1e-6;

/** Budget limits. The floor keeps the driver's share above the fee floor;
 *  the ceiling is TWINT's per-payment limit. */
export const MIN_BUDGET_CHF = 5;
export const MAX_BUDGET_CHF = 5000;
/** No insurance covers a parcel yet; a declared value above this is refused. */
export const MAX_DECLARED_VALUE_CHF = 10000;
/** How far ahead a delivery can be booked. */
const MAX_DAYS_AHEAD = 90;

// Accept "2026-11-03T09:00:00+01:00" as well as "…Z": partners and the
// widget send local time with an offset, and rejecting it was a 400 with no
// explanation.
const isoDateTime = z.string().datetime({ offset: true });

export const createDeliverySchema = z.object({
  pickupAddress: serviceAddressSchema,
  deliveryAddress: serviceAddressSchema,
  // Required, not optional: the recipient's address is what creates their
  // account and pulls them into the product. Enforced here as well as in the
  // form, because a client-side rule is a suggestion, not a requirement.
  recipientEmail: z.string().email(),
  recipientPhone: z.string().min(6).max(25).optional(),
  // XL = beyond Swiss Post's Sperrgut ceiling; no postal alternative exists.
  packageSize: z.enum(['S', 'M', 'L', 'XL']),
  packageWeight: z.number().positive().optional(),
  packageDescription: z.string().max(500).optional(),
  packaging: z.enum(['none', 'reused', 'cardboard', 'other']).optional(),
  declaredValue: z
    .number()
    .nonnegative()
    .max(MAX_DECLARED_VALUE_CHF, `Sendungen über CHF ${MAX_DECLARED_VALUE_CHF} können wir im Moment nicht annehmen.`)
    .optional(),
  budgetCHF: z
    .number()
    .min(MIN_BUDGET_CHF, `Der Betrag muss mindestens CHF ${MIN_BUDGET_CHF} sein.`)
    .max(MAX_BUDGET_CHF, `Der Betrag darf höchstens CHF ${MAX_BUDGET_CHF} sein.`)
    .refine(onRappenGrid, 'Bitte runde den Betrag auf 5 Rappen.'),
  deliveryWindowStart: isoDateTime,
  deliveryWindowEnd: isoDateTime,
})
  .superRefine((d, ctx) => {
    // Weight within what the chosen size allows — a 9,999 kg "S" parcel was
    // accepted, priced as S and shown to drivers with small cars.
    const maxKg = PACKAGE_SIZES[d.packageSize].maxKg;
    if (d.packageWeight != null && d.packageWeight > maxKg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['packageWeight'],
        message: `Grösse ${d.packageSize} trägt höchstens ${maxKg} kg. Wähle eine grössere Grösse.`,
      });
    }
    const start = Date.parse(d.deliveryWindowStart);
    const end = Date.parse(d.deliveryWindowEnd);
    if (!(end > start)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deliveryWindowEnd'], message: 'Das Zeitfenster muss nach seinem Beginn enden.' });
    }
    if (!(end > Date.now())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deliveryWindowEnd'], message: 'Das Zeitfenster liegt in der Vergangenheit.' });
    }
    if (start > Date.now() + MAX_DAYS_AHEAD * 86_400_000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deliveryWindowStart'], message: `Lieferungen können bis ${MAX_DAYS_AHEAD} Tage im Voraus gebucht werden.` });
    }
    if (km(d.pickupAddress.point, d.deliveryAddress.point) < 0.1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deliveryAddress'], message: 'Abhol- und Zieladresse sind dieselbe.' });
    }
  });

/**
 * The generic status endpoint only accepts the two moves that need no proof.
 * picked_up / in_transit / delivered go through verify-pickup and
 * verify-delivery, which demand the handover codes; requested / matched go
 * through assign and confirm. Accepting them here let a driver mark a parcel
 * delivered with no code at all.
 */
export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['accepted', 'cancelled']),
  cancelReason: z.string().max(500).optional(),
});

export const verifyCodeSchema = z.object({
  code: z.string().length(6),
});

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
