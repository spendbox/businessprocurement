import { z } from "zod";
import { getSupabase } from "./supabase";
import { MIN_PASSWORD, ROLES, roleCanSignIn, type Role } from "./roles";

export {
  ROLES,
  ROLE_LABEL,
  ROLE_DETAIL,
  COORDINATOR_HOME,
  MIN_PASSWORD,
  coordinatorMayVisit,
  roleCanSignIn,
  roleNav,
  type Role,
} from "./roles";

/**
 * Your team, and what each of them may do.
 *
 * Two roles, deliberately. An **admin** sees the whole dashboard. A
 * **coordinator** — the sub-admin — works the requests and sends them out to
 * merchants, and never sees a single number about the business: no overview,
 * no charts, no invoices, no totals. That is a real boundary, enforced in the
 * middleware, on every page and in every route that could leak one, not just
 * by hiding links.
 *
 * The owner account in ADMIN_EMAIL / ADMIN_PASSWORD is not in this table and
 * is always an admin, so nothing done here can lock you out.
 */

export type TeamMember = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  active: boolean;
  password_hash: string | null;
  last_login_at: string | null;
  notes: string | null;
  /** When a marketer's targets start counting. */
  started_on?: string | null;
};

/** What the browser is allowed to know about a team member. */
export type TeamMemberView = Omit<TeamMember, "password_hash"> & {
  canSignIn: boolean;
};

export const asView = (member: TeamMember): TeamMemberView => {
  const { password_hash, ...rest } = member;
  return {
    ...rest,
    canSignIn: Boolean(password_hash) && roleCanSignIn(member.role),
  };
};

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

const ITERATIONS = 210_000;

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Passwords are never stored, only a slow salted hash of them. Web Crypto's
 * PBKDF2 needs no dependency and runs anywhere this project runs.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/** Constant-time comparison, so a near-miss is not measurably closer. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function passwordMatches(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, algorithm, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || algorithm !== "sha256") return false;
  const rounds = Number(iterations);
  if (!Number.isFinite(rounds) || rounds < 1000) return false;
  try {
    const candidate = await derive(password, fromBase64(salt), rounds);
    return sameBytes(candidate, fromBase64(hash));
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const passwordRule = z
  .string()
  .min(MIN_PASSWORD, `A password needs at least ${MIN_PASSWORD} characters`)
  .max(200);

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker");

export const newMemberSchema = z
  .object({
    name: z.string().trim().min(2, "Their name is needed").max(120),
    email: z.string().trim().toLowerCase().email("A valid email address is needed"),
    phone: z.string().trim().max(32).optional().or(z.literal("")),
    role: z.enum(ROLES),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    /** Leave blank for someone who only needs to be assigned work. */
    password: passwordRule.optional().or(z.literal("")),
    startedOn: isoDate.optional().or(z.literal("")),
  })
  .refine((m) => roleCanSignIn(m.role) || !m.password, {
    message: "Marketers do not sign in, so they cannot have a password",
    path: ["password"],
  });

export const updateMemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  password: passwordRule.optional().or(z.literal("")),
  /** Takes their sign-in away without deleting the person. */
  removePassword: z.boolean().optional(),
  email: z.string().trim().toLowerCase().email("A valid email address is needed").optional(),
  startedOn: isoDate.optional().or(z.literal("")),
});

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** Thrown when the team table has not been created yet. */
export class TeamUnavailable extends Error {}

export const missingTeamTable = (message: string) =>
  /team_members/.test(message) &&
  /(does not exist|schema cache|relation)/i.test(message);

function db() {
  const client = getSupabase();
  if (!client) {
    throw new TeamUnavailable(
      "Supabase is not configured, so there is no team to manage yet.",
    );
  }
  return client;
}

const teamTrouble = (message: string) =>
  missingTeamTable(message)
    ? new TeamUnavailable(
        "The team_members table is not in the database yet. Run supabase/schema.sql in the Supabase SQL editor and this page will come to life.",
      )
    : new TeamUnavailable(message);

export async function listTeam(): Promise<TeamMemberView[]> {
  const { data, error } = await db()
    .from("team_members")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw teamTrouble(error.message);
  return ((data ?? []) as TeamMember[]).map(asView);
}

/** The same list, but never throwing — for pages that only want the names. */
export async function listTeamQuietly(): Promise<TeamMemberView[]> {
  try {
    return await listTeam();
  } catch {
    return [];
  }
}

export async function findMemberByEmail(email: string): Promise<TeamMember | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from("team_members")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  /* No table yet simply means nobody but the owner can sign in. */
  if (error) return null;
  return (data as TeamMember) ?? null;
}

export async function noteSignIn(id: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client
    .from("team_members")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", id);
}

/**
 * How many merchants each person has, keyed by member id: the ones they
 * look after, or for a marketer the ones they work.
 */
export async function vendorCounts(): Promise<Record<string, number>> {
  const client = getSupabase();
  if (!client) return {};

  let rows: { assigned_to?: string | null; marketer_id?: string | null }[] = [];
  const both = await client.from("vendor_applications").select("assigned_to,marketer_id").limit(5000);
  if (!both.error) {
    rows = both.data ?? [];
  } else {
    /* Before the marketer migration there is only the one column. */
    const one = await client.from("vendor_applications").select("assigned_to").limit(5000);
    if (one.error) return {};
    rows = one.data ?? [];
  }

  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const id of [row.assigned_to, row.marketer_id]) {
      if (id) counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}
