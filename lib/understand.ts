import { BUDGET_BANDS, CATEGORY_OPTIONS, OTHER_CATEGORY, URGENCIES } from "./catalog";
import { NIGERIA_STATES, NIGERIA_STATE_NAMES } from "./geo";
import { classifyLocal } from "./classify";

/**
 * Reads a request written in plain words and pulls out the structure.
 *
 * The buyer types one thing. Everything a sourcing team needs — category,
 * quantity, budget, where it goes, how soon — is worked out here rather
 * than asked for one field at a time. Whatever is found is shown back for
 * correction, so a wrong guess costs a tap, not a lost request.
 *
 * Two layers, same as the classifier: a local pass that always runs and
 * always works, and an optional model pass on top when a key is set. The
 * model's answer is checked field by field against the real option lists
 * before any of it is used.
 */

export type Understanding = {
  categories: string[];
  quantity: string;
  budget: string;
  region: string;
  city: string;
  urgency: string;
  /** One line a human can scan, e.g. "200 boxes of gloves for Ikeja". */
  summary: string;
  source: "model" | "local";
};

const EMPTY: Understanding = {
  categories: [],
  quantity: "",
  budget: "",
  region: "",
  city: "",
  urgency: "",
  summary: "",
  source: "local",
};

/* ------------------------------------------------------------------ */
/* Local extraction — no key, no network                               */
/* ------------------------------------------------------------------ */

/** "50 chairs", "200 boxes", "10,000 units", "600 bags" */
function findQuantity(text: string): string {
  const UNITS =
    "pieces?|pcs|units?|boxes|box|cartons?|bags?|reams?|rolls?|packs?|sets?|pairs?|litres?|liters?|tonnes?|tons?|kg|sqm|square metres?|seats?|laptops?|chairs?|desks?|bottles?|drums?|vans?|trucks?|generators?|printers?|monitors?|tyres?|tiles?";
  // Up to three words may sit between the number and the unit, as in
  // "50 ergonomic office chairs".
  const match = text.match(
    new RegExp(`\\b(\\d[\\d,.]*)\\s+((?:[a-z-]+\\s+){0,3}?(?:${UNITS}))\\b`, "i"),
  );
  if (match) return `${match[1]} ${match[2].toLowerCase().replace(/\s+/g, " ")}`;
  const bare = text.match(/\b(\d[\d,]{1,8})\b/);
  return bare ? bare[1] : "";
}

/** Naira figures, written any of the ways people actually write them. */
function findBudget(text: string): string {
  const match = text.match(
    /(?:₦|ngn|naira)\s*([\d,.]+)\s*(k|m|mn|million|bn|billion)?|\b([\d,.]+)\s*(million|m|bn|billion)\s*(?:naira|₦|ngn)/i,
  );
  if (!match) return "";
  const raw = (match[1] ?? match[3] ?? "").replace(/,/g, "");
  const scale = (match[2] ?? match[4] ?? "").toLowerCase();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "";

  const naira =
    scale.startsWith("b") ? n * 1_000_000_000
    : scale.startsWith("m") ? n * 1_000_000
    : scale === "k" ? n * 1_000
    : n;

  if (naira < 500_000) return BUDGET_BANDS[0];
  if (naira < 2_000_000) return BUDGET_BANDS[1];
  if (naira < 10_000_000) return BUDGET_BANDS[2];
  if (naira < 50_000_000) return BUDGET_BANDS[3];
  return BUDGET_BANDS[4];
}

/** Match against the real Nigerian state and city lists, longest name first. */
function findPlace(text: string): { region: string; city: string } {
  const haystack = ` ${text.toLowerCase()} `;
  const hit = (name: string) =>
    new RegExp(`(?<![a-z])${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`).test(
      haystack,
    );

  let city = "";
  let region = "";

  const cities: { city: string; state: string }[] = [];
  for (const [state, list] of Object.entries(NIGERIA_STATES)) {
    for (const c of list) cities.push({ city: c, state });
  }
  cities.sort((a, b) => b.city.length - a.city.length);
  for (const c of cities) {
    if (hit(c.city)) {
      city = c.city;
      region = c.state;
      break;
    }
  }

  if (!region) {
    for (const state of [...NIGERIA_STATE_NAMES].sort((a, b) => b.length - a.length)) {
      if (hit(state)) {
        region = state;
        break;
      }
    }
  }
  return { region, city };
}

const URGENCY_HINTS: { value: string; patterns: RegExp[] }[] = [
  { value: "same-day", patterns: [/\btoday\b/i, /\bright now\b/i, /\bimmediately\b/i, /\bemergency\b/i, /\basap\b/i] },
  { value: "48-hours", patterns: [/\btomorrow\b/i, /\b(1|2|two)\s*days?\b/i, /\bnext day\b/i, /\burgent/i] },
  { value: "this-week", patterns: [/\bthis week\b/i, /\bwithin (a|the) week\b/i, /\b(3|4|5|6|7|three|four|five)\s*days?\b/i] },
  { value: "two-weeks", patterns: [/\btwo weeks\b/i, /\b2 weeks\b/i, /\bfortnight\b/i] },
  { value: "this-month", patterns: [/\bthis month\b/i, /\bwithin a month\b/i, /\b(3|4|three|four)\s*weeks\b/i] },
  { value: "flexible", patterns: [/\bno rush\b/i, /\bflexible\b/i, /\bwhenever\b/i, /\bnot urgent\b/i] },
];

function findUrgency(text: string): string {
  for (const { value, patterns } of URGENCY_HINTS) {
    if (patterns.some((p) => p.test(text))) return value;
  }
  return "";
}

export function understandLocally(text: string): Understanding {
  const trimmed = text.trim();
  if (trimmed.length < 8) return { ...EMPTY };

  const { region, city } = findPlace(trimmed);
  const first = trimmed.split(/[.\n]/)[0]?.trim() ?? trimmed;

  return {
    categories: classifyLocal(trimmed),
    quantity: findQuantity(trimmed),
    budget: findBudget(trimmed),
    region,
    city,
    urgency: findUrgency(trimmed),
    summary: first.length > 110 ? `${first.slice(0, 107)}…` : first,
    source: "local",
  };
}

/* ------------------------------------------------------------------ */
/* Optional model pass                                                 */
/* ------------------------------------------------------------------ */

const VALID_CATEGORIES = new Set(CATEGORY_OPTIONS);
const VALID_BUDGETS = new Set<string>(BUDGET_BANDS);
const VALID_URGENCIES = new Set<string>(URGENCIES.map((u) => u.value));
const VALID_STATES = new Set(NIGERIA_STATE_NAMES);

export const modelConfigured = () => Boolean(process.env.OPENAI_API_KEY);

async function understandWithModel(
  text: string,
  signal: AbortSignal,
): Promise<Understanding | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You read business procurement requests written in plain words and return structured JSON.",
              "",
              "Return exactly this shape:",
              '{"categories":["..."],"quantity":"","budget":"","region":"","city":"","urgency":"","summary":""}',
              "",
              `categories: one to three, copied EXACTLY from this list: ${CATEGORY_OPTIONS.join("; ")}. Use "${OTHER_CATEGORY}" only when nothing fits.`,
              'quantity: the amount and unit as written, e.g. "200 boxes". Empty string if not stated.',
              `budget: EXACTLY one of: ${BUDGET_BANDS.join("; ")}. Empty string if no money is mentioned. Convert any figure to the band it falls in.`,
              `region: a Nigerian state, copied EXACTLY from: ${NIGERIA_STATE_NAMES.join("; ")}. Empty string if not stated or not Nigeria.`,
              'city: the town or area named, e.g. "Ikeja". Empty string if none.',
              `urgency: EXACTLY one of: ${URGENCIES.map((u) => u.value).join("; ")}. Empty string if no timing is mentioned.`,
              "summary: one short line naming the item and destination. Under 110 characters.",
              "",
              "Never invent a detail that is not in the text. Prefer an empty string over a guess.",
            ].join("\n"),
          },
          { role: "user", content: text.slice(0, 4000) },
        ],
      }),
    });
    if (!response.ok) return null;

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories
          .filter((c): c is string => typeof c === "string")
          .map((c) => c.trim())
          .filter((c) => VALID_CATEGORIES.has(c))
          .slice(0, 3)
      : [];

    const budget = str(parsed.budget);
    const region = str(parsed.region);
    const urgency = str(parsed.urgency);

    return {
      categories,
      quantity: str(parsed.quantity).slice(0, 160),
      // Anything the model returns that is not a real option is dropped.
      budget: VALID_BUDGETS.has(budget) ? budget : "",
      region: VALID_STATES.has(region) ? region : "",
      city: str(parsed.city).slice(0, 80),
      urgency: VALID_URGENCIES.has(urgency) ? urgency : "",
      summary: str(parsed.summary).slice(0, 140),
      source: "model",
    };
  } catch {
    return null;
  }
}

/**
 * The function the API route calls. The local pass always runs, and fills
 * any blank the model left — between them we keep the best of each.
 */
export async function understand(text: string): Promise<Understanding> {
  const local = understandLocally(text);
  if (!modelConfigured()) return local;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const fromModel = await understandWithModel(text, controller.signal);
    if (!fromModel) return local;
    return {
      categories: fromModel.categories.length ? fromModel.categories : local.categories,
      quantity: fromModel.quantity || local.quantity,
      budget: fromModel.budget || local.budget,
      region: fromModel.region || local.region,
      city: fromModel.city || local.city,
      urgency: fromModel.urgency || local.urgency,
      summary: fromModel.summary || local.summary,
      source: "model",
    };
  } finally {
    clearTimeout(timeout);
  }
}
