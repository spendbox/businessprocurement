import { CATEGORIES, OTHER_CATEGORY } from "./catalog";

/**
 * Works out which categories a request belongs to, from the words the
 * buyer actually typed.
 *
 * Two layers:
 *
 *  1. A keyword classifier that runs in-process. No key, no network, no
 *     cost, answers in well under a millisecond. This is the default and
 *     it is always the fallback.
 *  2. An optional LLM pass, used only when an API key is configured. It
 *     talks to any OpenAI-compatible endpoint, so the model and provider
 *     are yours to choose in the environment rather than baked in here.
 *
 * The LLM never gets the last word on its own: anything it returns is
 * checked against the real category list before it is used, and if it is
 * slow, unreachable or returns nonsense we fall back to layer 1.
 */

/** Words that point at a category, roughly strongest first. */
const KEYWORDS: Record<string, string[]> = {
  "office-furniture": [
    "chair", "chairs", "desk", "desks", "workstation", "swivel", "ergonomic",
    "shelving", "shelf", "cabinet", "filing", "table", "tables", "sofa",
    "reception", "furniture", "bookcase", "cubicle", "stool", "armchair",
    "conference table", "office fit-out", "partition",
  ],
  "it-electronics": [
    "laptop", "laptops", "computer", "computers", "desktop", "monitor",
    "monitors", "printer", "printers", "scanner", "server", "router",
    "switch", "networking", "cat6", "cable", "projector", "phone", "phones",
    "tablet", "ipad", "macbook", "cctv", "camera", "hard drive", "ssd",
    "keyboard", "mouse", "ups battery", "toner", "cartridge", "software",
    "workstation pc", "access point", "firewall",
  ],
  "ppe-safety": [
    "glove", "gloves", "nitrile", "helmet", "hard hat", "safety boot",
    "boots", "hi-vis", "high visibility", "goggles", "mask", "masks",
    "n95", "respirator", "coverall", "ppe", "fire extinguisher",
    "first aid", "harness", "ear plug", "safety", "protective", "apron",
    "face shield",
  ],
  "packaging-print": [
    "packaging", "carton", "cartons", "box", "boxes", "mailer", "label",
    "labels", "tape", "shrink wrap", "bubble wrap", "pallet", "sachet",
    "pouch", "bottle", "corrugated", "branded box", "sticker", "wrapping",
    "crate",
  ],
  cleaning: [
    "cleaning", "detergent", "disinfectant", "sanitiser", "sanitizer",
    "tissue", "toilet roll", "bleach", "mop", "broom", "janitorial",
    "waste bin", "dustbin", "hand wash", "soap", "scrubber", "vacuum",
    "air freshener", "cleaner", "wipes",
  ],
  "pantry-food": [
    "water", "coffee", "tea", "pantry", "catering", "snack", "snacks",
    "disposable cup", "cutlery", "plate", "sugar", "milk", "dispenser",
    "refreshment", "canteen", "bottled water", "juice", "food",
    "staff lunch", "beverage",
  ],
  "power-energy": [
    "generator", "gen set", "genset", "kva", "inverter", "solar", "panel",
    "battery", "batteries", "ups", "diesel", "fuel", "avr", "stabiliser",
    "stabilizer", "power", "electricity", "transformer", "change over",
    "energy", "backup power",
  ],
  medical: [
    "medical", "clinic", "hospital", "syringe", "needle", "reagent",
    "consumable", "bandage", "dressing", "bp monitor", "stethoscope",
    "thermometer", "vaccine", "cold chain", "lab", "laboratory",
    "test kit", "oxygen", "wheelchair", "hospital bed", "scrubs",
  ],
  "building-materials": [
    "cement", "sand", "gravel", "block", "blocks", "steel", "rebar",
    "iron rod", "tile", "tiles", "paint", "plumbing", "pipe", "pipes",
    "roofing", "timber", "plywood", "nail", "screw", "conduit",
    "electrical fitting", "wire", "door", "window", "building",
    "construction", "bricks", "pop ceiling",
  ],
  logistics: [
    "van", "truck", "vehicle", "vehicles", "bus", "car", "tyre", "tyres",
    "tire", "haulage", "fleet", "delivery", "logistics", "forklift",
    "motorcycle", "tricycle", "keke", "spare part", "engine oil",
    "lubricant", "trailer", "shipping",
  ],
  uniforms: [
    "uniform", "uniforms", "polo", "shirt", "shirts", "branded shirt",
    "overall", "overalls", "workwear", "apron", "cap", "jacket",
    "embroider", "corporate gift", "hamper", "souvenir", "t-shirt",
    "tshirt", "vest", "jersey", "staff wear",
  ],
  stationery: [
    "stationery", "paper", "a4", "ream", "reams", "pen", "pens", "pencil",
    "file", "files", "folder", "notebook", "envelope", "stapler",
    "invoice book", "receipt book", "marker", "whiteboard", "binder",
    "archive box", "diary", "calendar",
  ],
};

const NAME_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c.name]));

/** Escape a keyword so it is safe inside a RegExp. */
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Keyword classifier. Returns category names, best first, or an empty
 * array when nothing matched confidently.
 */
export function classifyLocal(text: string, limit = 3): string[] {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ")} `;
  if (haystack.trim().length < 3) return [];

  const scores: { slug: string; score: number }[] = [];

  for (const [slug, words] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const word of words) {
      // Whole-word match, so "pen" does not fire on "expensive".
      const re = new RegExp(`(?<![a-z0-9])${escape(word)}(?:s|es)?(?![a-z0-9])`, "g");
      const hits = haystack.match(re);
      if (hits) {
        // Longer, more specific phrases count for more than single words.
        score += hits.length * (1 + word.split(" ").length * 0.6);
      }
    }
    if (score > 0) scores.push({ slug, score });
  }

  if (scores.length === 0) return [];

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0].score;

  return scores
    // Keep runners-up only when they are genuinely close to the winner.
    .filter((s) => s.score >= Math.max(1, top * 0.45))
    .slice(0, limit)
    .map((s) => NAME_BY_SLUG.get(s.slug))
    .filter((n): n is string => Boolean(n));
}

/* ------------------------------------------------------------------ */
/* Optional LLM pass                                                   */
/* ------------------------------------------------------------------ */

const VALID_NAMES = new Set([...CATEGORIES.map((c) => c.name), OTHER_CATEGORY]);

export const llmConfigured = () => Boolean(process.env.OPENAI_API_KEY);

/**
 * Asks a language model to pick from the list. Any OpenAI-compatible
 * endpoint works — set OPENAI_BASE_URL to point elsewhere.
 * Returns null on any problem so the caller falls back to keywords.
 */
async function classifyWithLLM(
  text: string,
  signal: AbortSignal,
): Promise<string[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const allowed = [...CATEGORIES.map((c) => c.name), OTHER_CATEGORY];

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You sort business procurement requests into categories. " +
              `Choose only from this exact list: ${allowed.join("; ")}. ` +
              'Reply with JSON: {"categories":["..."]}. ' +
              "Pick one to three, most relevant first. Use " +
              `"${OTHER_CATEGORY}" only when nothing else fits. ` +
              "Copy category names exactly as written.",
          },
          { role: "user", content: text.slice(0, 1200) },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return null;

    const parsed = JSON.parse(raw) as { categories?: unknown };
    if (!Array.isArray(parsed.categories)) return null;

    // Never trust the model's strings — keep only real category names.
    const clean = parsed.categories
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim())
      .filter((c) => VALID_NAMES.has(c))
      .slice(0, 3);

    return clean.length > 0 ? clean : null;
  } catch {
    return null;
  }
}

export type Classification = {
  categories: string[];
  source: "model" | "keywords" | "none";
};

/**
 * The classifier the API route uses. Tries the model when configured,
 * gives it a short leash, and falls back to keywords otherwise.
 */
export async function classify(text: string): Promise<Classification> {
  const keywords = classifyLocal(text);

  if (!llmConfigured()) {
    return { categories: keywords, source: keywords.length ? "keywords" : "none" };
  }

  // A suggestion that arrives late is worse than a decent instant one.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const fromModel = await classifyWithLLM(text, controller.signal);
    if (fromModel) return { categories: fromModel, source: "model" };
  } finally {
    clearTimeout(timeout);
  }

  return { categories: keywords, source: keywords.length ? "keywords" : "none" };
}
