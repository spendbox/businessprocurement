import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Server-side only. Returns null when Supabase isn't configured, so the
 * site stays fully functional on emails alone.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export const dbConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

/** Insert and never throw — a database hiccup must not lose the request. */
export async function saveRow(
  table: "procurement_requests" | "vendor_applications",
  row: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Supabase is not configured" };
  const { error } = await db.from(table).insert(row);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
