import { getSupabase } from "./supabase";
import { discountLabel } from "./discount";
import { fillFields, plainDoc, renderDoc, escapeText } from "./doc-render";
import { layout } from "./email";
import { formatMoney } from "./invoices";
import type { PlaybookTargets } from "./documents";
import type { TeamMember, TeamMemberView } from "./team";

/**
 * Marketers: who they are working, how far along their targets they are,
 * and the emails we send them.
 *
 * Targets are counted from each marketer's own start date. A business counts
 * once, however many requests it sends, and only if it first came in inside
 * the window. Sales count when an invoice for one of their businesses is
 * marked paid, in naira, inside the sales window.
 */

export type MarketerVendor = {
  id: string;
  company: string;
  reference: string;
  contact_name: string;
  email: string;
  phone: string;
  categories: string[];
  regions: string[];
  status: string;
  discount_min: number | null;
  discount_max: number | null;
  marketer_id: string | null;
};

export type Progress = {
  start: string;
  businessDeadline: string;
  salesDeadline: string;
  /** Inside the window — what the target is measured against. */
  businesses: number;
  sales: number;
  /** Everything ever counted to them. */
  businessesAllTime: number;
  salesAllTime: number;
};

export type MarketerSummary = TeamMemberView & {
  vendors: MarketerVendor[];
  progress: Progress;
  lastEmailedAt: string | null;
};

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const prettyDay = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const startOf = (member: { started_on?: string | null; created_at: string }) =>
  (member.started_on || member.created_at).slice(0, 10);

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/** Every merchant with a marketer on it. Empty if the column is not there yet. */
async function assignedVendors(): Promise<MarketerVendor[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("vendor_applications")
    .select(
      "id,company,reference,contact_name,email,phone,categories,regions,status,discount_min,discount_max,marketer_id",
    )
    .not("marketer_id", "is", null)
    .order("company", { ascending: true })
    .limit(5000);
  if (error) return [];
  return (data ?? []) as MarketerVendor[];
}

/** Every merchant, for the "assign a merchant" picker. */
export async function allVendorsForPicker(): Promise<MarketerVendor[]> {
  const db = getSupabase();
  if (!db) return [];
  const full = await db
    .from("vendor_applications")
    .select(
      "id,company,reference,contact_name,email,phone,categories,regions,status,discount_min,discount_max,marketer_id",
    )
    .order("company", { ascending: true })
    .limit(5000);
  if (!full.error) return (full.data ?? []) as MarketerVendor[];

  /* Before the migration: still list the merchants, just unassigned. */
  const basic = await db
    .from("vendor_applications")
    .select("id,company,reference,contact_name,email,phone,categories,regions,status")
    .order("company", { ascending: true })
    .limit(5000);
  return ((basic.data ?? []) as Omit<MarketerVendor, "discount_min" | "discount_max" | "marketer_id">[]).map(
    (v) => ({ ...v, discount_min: null, discount_max: null, marketer_id: null }),
  );
}

type CountedRequest = { id: string; company: string; created_at: string; marketer_id: string };
type PaidInvoice = { request_id: string | null; total: number; currency: string; paid_at: string | null; created_at: string };

async function countedWork(): Promise<{ requests: CountedRequest[]; invoices: PaidInvoice[] }> {
  const db = getSupabase();
  if (!db) return { requests: [], invoices: [] };

  const [requests, invoices] = await Promise.all([
    db
      .from("procurement_requests")
      .select("id,company,created_at,marketer_id")
      .not("marketer_id", "is", null)
      .limit(20000),
    db
      .from("invoices")
      .select("request_id,total,currency,paid_at,created_at")
      .eq("status", "paid")
      .not("request_id", "is", null)
      .limit(20000),
  ]);

  return {
    requests: requests.error ? [] : ((requests.data ?? []) as CountedRequest[]),
    invoices: invoices.error ? [] : ((invoices.data ?? []) as PaidInvoice[]),
  };
}

export function progressFor(
  member: { id: string; started_on?: string | null; created_at: string },
  targets: PlaybookTargets,
  work: { requests: CountedRequest[]; invoices: PaidInvoice[] },
): Progress {
  const start = startOf(member);
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const businessEnd = startMs + targets.businessWindowDays * DAY;
  const salesEnd = startMs + targets.salesWindowDays * DAY;

  const mine = work.requests.filter((r) => r.marketer_id === member.id);

  /* A business is counted by its first request, however many follow. */
  const firstSeen = new Map<string, number>();
  for (const r of mine) {
    const key = r.company.trim().toLowerCase();
    const at = new Date(r.created_at).getTime();
    if (!firstSeen.has(key) || at < firstSeen.get(key)!) firstSeen.set(key, at);
  }
  const businesses = [...firstSeen.values()].filter(
    (at) => at >= startMs && at < businessEnd,
  ).length;

  const requestIds = new Set(mine.map((r) => r.id));
  let sales = 0;
  let salesAllTime = 0;
  for (const invoice of work.invoices) {
    if (!invoice.request_id || !requestIds.has(invoice.request_id)) continue;
    if (invoice.currency !== "NGN") continue;
    const at = new Date(invoice.paid_at ?? invoice.created_at).getTime();
    const amount = Number(invoice.total) || 0;
    salesAllTime += amount;
    if (at >= startMs && at < salesEnd) sales += amount;
  }

  return {
    start,
    businessDeadline: isoDay(businessEnd - DAY),
    salesDeadline: isoDay(salesEnd - DAY),
    businesses,
    sales,
    businessesAllTime: firstSeen.size,
    salesAllTime,
  };
}

async function lastEmailed(): Promise<Record<string, string>> {
  const db = getSupabase();
  if (!db) return {};
  const { data, error } = await db
    .from("team_emails")
    .select("member_id,created_at")
    .eq("ok", true)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return {};
  const latest: Record<string, string> = {};
  for (const row of (data ?? []) as { member_id: string | null; created_at: string }[]) {
    if (row.member_id && !latest[row.member_id]) latest[row.member_id] = row.created_at;
  }
  return latest;
}

/** Everything the Marketers page shows, for every marketer. */
export async function marketerSummaries(
  team: TeamMemberView[],
  targets: PlaybookTargets,
): Promise<MarketerSummary[]> {
  const marketers = team.filter((m) => m.role === "marketer");
  if (marketers.length === 0) return [];

  const [vendors, work, emailed] = await Promise.all([
    assignedVendors(),
    countedWork(),
    lastEmailed(),
  ]);

  return marketers.map((m) => ({
    ...m,
    vendors: vendors.filter((v) => v.marketer_id === m.id),
    progress: progressFor(m, targets, work),
    lastEmailedAt: emailed[m.id] ?? null,
  }));
}

/** One marketer, ready to write to. */
export async function marketerForEmail(
  id: string,
  targets: PlaybookTargets,
): Promise<{ member: TeamMember; vendors: MarketerVendor[]; progress: Progress } | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data } = await db.from("team_members").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const member = data as TeamMember;
  const [vendors, work] = await Promise.all([assignedVendors(), countedWork()]);
  return {
    member,
    vendors: vendors.filter((v) => v.marketer_id === id),
    progress: progressFor(member, targets, work),
  };
}

/* ------------------------------------------------------------------ */
/* Merge fields                                                        */
/* ------------------------------------------------------------------ */

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://spendbox.site";

export function vendorListText(vendors: MarketerVendor[]): string {
  if (vendors.length === 0) {
    return "- No merchants assigned to you yet — we will send them to you shortly.";
  }
  return vendors
    .map(
      (v) =>
        `- **${v.company}** — ${v.categories.slice(0, 4).join(", ")} — discount **${discountLabel(
          v.discount_min,
          v.discount_max,
        )}** — delivers to ${v.regions.slice(0, 4).join(", ")}`,
    )
    .join("\n");
}

/** The values every {{field}} in a marketer email or the playbook can use. */
export function marketerFields(
  member: { name: string },
  vendors: MarketerVendor[],
  progress: Progress,
  targets: PlaybookTargets,
): Record<string, string> {
  return {
    name: member.name,
    first_name: member.name.trim().split(/\s+/)[0] ?? member.name,
    start_date: prettyDay(progress.start),
    target_businesses: String(targets.targetBusinesses),
    business_window_days: String(targets.businessWindowDays),
    business_deadline: prettyDay(progress.businessDeadline),
    weekly_businesses: String(
      Math.ceil(targets.targetBusinesses / Math.max(1, targets.businessWindowDays / 7)),
    ),
    target_sales: formatMoney(targets.targetSales, "NGN").replace(/\.00$/, ""),
    sales_window_days: String(targets.salesWindowDays),
    sales_deadline: prettyDay(progress.salesDeadline),
    monthly_sales: formatMoney(
      Math.round(targets.targetSales / Math.max(1, targets.salesWindowDays / 30)),
      "NGN",
    ).replace(/\.00$/, ""),
    vendor_list: vendorListText(vendors),
    vendor_count: String(vendors.length),
    businesses_so_far: String(progress.businesses),
    sales_so_far: formatMoney(progress.sales, "NGN").replace(/\.00$/, ""),
    site_url: siteUrl(),
  };
}

/* ------------------------------------------------------------------ */
/* Writing to them                                                     */
/* ------------------------------------------------------------------ */

export const INCLUDE_OPTIONS = ["vendors", "progress", "playbook"] as const;
export type IncludeOption = (typeof INCLUDE_OPTIONS)[number];

export const INCLUDE_LABEL: Record<IncludeOption, string> = {
  vendors: "Their merchants and discount ranges",
  progress: "Where they are against their targets",
  playbook: "The full playbook",
};

const FONT = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";

function section(title: string, inner: string): string {
  return `<div style="margin:28px 0 0;padding:22px 0 0;border-top:1px solid #e4e2d8;">
  <div style="margin:0 0 12px;font:700 11px/1.4 ${FONT};letter-spacing:.09em;text-transform:uppercase;color:#0f7a52;">${escapeText(
    title,
  )}</div>
  ${inner}
</div>`;
}

function vendorsHtml(vendors: MarketerVendor[]): string {
  if (vendors.length === 0) {
    return `<p style="margin:0;font:400 15px/1.6 ${FONT};color:#5f736a;">No merchants are assigned to you yet — we will send them to you shortly.</p>`;
  }
  return vendors
    .map(
      (v) => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 10px;border:1px solid #e4e2d8;border-radius:12px;">
<tr><td style="padding:14px 16px;">
  <div style="font:700 16px/1.35 ${FONT};color:#12211b;">${escapeText(v.company)}</div>
  <div style="margin-top:3px;font:400 14px/1.5 ${FONT};color:#5f736a;">${escapeText(
        v.categories.join(", "),
      )}</div>
  <div style="margin-top:8px;font:600 14px/1.5 ${FONT};color:#12211b;">Discount: <span style="color:#0f7a52;">${escapeText(
        discountLabel(v.discount_min, v.discount_max),
      )}</span></div>
  <div style="margin-top:2px;font:400 13.5px/1.5 ${FONT};color:#5f736a;">Delivers to ${escapeText(
        v.regions.join(", "),
      )}</div>
  <div style="margin-top:2px;font:400 13.5px/1.5 ${FONT};color:#5f736a;">Contact: ${escapeText(
        v.contact_name,
      )} · ${escapeText(v.phone)}</div>
</td></tr></table>`,
    )
    .join("");
}

function bar(label: string, done: string, goal: string, fraction: number, by: string): string {
  const width = Math.max(2, Math.min(100, Math.round(fraction * 100)));
  return `<div style="margin:0 0 16px;">
  <div style="font:600 14px/1.5 ${FONT};color:#12211b;">${escapeText(label)}</div>
  <div style="margin:2px 0 8px;font:400 13.5px/1.5 ${FONT};color:#5f736a;"><strong style="color:#12211b;">${escapeText(
    done,
  )}</strong> of ${escapeText(goal)} · by ${escapeText(by)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ecebe3;border-radius:99px;"><tr>
    <td width="${width}%" style="height:8px;background:#0f7a52;border-radius:99px;font-size:0;line-height:0;">&nbsp;</td>
    <td style="font-size:0;line-height:0;">&nbsp;</td>
  </tr></table>
</div>`;
}

function progressHtml(progress: Progress, targets: PlaybookTargets): string {
  return [
    bar(
      "Businesses on board",
      String(progress.businesses),
      String(targets.targetBusinesses),
      progress.businesses / targets.targetBusinesses,
      prettyDay(progress.businessDeadline),
    ),
    bar(
      "Sales from your businesses",
      formatMoney(progress.sales, "NGN"),
      formatMoney(targets.targetSales, "NGN"),
      progress.sales / targets.targetSales,
      prettyDay(progress.salesDeadline),
    ),
  ].join("");
}

export type ComposeInput = {
  subject: string;
  message: string;
  include: IncludeOption[];
};

/**
 * One email, written for one marketer.
 *
 * The subject and the message are yours, with their {{fields}} filled in
 * for this person; the sections you ticked follow underneath. Nothing here
 * is a fixed template — two marketers get two different emails.
 */
export function composeMarketerEmail(
  input: ComposeInput,
  who: { member: { name: string }; vendors: MarketerVendor[]; progress: Progress },
  targets: PlaybookTargets,
  playbook: { title: string; body: string },
): { subject: string; html: string; text: string } {
  const fields = marketerFields(who.member, who.vendors, who.progress, targets);
  const subject = fillFields(input.subject, fields);
  const message = fillFields(input.message, fields);

  const parts: string[] = [renderDoc(message)];
  const textParts: string[] = [plainDoc(message)];

  if (input.include.includes("vendors")) {
    parts.push(section("Your merchants", vendorsHtml(who.vendors)));
    textParts.push(`YOUR MERCHANTS\n\n${plainDoc(vendorListText(who.vendors))}`);
  }
  if (input.include.includes("progress")) {
    parts.push(section("Where you are", progressHtml(who.progress, targets)));
    textParts.push(
      `WHERE YOU ARE\n\nBusinesses on board: ${who.progress.businesses} of ${targets.targetBusinesses} by ${prettyDay(
        who.progress.businessDeadline,
      )}\nSales: ${formatMoney(who.progress.sales, "NGN")} of ${formatMoney(
        targets.targetSales,
        "NGN",
      )} by ${prettyDay(who.progress.salesDeadline)}`,
    );
  }
  if (input.include.includes("playbook")) {
    const body = fillFields(playbook.body, fields);
    parts.push(section(fillFields(playbook.title, fields), renderDoc(body)));
    textParts.push(plainDoc(body));
  }

  const html = layout({
    preheader: message.replace(/[#*\-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 110),
    eyebrow: "Spendbox marketing",
    heading: subject,
    intro: "",
    lead: parts.join("\n"),
    body: "",
    audience: "You are receiving this because you work with Spendbox as a marketer.",
    footnote: "Questions? Just reply to this email.",
  });

  return {
    subject,
    html,
    text: [subject, "=".repeat(Math.min(60, subject.length)), "", ...textParts, "", "— Spendbox"].join(
      "\n\n",
    ),
  };
}

/** The ready-made words for the common emails, which you can then change. */
export const STARTERS: { id: string; label: string; subject: string; message: string; include: IncludeOption[] }[] = [
  {
    id: "welcome",
    label: "Welcome and playbook",
    subject: "Welcome to Spendbox, {{first_name}} — your playbook",
    message:
      "Hello {{first_name}},\n\nWelcome to the team. Your targets start counting from **{{start_date}}**:\n\n- **{{target_businesses}} businesses on board by {{business_deadline}}**\n- **{{target_sales}} in sales by {{sales_deadline}}**\n\nYour merchants and the discounts they have agreed are below, followed by the full playbook. Read it this week — everything you need is in it.\n\nWe are glad to have you.",
    include: ["vendors", "playbook"],
  },
  {
    id: "progress",
    label: "Progress check-in",
    subject: "{{first_name}}, where you are: {{businesses_so_far}} of {{target_businesses}}",
    message:
      "Hello {{first_name}},\n\nA quick look at where you are. You have **{{businesses_so_far}} businesses** on board so far, and **{{sales_so_far}}** in sales.\n\nKeep to the weekly rhythm — about **{{weekly_businesses}} new businesses a week** gets you there by {{business_deadline}}. Tell us what is getting in the way and we will help.",
    include: ["progress"],
  },
  {
    id: "vendors",
    label: "Your merchants",
    subject: "Your Spendbox merchants and their discounts",
    message:
      "Hello {{first_name}},\n\nHere are the {{vendor_count}} merchants you are working with, and the discount each has agreed to give businesses you bring in. **Never promise more than the top of a range** — if a business wants more, tell us and we will negotiate it.",
    include: ["vendors"],
  },
  {
    id: "blank",
    label: "Write my own",
    subject: "",
    message: "Hello {{first_name}},\n\n",
    include: [],
  },
];

/** A short note when a merchant is handed to a marketer. */
export function assignmentEmail(
  member: { name: string },
  vendor: MarketerVendor,
  reassigned: boolean,
): { subject: string; html: string; text: string } {
  const first = member.name.trim().split(/\s+/)[0] ?? member.name;
  const message = `Hello ${first},\n\n${
    reassigned ? "A merchant has been moved over to you" : "You have a new merchant to work with"
  }: **${vendor.company}**.\n\nThey have agreed a discount of **${discountLabel(
    vendor.discount_min,
    vendor.discount_max,
  )}** for businesses you bring in. Their details are below. Start telling the businesses you speak to about what they supply.`;

  const html = layout({
    preheader: `${vendor.company} — discount ${discountLabel(vendor.discount_min, vendor.discount_max)}`,
    eyebrow: "Spendbox marketing",
    heading: `New merchant: ${vendor.company}`,
    intro: "",
    lead: renderDoc(message) + section("The merchant", vendorsHtml([vendor])),
    body: "",
    audience: "You are receiving this because you work with Spendbox as a marketer.",
    footnote: "Questions? Just reply to this email.",
  });

  return {
    subject: `New merchant for you: ${vendor.company}`,
    html,
    text: `${plainDoc(message)}\n\n${plainDoc(vendorListText([vendor]))}\n\n— Spendbox`,
  };
}

/** Writes one line to the email log. Never throws. */
export async function logTeamEmail(entry: {
  memberId: string;
  to: string;
  subject: string;
  included: string[];
  ok: boolean;
  error?: string;
  sentBy?: string;
}): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  await db.from("team_emails").insert({
    member_id: entry.memberId,
    to_email: entry.to,
    subject: entry.subject.slice(0, 300),
    included: entry.included,
    ok: entry.ok,
    error: entry.error?.slice(0, 500) ?? null,
    sent_by: entry.sentBy ?? null,
  });
}
