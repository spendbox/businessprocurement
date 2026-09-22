import { z } from "zod";
import {
  BUDGET_BANDS,
  BUSINESS_AGE,
  FULFILMENT_SPEEDS,
  PAYMENT_TERMS,
  URGENCIES,
} from "./catalog";
import { COVERAGE_AREAS } from "./geo";
import { attachmentsSchema } from "./attachments";

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
  /*
   * The request as the buyer wrote it. This is the source of truth: the
   * structured fields below are read out of it, shown back for correction,
   * and may be blank if nothing could be found. The raw words always reach
   * the sourcing team intact.
   */
  need: trimmed(15, 4000, "Your request"),

  /** Worked out from the text, correctable on the review screen. */
  categories: z
    .array(z.string().trim().min(1).max(60))
    .max(12)
    .optional()
    .default([]),
  quantity: optionalText(160),
  budget: z.enum(BUDGET_BANDS).optional().or(z.literal("")),

  /** Asked as its own step — it changes how the request is worked. */
  urgency: z.enum(urgencyValues, { message: "Tell us how soon you need it" }),
  neededBy: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
    .optional()
    .or(z.literal("")),

  /** Prefilled from the text; confirmed in one step. */
  country: trimmed(2, 80, "Country"),
  region: trimmed(2, 80, "State or region"),
  city: optionalText(80),
  address: optionalText(300),

  /** Who is asking. */
  company: trimmed(2, 140, "Business name"),
  contactName: trimmed(2, 120, "Your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone,
  recurring: z.boolean().optional(),

  /** Files attached to the request, forwarded onto the internal email. */
  attachments: attachmentsSchema,

  honeypot,
});

export const orderSchema = orderObject;
export type OrderInput = z.infer<typeof orderSchema>;

/** The bare object, for validating one step at a time. */
export const orderFields = orderObject;

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
 * A merchant typed in by an admin rather than one who applied.
 *
 * Looser than the public form on purpose: the person entering it is on the
 * phone to the supplier and may not have their RC number or their monthly
 * capacity to hand. What cannot be guessed — who they are, what they supply
 * and where they deliver — is still required, because a merchant missing
 * those can never be matched to a request.
 */
export const manualVendorSchema = z.object({
  company: trimmed(2, 140, "Company name"),
  rcNumber: optionalText(40),
  website: optionalText(200),
  yearsTrading: z.enum(BUSINESS_AGE, { message: "How long have they traded?" }),

  categories: z
    .array(z.string().trim().min(1).max(60))
    .min(1, "Pick at least one category they supply")
    .max(12, "Pick their strongest categories"),
  supplyDescription: trimmed(5, 1500, "What they supply"),
  moq: optionalText(160),
  monthlyCapacity: optionalText(160),
  fulfilmentSpeed: z.enum(FULFILMENT_SPEEDS, { message: "How fast can they fulfil?" }),

  regions: z
    .array(z.enum(COVERAGE_AREAS as [string, ...string[]]))
    .min(1, "Where can they deliver?")
    .max(COVERAGE_AREAS.length),
  ownLogistics: z.boolean().optional(),
  paymentTerms: z.enum(PAYMENT_TERMS, { message: "Pick their payment terms" }),

  contactName: trimmed(2, 120, "Contact name"),
  role: optionalText(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone,
  notes: optionalText(1200),
  internalNotes: optionalText(2000),

  /** Added by hand usually means already trusted, so this defaults to approved. */
  status: z.enum(["pending", "approved", "rejected", "paused"]).default("approved"),
  /** Who on your team looks after them. */
  assignedTo: z.string().uuid().optional().or(z.literal("")),
  /** Tell them they are set up. Off unless asked for. */
  sendWelcome: z.boolean().optional().default(false),
});

export type ManualVendorInput = z.infer<typeof manualVendorSchema>;

/**
 * Human-readable reference, e.g. SPB-4K2P-7QX or INV-9F3D-2HK.
 * Short enough to read over the phone, unique enough for our volumes.
 */
export function makeReference(prefix: "SPB" | "VND" | "INV"): string {
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
