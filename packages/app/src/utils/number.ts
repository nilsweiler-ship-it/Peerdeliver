/**
 * Read a number the way people in Switzerland type it.
 *
 * The Swiss keypad decimal is a comma, and thousands are often written with
 * an apostrophe: "2,5", "1'200", "1 200.50". parseFloat stops at the first
 * character it doesn't know, so "2,5 kg" was saved as 2 kg and "abc" became
 * NaN, which reached the server as null and came back as a raw zod message.
 *
 * Returns undefined for an empty field and NaN for anything that isn't a
 * number, so callers can tell "not given" from "given but wrong".
 */
export function parseLocaleNumber(input: string | null | undefined): number | undefined {
  const s = (input ?? '').trim();
  if (!s) return undefined;
  const cleaned = s.replace(/['’\s]/g, '').replace(',', '.');
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return NaN;
  return Number(cleaned);
}
