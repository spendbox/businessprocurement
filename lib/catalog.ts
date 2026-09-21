/**
 * The things businesses actually ask us to source, and the shape of the
 * questions we ask them. Kept in one place so the landing page, the order
 * form and the emails never drift apart.
 */

export type Category = {
  slug: string;
  name: string;
  /** Shown under the name on the category tiles. */
  blurb: string;
  /** Concrete examples — these also seed the request field placeholders. */
  examples: string[];
  image: string;
};

export const CATEGORIES: Category[] = [
  {
    slug: "office-furniture",
    name: "Office furniture",
    blurb: "Chairs, desks, workstations, shelving, reception fit-out.",
    examples: [
      "50 ergonomic office chairs, delivered to Ikeja",
      "12 height-adjustable desks for a new floor",
      "Reception sofa and coffee table set",
    ],
    image: "/img/office-furniture.svg",
  },
  {
    slug: "it-electronics",
    name: "IT & electronics",
    blurb: "Laptops, monitors, printers, networking, phones.",
    examples: [
      "10 laptops for a new branch office",
      "3 network printers with a year of toner",
      "24-port switches and Cat6 cabling for 2 floors",
    ],
    image: "/img/it-electronics.svg",
  },
  {
    slug: "ppe-safety",
    name: "PPE & safety",
    blurb: "Gloves, helmets, boots, hi-vis, fire and first response.",
    examples: [
      "200 boxes of nitrile gloves, size M",
      "80 safety boots and hi-vis vests for a site crew",
      "Fire extinguishers and signage for a warehouse",
    ],
    image: "/img/ppe-safety.svg",
  },
  {
    slug: "packaging-print",
    name: "Packaging & print",
    blurb: "Cartons, labels, mailers, branded boxes, tape.",
    examples: [
      "Branded packaging for 5,000 units",
      "10,000 printed labels on a roll",
      "Corrugated mailers in three sizes",
    ],
    image: "/img/packaging-print.svg",
  },
  {
    slug: "cleaning",
    name: "Cleaning & janitorial",
    blurb: "Detergents, disinfectant, tissue, bins, equipment.",
    examples: [
      "Monthly janitorial supply for a 3-floor office",
      "Industrial floor scrubber plus consumables",
      "500 rolls of 2-ply tissue",
    ],
    image: "/img/cleaning.svg",
  },
  {
    slug: "pantry-food",
    name: "Pantry & food service",
    blurb: "Water, coffee, disposables, staff catering supplies.",
    examples: [
      "Weekly water and coffee for 60 staff",
      "2,000 branded paper cups",
      "Staff pantry restock, recurring monthly",
    ],
    image: "/img/pantry-food.svg",
  },
  {
    slug: "power-energy",
    name: "Power & energy",
    blurb: "Generators, inverters, solar, UPS, fuel, servicing.",
    examples: [
      "40kVA soundproof generator, installed",
      "5kVA inverter and battery bank",
      "Solar array for a rural clinic",
    ],
    image: "/img/power-energy.svg",
  },
  {
    slug: "medical",
    name: "Medical & lab",
    blurb: "Consumables, reagents, devices, clinic fit-out.",
    examples: [
      "Monthly consumables for a 20-bed clinic",
      "Digital BP monitors, 15 units",
      "Cold-chain vaccine carriers",
    ],
    image: "/img/medical.svg",
  },
  {
    slug: "building-materials",
    name: "Building materials",
    blurb: "Cement, steel, tiles, paint, plumbing, electricals.",
    examples: [
      "600 bags of cement to a site in Abuja",
      "Tiles and adhesive for 400 sqm",
      "Electrical conduit and fittings, full schedule",
    ],
    image: "/img/building-materials.svg",
  },
  {
    slug: "logistics",
    name: "Logistics & fleet",
    blurb: "Vehicles, tyres, parts, haulage, fleet servicing.",
    examples: [
      "Two delivery vans, financed or outright",
      "Tyres and servicing for a 12-vehicle fleet",
      "Haulage from Lagos port to Kano, monthly",
    ],
    image: "/img/logistics.svg",
  },
  {
    slug: "uniforms",
    name: "Uniforms & workwear",
    blurb: "Branded shirts, overalls, aprons, corporate gifts.",
    examples: [
      "150 branded polo shirts, embroidered",
      "Overalls and aprons for a factory floor",
      "End-of-year corporate gift hampers",
    ],
    image: "/img/uniforms.svg",
  },
  {
    slug: "stationery",
    name: "Stationery & print",
    blurb: "Paper, files, pens, forms, books, office basics.",
    examples: [
      "100 reams of A4 and assorted stationery",
      "Custom-printed invoice books",
      "Archive files and box files, bulk",
    ],
    image: "/img/stationery.svg",
  },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);

/** Nothing on the list fits — we still want the request. */
export const OTHER_CATEGORY = "Other / not listed";

/** What the pickers actually offer. */
export const CATEGORY_OPTIONS = [...CATEGORY_NAMES, OTHER_CATEGORY];

export function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

/* ------------------------------------------------------------------ */
/* Urgency — how soon they need it                                     */
/* ------------------------------------------------------------------ */

export type UrgencyValue =
  | "same-day"
  | "48-hours"
  | "this-week"
  | "two-weeks"
  | "this-month"
  | "flexible";

export type Urgency = {
  value: UrgencyValue;
  label: string;
  detail: string;
  /** Used for the little heat bar on the option. */
  heat: 1 | 2 | 3 | 4 | 5;
};

export const URGENCIES: Urgency[] = [
  {
    value: "same-day",
    label: "Today",
    detail: "Emergency: we call within the hour",
    heat: 5,
  },
  {
    value: "48-hours",
    label: "In 1–2 days",
    detail: "Urgent, quotes back same day",
    heat: 4,
  },
  {
    value: "this-week",
    label: "This week",
    detail: "Standard priority",
    heat: 3,
  },
  {
    value: "two-weeks",
    label: "In 2 weeks",
    detail: "Time to compare more offers",
    heat: 2,
  },
  {
    value: "this-month",
    label: "Within a month",
    detail: "Planned purchase",
    heat: 1,
  },
  {
    value: "flexible",
    label: "Flexible",
    detail: "Best price matters more than speed",
    heat: 1,
  },
];

export function urgencyLabel(value: string): string {
  const u = URGENCIES.find((x) => x.value === value);
  return u ? `${u.label} — ${u.detail}` : value;
}

/* ------------------------------------------------------------------ */
/* Budget bands                                                        */
/* ------------------------------------------------------------------ */

export const BUDGET_BANDS = [
  "Under ₦500,000",
  "₦500,000 – ₦2m",
  "₦2m – ₦10m",
  "₦10m – ₦50m",
  "Over ₦50m",
  "Not sure yet",
] as const;

/* ------------------------------------------------------------------ */
/* Vendor-side options                                                 */
/* ------------------------------------------------------------------ */

export const FULFILMENT_SPEEDS = [
  "Same or next day",
  "2–5 working days",
  "1–2 weeks",
  "Made to order (3+ weeks)",
] as const;

export const PAYMENT_TERMS = [
  "Full payment upfront",
  "Part payment, balance on delivery",
  "Payment on delivery",
  "Net 30 credit",
  "Negotiable",
] as const;

export const BUSINESS_AGE = [
  "Less than a year",
  "1–3 years",
  "3–10 years",
  "Over 10 years",
] as const;

/** Who at the merchant we will actually be speaking to. */
export const VENDOR_ROLES = [
  "Owner / founder",
  "Managing director",
  "Sales lead",
  "Sales representative",
  "Business development",
  "Operations manager",
  "Procurement manager",
  "Account manager",
  "Customer service",
  "Other",
] as const;

/** How a purchase order or spreadsheet reaches us. */
export const ATTACHMENT_TIMING = [
  {
    value: "now",
    label: "Send it now",
    detail: "We reply within minutes with an address to send it to",
  },
  {
    value: "later",
    label: "Send it later",
    detail: "We start sourcing from your description in the meantime",
  },
] as const;

export type AttachmentTiming = (typeof ATTACHMENT_TIMING)[number]["value"];
