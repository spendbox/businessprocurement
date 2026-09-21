import { z } from "zod";
import {
  BUDGET_BANDS,
  BUSINESS_AGE,
  FULFILMENT_SPEEDS,
  PAYMENT_TERMS,
  URGENCIES,
} from "./catalog";
import { COVERAGE_AREAS } from "./geo";

const urgencyValues = URGENCIES.map((u) => u.value) as [string, ...string[]];

const trimmed = (min: number, max: number, field: string) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .min(min, `${field} needs a little more detail`)
    .max(max, `${field} is too long`);

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const phone = z
  .string()
  .trim()
  .min(7, "Enter a phone number we can reach you on")
  .max(32, "That phone number looks too long")
  .regex(/^[0-9+()\-.\s]+$/, "Phone numbers can only contain digits and + ( ) -");

/**
 * A spam trap. Real people never fill a hidden field, so this accepts any
 * value rather than rejecting it — the route checks it and quietly drops the
 * submission, which tells a bot nothing about why it failed.
 */
const honeypot = z.string().max(200).optional();

const orderObject = z.object({
  // Step 1 — the need
  need: trimmed(10, 2000, "Your request"),
  categories: z
    .array(z.string().trim().min(1).max(60))
    .min(1, "Pick at least one category")
    .max(12, "That is a lot of categories — split into two requests"),
  quantity: optionalText(160),

  // Do they have a purchase order or spreadsheet, and when is it coming?
  hasAttachment: z.boolean({ message: "Let us know either way" }),
  attachmentTiming: z.enum(["now", "later"]).optional().or(z.literal("")),
  attachmentNote: optionalText(400),

  // Step 2 — delivery and urgency
  urgency: z.enum(urgencyValues, { message: "Tell us how soon you need it" }),
  hasDeadline: z.boolean({ message: "Let us know either way" }),
  neededBy: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
    .optional()
    .or(z.literal("")),
  country: trimmed(2, 80, "Country"),
  region: trimmed(2, 80, "State or region"),
  city: trimmed(2, 80, "Delivery city"),
  address: optionalText(300),

  // Step 3 — who you are
  company: trimmed(2, 140, "Business name"),
  contactName: trimmed(2, 120, "Your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone,
  budget: z.enum(BUDGET_BANDS).optional().or(z.literal("")),
  recurring: z.boolean().optional(),
  notes: optionalText(1200),

  honeypot,
});

/**
 * "Yes" answers have to be followed through: saying you have a purchase
 * order means telling us when it is coming, and saying there is a hard
 * deadline means giving us the date.
 */
export const orderSchema = orderObject
  .refine((v) => !v.hasAttachment || Boolean(v.attachmentTiming), {
    message: "Are you sending it now or later?",
    path: ["attachmentTiming"],
  })
  .refine((v) => !v.hasDeadline || Boolean(v.neededBy), {
    message: "Pick the date it has to be there by",
    path: ["neededBy"],
  });

export type OrderInput = z.infer<typeof orderSchema>;

/**
 * The bare object, without the cross-field rules.
 *
 * Zod skips `.refine` checks when the base object fails, which is no use
 * for validating one step at a time — the step you are on is usually the
 * only part that is complete. The form parses against this and applies the
 * conditional rules below itself.
 */
export const orderFields = orderObject;

/** The "yes implies a follow-up answer" rules, checkable on their own. */
export function conditionalOrderErrors(draft: {
  hasAttachment?: boolean | null;
  attachmentTiming?: string;
  hasDeadline?: boolean | null;
  neededBy?: string;
}): Record<string, string> {
  const out: Record<string, string> = {};
  if (draft.hasAttachment === true && !draft.attachmentTiming) {
    out.attachmentTiming = "Are you sending it now or later?";
  }
  if (draft.hasDeadline === true && !draft.neededBy) {
    out.neededBy = "Pick the date it has to be there by";
  }
  return out;
}

export const vendorSchema = z.object({
  // Step 1 — the company
  company: trimmed(2, 140, "Company name"),
  rcNumber: optionalText(40),
  website: optionalText(200),
  yearsTrading: z.enum(BUSINESS_AGE, { message: "How long have you traded?" }),

  // Step 2 — what you supply
  categories: z
    .array(z.string().trim().min(1).max(60))
    .min(1, "Pick at least one category you supply")
    .max(12, "Pick your strongest categories"),
  supplyDescription: trimmed(20, 1500, "Your description"),
  moq: optionalText(160),
  fulfilmentSpeed: z.enum(FULFILMENT_SPEEDS, {
    message: "How fast can you fulfil?",
  }),

  // Step 3 — coverage and terms
  regions: z
    .array(z.enum(COVERAGE_AREAS as [string, ...string[]]))
    .min(1, "Where can you deliver?")
    .max(COVERAGE_AREAS.length),
  ownLogistics: z.boolean().optional(),
  paymentTerms: z.enum(PAYMENT_TERMS, { message: "Pick your payment terms" }),
  monthlyCapacity: optionalText(160),

  // Step 4 — contact
  contactName: trimmed(2, 120, "Contact name"),
  role: optionalText(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone,
  notes: optionalText(1200),

  honeypot,
});

export type VendorInput = z.infer<typeof vendorSchema>;

/**
 * Human-readable reference, e.g. SPB-4K2P-7QX.
 * Short enough to read over the phone, unique enough for our volumes.
 */
export function makeReference(prefix: "SPB" | "VND"): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  const pick = (n: number) =>
    Array.from(
      { length: n },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
  return `${prefix}-${pick(4)}-${pick(3)}`;
}

/** Flatten a Zod error into { field: message } for the form UI. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
