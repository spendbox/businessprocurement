import { getSupabase } from "./supabase";
import { CATEGORIES, URGENCIES } from "./catalog";

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

export async function listRequests(options: {
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
 * Merchants worth sending a given request to: approved, supplying at least
 * one of its categories, and covering where it has to go.
 */
export async function matchingVendors(request: RequestRow): Promise<VendorRow[]> {
  const { data, error } = await db()
    .from("vendor_applications")
    .select("*")
    .eq("status", "approved")
    .overlaps("categories", request.categories)
    .order("created_at", { ascending: false });
  if (error) throw new DataUnavailable(error.message);

  const vendors = (data ?? []) as VendorRow[];
  const inNigeria = (request.country ?? "Nigeria") === "Nigeria";

  return vendors.filter((v) => {
    if (v.regions.includes("Nationwide (Nigeria)") && inNigeria) return true;
    if (!inNigeria) return v.regions.includes("Import / outside Nigeria");
    return v.regions.includes(request.region);
  });
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
};

const DAYS = 14;

export async function getStats(): Promise<Stats> {
  const client = db();

  const [requestsResult, vendorsResult] = await Promise.all([
    client
      .from("procurement_requests")
      .select("created_at,status,urgency,categories")
      .order("created_at", { ascending: false })
      .limit(5000),
    client.from("vendor_applications").select("status,categories").limit(5000),
  ]);

  if (requestsResult.error) throw new DataUnavailable(requestsResult.error.message);
  if (vendorsResult.error) throw new DataUnavailable(vendorsResult.error.message);

  const requests = (requestsResult.data ?? []) as {
    created_at: string;
    status: string;
    urgency: string;
    categories: string[];
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
  };
}
