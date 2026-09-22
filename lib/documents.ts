import { z } from "zod";
import { getSupabase } from "./supabase";

/**
 * The documents you edit in the dashboard: the marketer playbook and the
 * merchant agreement template.
 *
 * Each ships with a complete, usable default so nothing is blank on day one.
 * The first time you press Save, your version is stored and used from then
 * on; "Reset to the original" puts the shipped text back.
 */

export const DOCUMENT_KEYS = ["marketer_playbook", "vendor_mou"] as const;
export type DocumentKey = (typeof DOCUMENT_KEYS)[number];

export type PlaybookTargets = {
  /** Businesses each marketer brings on board… */
  targetBusinesses: number;
  /** …within this many days of starting. */
  businessWindowDays: number;
  /** Sales, in naira, each marketer's businesses should reach… */
  targetSales: number;
  /** …within this many days of starting. */
  salesWindowDays: number;
};

export const DEFAULT_TARGETS: PlaybookTargets = {
  targetBusinesses: 30,
  businessWindowDays: 30,
  targetSales: 10_000_000,
  salesWindowDays: 90,
};

export type StoredDocument = {
  key: DocumentKey;
  title: string;
  body: string;
  meta: Record<string, unknown>;
  updated_at: string | null;
  updated_by: string | null;
  /** True while the shipped default is in use. */
  isDefault: boolean;
};

/* ------------------------------------------------------------------ */
/* The shipped defaults                                                */
/* ------------------------------------------------------------------ */

const PLAYBOOK_BODY = `# The Spendbox Marketer Playbook

Welcome, {{first_name}}. This is everything you need to do the job well — what we sell, who to sell it to, what to say, and exactly what success looks like. Keep it close for your first three months.

## Your two targets

- **{{target_businesses}} businesses on board by {{business_deadline}}** — that is your first {{business_window_days}} days, counted from {{start_date}}.
- **{{target_sales}} in sales from your businesses by {{sales_deadline}}** — your first {{sales_window_days}} days.

Broken down, that is about **{{weekly_businesses}} new businesses a week** in month one, and about **{{monthly_sales}} in sales a month** after that. Both are very reachable if you keep to the weekly rhythm below.

## What Spendbox is, in one breath

A business tells us what it needs to buy — in one message, in its own words — and we come back with the best offers from vetted merchants, usually within 24 hours. The business does not have to chase suppliers, compare quotes or haggle. We do that for them, and our merchants give Spendbox businesses a discount off their normal prices.

## Your merchants and what they will discount

These are the merchants you are working with. The discount range is what each one has agreed to give businesses you bring in — the lower figure on every order, up to the higher figure for large or repeat orders.

{{vendor_list}}

**Never promise more than the top of the range.** If a business wants more, tell them you will ask, and let us negotiate it.

## Who to go after

Start with businesses that buy the same things again and again. They see the value fastest and they order more than once.

- Offices and corporate headquarters — furniture, stationery, IT, cleaning supplies
- Schools and training centres — furniture, stationery, uniforms, equipment
- Hospitals, clinics and pharmacies — consumables, equipment, cleaning
- Hotels, restaurants and event centres — food supplies, linen, kitchen equipment
- Construction and facility-management firms — building materials, tools, safety gear
- Estates and property managers — maintenance supplies, generators, security equipment

The person to reach is whoever places the orders: the admin manager, procurement officer, office manager, operations lead or the owner of a smaller business.

## What to say

Keep it short. Something like:

"Good morning. I am {{first_name}} from Spendbox. When your business needs to buy something — chairs, printer toner, cement, anything — you send us one message and we come back within a day with the best prices from vetted suppliers, with a discount you will not get walking in. No calls round the market, no chasing quotes. Can I show you how it works on something you are buying this month?"

Then **help them send a real request there and then**, on their phone or yours, at {{site_url}}. A business that has sent one request is on board. A business that said "sounds good" is not.

## Answering the usual doubts

- **"We already have suppliers."** — Good. Send us your next order anyway and compare. If ours is not better, you have lost nothing.
- **"Is it more expensive?"** — No. Our merchants give Spendbox businesses a discount off their normal price.
- **"How do I know the supplier is real?"** — Every merchant is checked and approved before they can quote.
- **"We only buy small quantities."** — Small orders are welcome. Most businesses start small.
- **"I will think about it."** — Ask what they are buying this month, and offer to price just that one thing.

## Your weekly rhythm in month one

1. **Monday** — plan the week: pick the area and the kind of business you will visit.
2. **Monday to Thursday** — visits and calls. Aim for at least 15 conversations a day.
3. **Every day** — help at least two businesses send a first request.
4. **Friday** — follow up everyone who showed interest but has not sent a request.
5. **Friday** — send us your list for the week (below).

## From month two: turning businesses into sales

- Call every business you brought in after their first order. Was it good? What do they need next?
- Ask for the order they place every month, not just the one-off.
- Introduce them to the other merchants on your list who supply what else they buy.
- Big buyers are worth more of your time. Five businesses spending a million naira a month is your whole target.

## How your businesses are counted

A business counts as yours when it sends a request and we record you as the marketer who brought it in. Make sure of it:

- Tell the business to mention your name when they send their first request, **or**
- Email us their business name and the contact person the same day.

Sales count when the business pays for the order.

## Every Friday, send us

- The businesses you brought on board this week — name, contact, phone
- Businesses that are interested but have not sent a request yet
- Anything a merchant or a business complained about

## The rules

- Never promise a price, a delivery date or a discount above the agreed range.
- Never take money from a business. All payment goes through Spendbox.
- Never give a business a merchant's direct contact, or a merchant a business's contact.
- Be honest. If you do not know the answer, say you will find out — and then find out.
- Represent Spendbox well. You are the first face of it most businesses will see.

## Where to get help

Reply to any email from us, or call the person who sent you this playbook. We would rather hear a question early than a problem late.

---

Thank you, {{first_name}}. Let us get to {{target_businesses}}.`;

const MOU_BODY = `# Memorandum of Understanding

## Between {{our_company}} and {{vendor_company}}

Reference **{{reference}}** · Effective from **{{start_date}}**

This Memorandum of Understanding records how {{our_company}} ("Spendbox") and {{vendor_company}} ("the Merchant") will work together to supply businesses that buy through Spendbox.

## 1. The parties

- **{{our_company}}** — a business procurement service that receives purchase requests from businesses and sources them from vetted merchants.
- **{{vendor_company}}** — RC number {{vendor_rc}}, represented by {{vendor_contact}} ({{vendor_email}}, {{vendor_phone}}).

## 2. What the Merchant supplies

The Merchant supplies: **{{categories}}**.

The Merchant delivers to: **{{regions}}**, with a usual fulfilment time of {{fulfilment_speed}}.

## 3. The agreed discount

The Merchant agrees to give businesses sourced through Spendbox a discount of **{{discount_min}}% to {{discount_max}}%** off its standard selling price on every product it supplies through Spendbox.

- At least **{{discount_min}}%** applies to every quote the Merchant gives through Spendbox.
- Up to **{{discount_max}}%** applies to larger, bulk or repeat orders, agreed quote by quote.
- Each quote shows the standard price and the discount applied, so the saving is visible.
- Spendbox and its marketers may tell businesses about this discount range, and will not promise any business more than the top of it without the Merchant's written agreement.

## 4. Quotes and orders

- Spendbox sends the Merchant purchase requests that match what it supplies. The Merchant replies with its price, lead time and what the price includes, quoting the Spendbox reference.
- A quote the Merchant gives stays valid for at least 7 days unless it says otherwise.
- An order is confirmed only when Spendbox confirms it to the Merchant in writing, including by email.

## 5. Delivery and quality

- The Merchant delivers what was quoted, to the quality described, by the lead time it gave.
- If an item cannot be delivered as quoted, the Merchant tells Spendbox straight away, before the delivery date.
- Faulty, damaged or wrong items are replaced or refunded by the Merchant at no cost to the business.

## 6. Payment

The Merchant's payment terms are: **{{payment_terms}}**. Payment for orders sourced through Spendbox is arranged through Spendbox, and the Merchant does not collect payment directly from a business unless Spendbox agrees in writing.

## 7. Businesses introduced by Spendbox

Businesses introduced through Spendbox are Spendbox's customers. For the length of this MOU and for 12 months after it ends, the Merchant will not approach a business it met through Spendbox to supply it directly, outside Spendbox, for the same kind of goods.

## 8. Confidentiality

Each side keeps the other's prices, customer details and business information confidential, and uses them only for the purpose of this MOU. This does not cover information that is already public, or that the law requires to be shared.

## 9. Length and ending

- This MOU runs for **{{term_months}} months** from the effective date, and continues after that until either side ends it.
- Either side may end it by giving the other 30 days' notice in writing, including by email.
- Orders already confirmed when notice is given are completed on the agreed terms.

## 10. The nature of this MOU

This MOU records the commercial understanding between the parties. Sections 3 (the agreed discount), 6 (payment), 7 (businesses introduced by Spendbox) and 8 (confidentiality) are intended to be binding. Anything not covered here is agreed separately in writing. This MOU is governed by the laws of the Federal Republic of Nigeria.

## 11. Signing

By typing their full name and confirming below, the person signing for the Merchant confirms that they are authorised to sign for {{vendor_company}}, that they have read this MOU, and that they agree to it. An electronic signature given this way has the same effect as a handwritten one. A signed copy is emailed to both sides.`;

const DEFAULTS: Record<DocumentKey, { title: string; body: string; meta: Record<string, unknown> }> = {
  marketer_playbook: {
    title: "The Spendbox Marketer Playbook",
    body: PLAYBOOK_BODY,
    meta: { ...DEFAULT_TARGETS },
  },
  vendor_mou: {
    title: "Memorandum of Understanding",
    body: MOU_BODY,
    meta: { termMonths: 12 },
  },
};

export const defaultDocument = (key: DocumentKey) => DEFAULTS[key];

/** Every field each document understands, with what it means, for the editor. */
export const DOCUMENT_FIELDS: Record<DocumentKey, { field: string; means: string }[]> = {
  marketer_playbook: [
    { field: "first_name", means: "The marketer's first name" },
    { field: "name", means: "Their full name" },
    { field: "start_date", means: "The day their targets start counting" },
    { field: "target_businesses", means: "Businesses to bring on board" },
    { field: "business_window_days", means: "Days they have for that" },
    { field: "business_deadline", means: "The date that window ends" },
    { field: "weekly_businesses", means: "The weekly pace to hit it" },
    { field: "target_sales", means: "Sales to reach, in naira" },
    { field: "sales_window_days", means: "Days they have for that" },
    { field: "sales_deadline", means: "The date that window ends" },
    { field: "monthly_sales", means: "The monthly pace to hit it" },
    { field: "vendor_list", means: "Their merchants, with discount ranges" },
    { field: "vendor_count", means: "How many merchants they have" },
    { field: "businesses_so_far", means: "Businesses counted to them so far" },
    { field: "sales_so_far", means: "Sales counted to them so far" },
    { field: "site_url", means: "The website address" },
  ],
  vendor_mou: [
    { field: "our_company", means: "Spendbox" },
    { field: "reference", means: "The agreement's reference, e.g. MOU-4K2P-7QX" },
    { field: "start_date", means: "The effective date" },
    { field: "vendor_company", means: "The merchant's company name" },
    { field: "vendor_contact", means: "The person signing for them" },
    { field: "vendor_email", means: "Their email" },
    { field: "vendor_phone", means: "Their phone" },
    { field: "vendor_rc", means: "Their RC number" },
    { field: "categories", means: "What they supply" },
    { field: "regions", means: "Where they deliver" },
    { field: "fulfilment_speed", means: "How fast they fulfil" },
    { field: "payment_terms", means: "Their payment terms" },
    { field: "discount_min", means: "The lowest agreed discount, in %" },
    { field: "discount_max", means: "The highest agreed discount, in %" },
    { field: "term_months", means: "How many months the MOU runs" },
  ],
};

/* ------------------------------------------------------------------ */
/* Reading and saving                                                  */
/* ------------------------------------------------------------------ */

export const missingDocumentsTable = (message: string) =>
  /app_documents/.test(message) &&
  /(does not exist|schema cache|relation)/i.test(message);

/**
 * The document as it should be used right now: your saved version if there
 * is one, the shipped default if not. Never throws — a missing table or no
 * database at all just means the default.
 */
export async function getDocument(key: DocumentKey): Promise<StoredDocument> {
  const fallback: StoredDocument = {
    key,
    ...DEFAULTS[key],
    updated_at: null,
    updated_by: null,
    isDefault: true,
  };

  const db = getSupabase();
  if (!db) return fallback;

  const { data, error } = await db
    .from("app_documents")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return fallback;

  const row = data as Omit<StoredDocument, "isDefault">;
  return {
    ...row,
    key,
    meta: { ...DEFAULTS[key].meta, ...(row.meta ?? {}) },
    isDefault: false,
  };
}

export function targetsFrom(meta: Record<string, unknown>): PlaybookTargets {
  const n = (value: unknown, fallback: number) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  };
  return {
    targetBusinesses: n(meta.targetBusinesses, DEFAULT_TARGETS.targetBusinesses),
    businessWindowDays: n(meta.businessWindowDays, DEFAULT_TARGETS.businessWindowDays),
    targetSales: n(meta.targetSales, DEFAULT_TARGETS.targetSales),
    salesWindowDays: n(meta.salesWindowDays, DEFAULT_TARGETS.salesWindowDays),
  };
}

export const saveDocumentSchema = z.object({
  key: z.enum(DOCUMENT_KEYS),
  title: z.string().trim().min(2, "Give it a title").max(160),
  body: z.string().trim().min(20, "The document is too short").max(60_000),
  meta: z
    .object({
      targetBusinesses: z.coerce.number().int().min(1).max(100_000).optional(),
      businessWindowDays: z.coerce.number().int().min(1).max(3650).optional(),
      targetSales: z.coerce.number().min(1).max(1_000_000_000_000).optional(),
      salesWindowDays: z.coerce.number().int().min(1).max(3650).optional(),
      termMonths: z.coerce.number().int().min(1).max(120).optional(),
    })
    .optional()
    .default({}),
  /** Throws your version away and goes back to the shipped text. */
  reset: z.boolean().optional(),
});
