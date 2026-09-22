import { getSupabase } from "./supabase";
import { CATEGORIES, URGENCIES } from "./catalog";
import type { InvoiceRow } from "./invoices";

/** Rows as the dashboard reads them. */
export type RequestRow = {
  id: string;
  created_at: string;
  reference: string;
  need: string;
  categories: string[];
  quantity: string | null;
  has_attachment: boolean | null;
  attachment_timing: string | null;
  attachment_note: string | null;
  urgency: string;
  has_deadline: boolean | null;
  needed_by: string | null;
  country: string | null;
  region: string;
  city: string;
  address: string | null;
  company: string;
  contact_name: string;
  email: string;
  phone: string;
  budget: string | null;
  recurring: boolean;
  notes: string | null;
  status: string;
  internal_notes: string | null;
  /** Set when the request was filed away; null while it is live work. */
  archived_at: string | null;
};

export type VendorRow = {
  id: string;
  created_at: string;
  reference: string;
  company: string;
  rc_number: string | null;
  website: string | null;
  years_trading: string;
  categories: string[];
  supply_description: string;
  moq: string | null;
  monthly_capacity: string | null;
  fulfilment_speed: string;
  regions: string[];
  own_logistics: boolean;
  payment_terms: string;
  contact_name: string;
  role: string | null;
  email: string;
  phone: string;
  notes: string | null;
  status: string;
  /** The team member who looks after them, if anyone does. */
  assigned_to: string | null;
  /** True when an admin typed them in rather than them applying. */
  added_by_admin?: boolean | null;
};

export const REQUEST_STATUSES = [
  "new",
  "sourcing",
  "quoted",
  "won",
  "lost",
  "cancelled",
] as const;

export const VENDOR_STATUSES = ["pending", "approved", "rejected", "paused"] as const;

/** Thrown to the page so it can explain rather than crash. */
export class DataUnavailable extends Error {}

function db() {
  const client = getSupabase();
  if (!client) {
    throw new DataUnavailable(
      "Supabase is not configured, so there is nothing to show yet.",
    );
  }
  return client;
}

/**
 * Which side of the archive to look at. "active" is the working list and
 * the default everywhere — a cancelled request is filed away, not deleted,
 * so it stays available under "archived".
 */
export type ArchiveView = "active" | "archived" | "all";

/**
 * True when the database has not had the archiving migration run against
 * it yet. The dashboard keeps working in that case rather than showing an
 * error about a column nobody has heard of.
 */
const missingArchiveColumn = (message: string) =>
  /archived_at/.test(message) && /column|schema cache/i.test(message);

export async function listRequests(options: {
  status?: string;
  urgency?: string;
  category?: string;
  search?: string;
  archive?: ArchiveView;
  limit?: number;
}): Promise<RequestRow[]> {
  const archive = options.archive ?? "active";

  let query = db()
    .from("procurement_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (archive === "active") query = query.is("archived_at", null);
  if (archive === "archived") query = query.not("archived_at", "is", null);

  if (options.status) query = query.eq("status", options.status);
  if (options.urgency) query = query.eq("urgency", options.urgency);
  if (options.category) query = query.contains("categories", [options.category]);
  if (options.search) {
    const term = options.search.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        [
          `company.ilike.%${term}%`,
          `reference.ilike.%${term}%`,
          `contact_name.ilike.%${term}%`,
          `email.ilike.%${term}%`,
          `need.ilike.%${term}%`,
        ].join(","),
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    /* An un-migrated database has no archive; show everything instead. */
    if (missingArchiveColumn(error.message)) {
      if (archive === "archived") return [];
      return listRequestsWithoutArchive(options);
    }
    throw new DataUnavailable(error.message);
  }
  return (data ?? []) as RequestRow[];
}

/** The same query with no archive filter, for a database missing the column. */
async function listRequestsWithoutArchive(options: {
  status?: string;
  urgency?: string;
  category?: string;
  search?: string;
  limit?: number;
}): Promise<RequestRow[]> {
  let query = db()
    .from("procurement_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.status) query = query.eq("status", options.status);
  if (options.urgency) query = query.eq("urgency", options.urgency);
  if (options.category) query = query.contains("categories", [options.category]);

  const { data, error } = await query;
  if (error) throw new DataUnavailable(error.message);
  return (data ?? []) as RequestRow[];
}

export async function getRequest(id: string): Promise<RequestRow | null> {
  const { data, error } = await db()
    .from("procurement_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new DataUnavailable(error.message);
  return (data as RequestRow) ?? null;
}

export async function listVendors(options: {
  status?: string;
  category?: string;
  search?: string;
  limit?: number;
}): Promise<VendorRow[]> {
  let query = db()
    .from("vendor_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.status) query = query.eq("status", options.status);
  if (options.category) query = query.contains("categories", [options.category]);
  if (options.search) {
    const term = options.search.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        [
          `company.ilike.%${term}%`,
          `reference.ilike.%${term}%`,
          `contact_name.ilike.%${term}%`,
          `email.ilike.%${term}%`,
        ].join(","),
      );
    }
  }

  const { data, error } = await query;
  if (error) throw new DataUnavailable(error.message);
  return (data ?? []) as VendorRow[];
}

/**
 * Every approved merchant, scored against a request.
 *
 * Returns all of them rather than only the ones that match, because the
 * person deciding sometimes knows something the data does not — a supplier
 * who will travel for a big enough order, or one being tried out. The score
 * sorts the list and the reasons explain it; nobody is hidden.
 */
export type ScoredVendor = VendorRow & {
  score: number;
  reasons: string[];
  gaps: string[];
  /** Above the bar we would recommend sending to. */
  recommended: boolean;
};

const URGENT = new Set(["same-day", "48-hours"]);
const FAST = new Set(["Same or next day", "2–5 working days"]);

const TRADING_POINTS: Record<string, number> = {
  "Over 10 years": 8,
  "3–10 years": 5,
  "1–3 years": 2,
  "Less than a year": 0,
};

export function scoreVendor(vendor: VendorRow, request: RequestRow): ScoredVendor {
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  /* Category fit is the thing that matters most. */
  const wanted = request.categories ?? [];
  const overlap = wanted.filter((c) => vendor.categories.includes(c));
  if (overlap.length > 0) {
    score += Math.min(80, overlap.length * 40);
    reasons.push(
      overlap.length === wanted.length
        ? `Supplies all ${wanted.length === 1 ? "of it" : `${wanted.length} categories`}`
        : `Supplies ${overlap.length} of ${wanted.length} categories`,
    );
  } else {
    gaps.push("Does not list these categories");
  }

  /* Can they actually get it there? */
  const inNigeria = (request.country ?? "Nigeria") === "Nigeria";
  if (!inNigeria) {
    if (vendor.regions.includes("Import / outside Nigeria")) {
      score += 25;
      reasons.push("Handles imports");
    } else {
      gaps.push(`Not set up for ${request.country}`);
    }
  } else if (vendor.regions.includes(request.region)) {
    score += 30;
    reasons.push(`Covers ${request.region}`);
  } else if (vendor.regions.includes("Nationwide (Nigeria)")) {
    score += 22;
    reasons.push("Covers nationwide");
  } else {
    gaps.push(`Does not cover ${request.region}`);
  }

  /* Speed, weighed against how soon the buyer needs it. */
  if (URGENT.has(request.urgency)) {
    if (vendor.fulfilment_speed === "Same or next day") {
      score += 20;
      reasons.push("Fast enough for an urgent order");
    } else if (FAST.has(vendor.fulfilment_speed)) {
      score += 8;
    } else {
      gaps.push(`Only fulfils in ${vendor.fulfilment_speed.toLowerCase()}`);
    }
  } else {
    score += 10;
  }

  if (vendor.own_logistics) {
    score += 6;
    reasons.push("Delivers themselves");
  }
  score += TRADING_POINTS[vendor.years_trading] ?? 0;
  if (vendor.years_trading === "Over 10 years") reasons.push("Over ten years trading");

  /* Worth sending to when they can supply it AND can get it there. */
  const canSupply = overlap.length > 0;
  const canReach = !gaps.some((g) => g.startsWith("Does not cover") || g.startsWith("Not set up"));

  return { ...vendor, score, reasons, gaps, recommended: canSupply && canReach };
}

export async function rankedVendors(request: RequestRow): Promise<ScoredVendor[]> {
  const { data, error } = await db()
    .from("vendor_applications")
    .select("*")
    .eq("status", "approved")
    .limit(500);
  if (error) throw new DataUnavailable(error.message);

  return ((data ?? []) as VendorRow[])
    .map((v) => scoreVendor(v, request))
    .sort((a, b) => b.score - a.score || a.company.localeCompare(b.company));
}

/** Kept for the "who could take this" count on the overview. */
export async function matchingVendors(request: RequestRow): Promise<VendorRow[]> {
  return (await rankedVendors(request)).filter((v) => v.recommended);
}

/* ------------------------------------------------------------------ */
/* Statistics                                                          */
/* ------------------------------------------------------------------ */

export type Stats = {
  totalRequests: number;
  openRequests: number;
  requestsThisWeek: number;
  urgentOpen: number;
  totalVendors: number;
  approvedVendors: number;
  pendingVendors: number;
  byStatus: { label: string; value: number }[];
  byUrgency: { label: string; value: number }[];
  byCategory: { label: string; value: number }[];
  daily: { date: string; value: number }[];
  uncoveredCategories: string[];
  /** Cancelled work, filed away and out of the working list. */
  archivedRequests: number;
};

const DAYS = 14;

export async function getStats(): Promise<Stats> {
  const client = db();

  const requestColumns = "created_at,status,urgency,categories,archived_at";

  const loadRequests = (columns: string) =>
    client
      .from("procurement_requests")
      .select(columns)
      .order("created_at", { ascending: false })
      .limit(5000);

  let [requestsResult, vendorsResult] = await Promise.all([
    loadRequests(requestColumns),
    client.from("vendor_applications").select("status,categories").limit(5000),
  ]);

  /* A database without the archiving migration still gets its numbers. */
  if (requestsResult.error && missingArchiveColumn(requestsResult.error.message)) {
    requestsResult = await loadRequests("created_at,status,urgency,categories");
  }

  if (requestsResult.error) throw new DataUnavailable(requestsResult.error.message);
  if (vendorsResult.error) throw new DataUnavailable(vendorsResult.error.message);

  const requests = (requestsResult.data ?? []) as unknown as {
    created_at: string;
    status: string;
    urgency: string;
    categories: string[];
    archived_at?: string | null;
  }[];
  const vendors = (vendorsResult.data ?? []) as {
    status: string;
    categories: string[];
  }[];

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const count = <T extends string>(rows: T[]) => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r, (map.get(r) ?? 0) + 1);
    return map;
  };

  const statusCounts = count(requests.map((r) => r.status));
  const urgencyCounts = count(requests.map((r) => r.urgency));

  const categoryCounts = new Map<string, number>();
  for (const r of requests) {
    for (const c of r.categories ?? []) {
      categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
    }
  }

  // Last 14 days, including the empty ones — gaps are information.
  const daily: { date: string; value: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i -= 1) {
    const day = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = day.toISOString().slice(0, 10);
    daily.push({
      date: key,
      value: requests.filter((r) => r.created_at.slice(0, 10) === key).length,
    });
  }

  const approved = vendors.filter((v) => v.status === "approved");
  const covered = new Set(approved.flatMap((v) => v.categories ?? []));
  const uncoveredCategories = CATEGORIES.map((c) => c.name).filter(
    (name) => !covered.has(name),
  );

  const openStatuses = new Set(["new", "sourcing", "quoted"]);
  const urgentValues = new Set(["same-day", "48-hours"]);

  return {
    totalRequests: requests.length,
    openRequests: requests.filter((r) => openStatuses.has(r.status)).length,
    requestsThisWeek: requests.filter(
      (r) => new Date(r.created_at).getTime() >= weekAgo,
    ).length,
    urgentOpen: requests.filter(
      (r) => openStatuses.has(r.status) && urgentValues.has(r.urgency),
    ).length,
    totalVendors: vendors.length,
    approvedVendors: approved.length,
    pendingVendors: vendors.filter((v) => v.status === "pending").length,
    byStatus: REQUEST_STATUSES.map((s) => ({
      label: s,
      value: statusCounts.get(s) ?? 0,
    })),
    byUrgency: URGENCIES.map((u) => ({
      label: u.label,
      value: urgencyCounts.get(u.value) ?? 0,
    })),
    byCategory: [...categoryCounts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12),
    daily,
    uncoveredCategories,
    archivedRequests: requests.filter((r) => Boolean(r.archived_at)).length,
  };
}

/* ------------------------------------------------------------------ */
/* Merchants — removing one for good                                   */
/* ------------------------------------------------------------------ */

/**
 * Deletes a merchant application outright.
 *
 * Used for duplicates, test rows and companies that asked to be taken off.
 * Nothing references a merchant after the fact — quotes go out by email —
 * so there is no orphan to worry about, and a real removal is what
 * "delete this merchant" is expected to mean.
 */
export async function deleteVendor(
  id: string,
): Promise<{ ok: boolean; company?: string; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const { data: existing, error: findError } = await client
    .from("vendor_applications")
    .select("company")
    .eq("id", id)
    .maybeSingle();
  if (findError) return { ok: false, error: findError.message };
  if (!existing) return { ok: false, error: "That merchant is already gone." };

  const { error } = await client.from("vendor_applications").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, company: (existing as { company: string }).company };
}

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

/** Thrown when the invoices table has not been created yet. */
export class InvoicesUnavailable extends DataUnavailable {}

const missingInvoicesTable = (message: string) =>
  /invoices/.test(message) &&
  /(does not exist|schema cache|relation)/i.test(message);

const invoiceTrouble = (message: string) =>
  missingInvoicesTable(message)
    ? new InvoicesUnavailable(
        "The invoices table is not in the database yet. Run supabase/schema.sql in the Supabase SQL editor and this page will fill itself in.",
      )
    : new DataUnavailable(message);

export async function listInvoices(options: {
  status?: string;
  requestId?: string;
  search?: string;
  limit?: number;
} = {}): Promise<InvoiceRow[]> {
  let query = db()
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.status) query = query.eq("status", options.status);
  if (options.requestId) query = query.eq("request_id", options.requestId);
  if (options.search) {
    const term = options.search.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        [
          `reference.ilike.%${term}%`,
          `bill_to_company.ilike.%${term}%`,
          `bill_to_email.ilike.%${term}%`,
          `request_reference.ilike.%${term}%`,
        ].join(","),
      );
    }
  }

  const { data, error } = await query;
  if (error) throw invoiceTrouble(error.message);
  return (data ?? []) as InvoiceRow[];
}

export async function getInvoice(id: string): Promise<InvoiceRow | null> {
  const { data, error } = await db()
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw invoiceTrouble(error.message);
  return (data as InvoiceRow) ?? null;
}

/** The invoices raised against one request, newest first. Never throws. */
export async function invoicesForRequest(requestId: string): Promise<InvoiceRow[]> {
  try {
    return await listInvoices({ requestId, limit: 50 });
  } catch {
    return [];
  }
}
