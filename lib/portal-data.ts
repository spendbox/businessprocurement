import { getSupabase } from "./supabase";
import { DataUnavailable, type RequestRow, type VendorRow } from "./admin-data";

/**
 * Everything one email address is allowed to see.
 *
 * Scoped by email on every query — a portal session carries nothing but a
 * verified address, so there is no way to ask for somebody else's rows.
 */
export type PortalData = {
  requests: RequestRow[];
  vendor: VendorRow | null;
};

export async function getPortalData(email: string): Promise<PortalData> {
  const db = getSupabase();
  if (!db) {
    throw new DataUnavailable(
      "The database is not connected on this deployment, so there is nothing to show.",
    );
  }

  const [requests, vendors] = await Promise.all([
    db
      .from("procurement_requests")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("vendor_applications")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (requests.error) throw new DataUnavailable(requests.error.message);
  if (vendors.error) throw new DataUnavailable(vendors.error.message);

  return {
    requests: (requests.data ?? []) as RequestRow[],
    vendor: ((vendors.data ?? [])[0] as VendorRow) ?? null,
  };
}

/** What each status means to the person who sent the request. */
export const BUYER_STATUS: Record<string, { label: string; detail: string; step: number }> = {
  new: { label: "Received", detail: "We have it and are lining up merchants.", step: 1 },
  sourcing: { label: "Sourcing", detail: "Out with merchants for pricing.", step: 2 },
  quoted: { label: "Offers ready", detail: "We have prices for you — check your email.", step: 3 },
  won: { label: "Ordered", detail: "You accepted an offer and it is on its way.", step: 4 },
  lost: { label: "Closed", detail: "This one did not go ahead.", step: 0 },
  cancelled: { label: "Cancelled", detail: "This request was cancelled.", step: 0 },
};

export const VENDOR_STATUS: Record<string, { label: string; detail: string }> = {
  pending: {
    label: "Under review",
    detail: "We review new merchants within two working days.",
  },
  approved: {
    label: "Approved",
    detail: "You are on the list. We send you requests that match what you supply.",
  },
  rejected: {
    label: "Not approved",
    detail: "We could not approve this application. Reply to our email if you think that is wrong.",
  },
  paused: {
    label: "Paused",
    detail: "You are not being sent requests at the moment.",
  },
};
