/**
 * The discount a merchant has agreed to give Spendbox businesses, as a
 * percentage off their normal price. A range: the least they always give,
 * and the most they will go to for a large or repeat order.
 *
 * No imports, so the same wording is used in the browser, in emails and in
 * the agreement itself.
 */

const pct = (n: number) => `${Number.isInteger(n) ? n : Number(n.toFixed(2))}%`;

export const hasDiscount = (min: number | null | undefined, max: number | null | undefined) =>
  (min !== null && min !== undefined) || (max !== null && max !== undefined);

/** "5%–12%", "10%", "from 5%", "up to 12%", or "not agreed yet". */
export function discountLabel(
  min: number | string | null | undefined,
  max: number | string | null | undefined,
): string {
  const lo = min === null || min === undefined || min === "" ? null : Number(min);
  const hi = max === null || max === undefined || max === "" ? null : Number(max);
  if (lo === null && hi === null) return "not agreed yet";
  if (lo !== null && hi !== null) return lo === hi ? pct(lo) : `${pct(lo)}–${pct(hi)}`;
  if (lo !== null) return `from ${pct(lo)}`;
  return `up to ${pct(hi as number)}`;
}

/**
 * Reads the two numbers from a form. Blank means "not agreed"; anything else
 * must be 0–100 with the low end not above the high end.
 */
export function parseDiscount(
  minInput: unknown,
  maxInput: unknown,
): { ok: true; min: number | null; max: number | null } | { ok: false; message: string } {
  const read = (value: unknown): number | null | "bad" => {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const n = Number(String(value).replace("%", "").trim());
    return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : "bad";
  };
  const min = read(minInput);
  const max = read(maxInput);
  if (min === "bad" || max === "bad") {
    return { ok: false, message: "A discount is a percentage between 0 and 100." };
  }
  if (min !== null && max !== null && min > max) {
    return { ok: false, message: "The lowest discount cannot be more than the highest." };
  }
  return { ok: true, min, max };
}
