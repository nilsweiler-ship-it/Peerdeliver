/**
 * When does the sender need it?
 *
 *
 * WHAT THIS REPLACES
 *
 * Nothing. There was no field at all: every delivery was silently stamped
 * `now + 24h` to `now + 48h`, in the client, with no way for anyone to say
 * otherwise. Which meant:
 *
 *   · a sender could not ask for today, so the "same-day" comparison the
 *     website makes against Swiss Post had nothing behind it in the product;
 *   · a driver could not tell whether a parcel wanted collecting this
 *     afternoon or some time next week — every one claimed tomorrow;
 *   · the matching had a time dimension that was pure fiction.
 *
 * Timing is half of the match. The whole premise is a parcel riding along on a
 * trip someone is already making, and whether those two things coincide is a
 * question about *when* at least as much as *where*.
 *
 *
 * WHY PRESETS
 *
 * Most people sending a parcel want "soon" and do not want to operate a date
 * picker to say so. Four choices cover the overwhelming majority, and a date
 * sits behind the fourth for the person who genuinely has a deadline.
 *
 * Each preset is a WINDOW, not an instant. A window is what a driver can
 * actually match against: "Thursday works for me" is only answerable if the
 * request has edges.
 */

export const DELIVERY_SPEEDS = ['today', 'tomorrow', 'this_week', 'on_date'] as const;
export type DeliverySpeedChoice = (typeof DELIVERY_SPEEDS)[number];

export interface DeliveryWindow {
  start: Date;
  end: Date;
}

/**
 * The hour after which "today" stops being plausible.
 *
 * A parcel posted at 21:00 asking for same-day delivery sets up a driver to
 * fail and a sender to be disappointed. Past this hour the app should offer
 * tomorrow as the earliest option — stated here rather than buried in a
 * component, because the website's same-day claim depends on the same number.
 */
export const SAME_DAY_CUTOFF_HOUR = 18;

/** Whether same-day can still be offered, given the time of day. */
export function sameDayStillPossible(now: Date = new Date()): boolean {
  return now.getHours() < SAME_DAY_CUTOFF_HOUR;
}

/**
 * Turn a choice into the window stored on the delivery.
 *
 * `today` runs from now to the end of today — not to "now + 8 hours", because
 * a window that expires at 02:00 is meaningless. The others start at the
 * beginning of their day so a driver leaving early still matches.
 */
export function windowFor(
  choice: DeliverySpeedChoice,
  now: Date = new Date(),
  onDate?: Date,
): DeliveryWindow {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

  switch (choice) {
    case 'today':
      return { start: now, end: endOfDay(now) };
    case 'tomorrow': {
      const t = addDays(now, 1);
      return { start: startOfDay(t), end: endOfDay(t) };
    }
    case 'this_week':
      // Deliberately generous: a week of slack is what makes a shared trip
      // likely in the first place, and it is the cheapest option for the
      // sender because any driver on the corridor can take it.
      return { start: now, end: endOfDay(addDays(now, 7)) };
    case 'on_date': {
      const d = onDate ?? addDays(now, 1);
      return { start: startOfDay(d), end: endOfDay(d) };
    }
  }
}

/**
 * Does a driver's departure fall inside the window the sender asked for?
 *
 * Used by matching. Kept here beside `windowFor` so the two cannot drift —
 * a window that nothing matches against is the state this file was written
 * to end.
 */
export function departureFitsWindow(
  departureTime: Date,
  windowStart: Date,
  windowEnd: Date,
): boolean {
  const t = departureTime.getTime();
  return t >= windowStart.getTime() && t <= windowEnd.getTime();
}

/** How urgent a window is, for sorting and for the price comparison. */
export function isSameDay(windowEnd: Date, now: Date = new Date()): boolean {
  return (
    windowEnd.getFullYear() === now.getFullYear() &&
    windowEnd.getMonth() === now.getMonth() &&
    windowEnd.getDate() === now.getDate()
  );
}
