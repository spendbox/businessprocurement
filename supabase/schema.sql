-- ============================================================
-- Spendbox — database schema
--
-- Run this once in the Supabase SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- The site works without Supabase; this is only for keeping a
-- searchable record of every request and merchant application.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Buyer requests
-- ------------------------------------------------------------
create table if not exists public.procurement_requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  reference       text not null unique,

  -- what they need
  need            text not null,
  categories      text[] not null default '{}',
  quantity        text,

  -- purchase order / spreadsheet
  has_attachment    boolean not null default false,
  attachment_timing text check (attachment_timing in ('now','later')),
  attachment_note   text,

  -- when and where
  urgency         text not null,
  has_deadline    boolean not null default false,
  needed_by       date,
  country         text not null default 'Nigeria',
  region          text not null,
  city            text,
  address         text,

  -- who is asking
  company         text not null,
  contact_name    text not null,
  email           text not null,
  phone           text not null,
  budget          text,
  recurring       boolean not null default false,
  notes           text,

  -- your team's workflow
  status          text not null default 'new'
                    check (status in ('new','sourcing','quoted','won','lost','cancelled')),
  internal_notes  text
);

create index if not exists procurement_requests_created_at_idx
  on public.procurement_requests (created_at desc);
create index if not exists procurement_requests_status_idx
  on public.procurement_requests (status);
create index if not exists procurement_requests_urgency_idx
  on public.procurement_requests (urgency);
create index if not exists procurement_requests_email_idx
  on public.procurement_requests (email);
create index if not exists procurement_requests_categories_idx
  on public.procurement_requests using gin (categories);
create index if not exists procurement_requests_region_idx
  on public.procurement_requests (region);

-- ------------------------------------------------------------
-- Merchant applications
-- ------------------------------------------------------------
create table if not exists public.vendor_applications (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),

  reference          text not null unique,

  -- the company
  company            text not null,
  rc_number          text,
  website            text,
  years_trading      text not null,

  -- what they supply
  categories         text[] not null default '{}',
  supply_description text not null,
  moq                text,
  monthly_capacity   text,
  fulfilment_speed   text not null,

  -- coverage and terms
  regions            text[] not null default '{}',
  own_logistics      boolean not null default false,
  payment_terms      text not null,

  -- contact
  contact_name       text not null,
  role               text,
  email              text not null,
  phone              text not null,
  notes              text,

  -- your team's workflow
  status             text not null default 'pending'
                       check (status in ('pending','approved','rejected','paused')),
  internal_notes     text
);

create index if not exists vendor_applications_created_at_idx
  on public.vendor_applications (created_at desc);
create index if not exists vendor_applications_status_idx
  on public.vendor_applications (status);
create index if not exists vendor_applications_categories_idx
  on public.vendor_applications using gin (categories);
create index if not exists vendor_applications_regions_idx
  on public.vendor_applications using gin (regions);

-- ------------------------------------------------------------
-- Security
--
-- Row Level Security is ON with no policies, which means: nobody
-- can read or write these tables with the public "anon" key.
-- The website writes with the service-role key from the server
-- only, and that key bypasses RLS. Your own team reads the rows
-- through the Supabase dashboard.
--
-- Never put SUPABASE_SERVICE_ROLE_KEY in a NEXT_PUBLIC_ variable.
-- ------------------------------------------------------------
alter table public.procurement_requests enable row level security;
alter table public.vendor_applications  enable row level security;

-- ------------------------------------------------------------
-- Upgrading an existing database
--
-- If you already ran an earlier version of this file, run this
-- block instead of the whole thing. It is safe to run twice.
-- ------------------------------------------------------------
alter table public.procurement_requests
  add column if not exists has_attachment    boolean not null default false,
  add column if not exists attachment_timing text,
  add column if not exists has_deadline      boolean not null default false,
  add column if not exists country           text not null default 'Nigeria';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'procurement_requests_attachment_timing_check'
  ) then
    alter table public.procurement_requests
      add constraint procurement_requests_attachment_timing_check
      check (attachment_timing in ('now','later'));
  end if;
end $$;

-- ------------------------------------------------------------
-- Upgrade for the single smart request form
--
-- The buyer now writes one message and the structured fields are
-- read out of it, so the city may legitimately be unknown at the
-- point the request is saved. Safe to run twice.
-- ------------------------------------------------------------
alter table public.procurement_requests
  alter column city drop not null;

-- ------------------------------------------------------------
-- Archiving cancelled requests
--
-- A cancelled request is not deleted — it is filed away. The
-- dashboard hides archived rows unless you ask for them, so the
-- working list only shows live work. Safe to run twice.
-- ------------------------------------------------------------
alter table public.procurement_requests
  add column if not exists archived_at timestamptz;

create index if not exists procurement_requests_archived_at_idx
  on public.procurement_requests (archived_at);

-- Anything already cancelled belongs in the archive.
update public.procurement_requests
   set archived_at = coalesce(archived_at, now())
 where status = 'cancelled'
   and archived_at is null;

-- ------------------------------------------------------------
-- Invoices
--
-- Raised in the dashboard against a request (or on their own),
-- emailed to the business, and downloadable as a document.
-- Money is stored in the smallest sensible unit for the currency
-- as a numeric, never a float.
-- ------------------------------------------------------------
create table if not exists public.invoices (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  reference         text not null unique,

  -- what it is for
  request_id        uuid references public.procurement_requests (id) on delete set null,
  request_reference text,

  -- who it goes to
  bill_to_company   text not null,
  bill_to_name      text,
  bill_to_email     text not null,
  bill_to_address   text,

  -- the money
  currency          text not null default 'NGN',
  items             jsonb not null default '[]'::jsonb,
  subtotal          numeric(14,2) not null default 0,
  tax_rate          numeric(6,3) not null default 0,
  tax_amount        numeric(14,2) not null default 0,
  delivery          numeric(14,2) not null default 0,
  total             numeric(14,2) not null default 0,

  -- terms
  issue_date        date not null default current_date,
  due_date          date,
  notes             text,

  status            text not null default 'draft'
                      check (status in ('draft','sent','paid','void')),
  sent_at           timestamptz,
  paid_at           timestamptz
);

create index if not exists invoices_created_at_idx
  on public.invoices (created_at desc);
create index if not exists invoices_request_id_idx
  on public.invoices (request_id);
create index if not exists invoices_status_idx
  on public.invoices (status);
create index if not exists invoices_bill_to_email_idx
  on public.invoices (bill_to_email);

alter table public.invoices enable row level security;

-- ------------------------------------------------------------
-- Your team
--
-- The people who work with you. Three roles:
--
--   admin        sees and does everything, including the numbers
--   coordinator  the sub-admin: works the requests and sends them
--                out to merchants, and sees no statistics at all
--   marketer     never signs in; a name, an email and a phone
--                number to assign merchants to and send work to
--
-- A member with a password can sign in; one without is only a
-- name to hang work on. The owner account in ADMIN_EMAIL /
-- ADMIN_PASSWORD always works and is not in this table, so a
-- mistake here can never lock you out of your own dashboard.
-- ------------------------------------------------------------
create table if not exists public.team_members (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),

  name           text not null,
  email          text not null unique,
  phone          text,

  role           text not null default 'coordinator'
                   check (role in ('admin','coordinator','marketer')),
  active         boolean not null default true,

  -- PBKDF2-SHA256, salted. Null means this person cannot sign in.
  password_hash  text,
  last_login_at  timestamptz,

  notes          text
);

create index if not exists team_members_email_idx on public.team_members (email);
create index if not exists team_members_role_idx  on public.team_members (role);

alter table public.team_members enable row level security;

-- Who looks after each merchant.
alter table public.vendor_applications
  add column if not exists assigned_to uuid
    references public.team_members (id) on delete set null;

create index if not exists vendor_applications_assigned_to_idx
  on public.vendor_applications (assigned_to);

-- Merchants added by hand in the dashboard are marked, so it is
-- always clear who applied and who was entered for them.
alter table public.vendor_applications
  add column if not exists added_by_admin boolean not null default false;

-- ------------------------------------------------------------
-- Marketers
--
-- Marketers are team members with the 'marketer' role. They
-- never sign in. The constraint is replaced rather than edited so
-- this runs cleanly on a database created before the role existed.
-- ------------------------------------------------------------
alter table public.team_members
  drop constraint if exists team_members_role_check;
alter table public.team_members
  add constraint team_members_role_check
  check (role in ('admin','coordinator','marketer'));

-- Their targets are counted from this date.
alter table public.team_members
  add column if not exists started_on date;

-- The marketer who works each merchant.
alter table public.vendor_applications
  add column if not exists marketer_id uuid
    references public.team_members (id) on delete set null;

create index if not exists vendor_applications_marketer_id_idx
  on public.vendor_applications (marketer_id);

-- The marketer who brought each business in, for their targets.
alter table public.procurement_requests
  add column if not exists marketer_id uuid
    references public.team_members (id) on delete set null;

create index if not exists procurement_requests_marketer_id_idx
  on public.procurement_requests (marketer_id);

-- ------------------------------------------------------------
-- The discount each merchant has agreed to
--
-- A range, as a percentage off their normal price: the least they
-- will always give, and the most they will go to for a big order.
-- ------------------------------------------------------------
alter table public.vendor_applications
  add column if not exists discount_min numeric(5,2),
  add column if not exists discount_max numeric(5,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vendor_applications_discount_check'
  ) then
    alter table public.vendor_applications
      add constraint vendor_applications_discount_check
      check (
        (discount_min is null or (discount_min >= 0 and discount_min <= 100)) and
        (discount_max is null or (discount_max >= 0 and discount_max <= 100)) and
        (discount_min is null or discount_max is null or discount_min <= discount_max)
      );
  end if;
end $$;

-- ------------------------------------------------------------
-- Editable documents
--
-- The marketer playbook and the merchant agreement template.
-- Edited in the dashboard; the site ships a sensible default and
-- uses it until you save your own.
-- ------------------------------------------------------------
create table if not exists public.app_documents (
  key         text primary key,
  title       text not null,
  body        text not null,
  meta        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

alter table public.app_documents enable row level security;

-- ------------------------------------------------------------
-- Merchant agreements (MOU) and their electronic signatures
--
-- Each row is frozen at the moment it is sent: the exact text the
-- merchant was shown, and a SHA-256 fingerprint of it. Signing
-- records who typed their name, when, from where, and checks the
-- fingerprint still matches — so nobody can quietly change the
-- words after they were agreed.
-- ------------------------------------------------------------
create table if not exists public.vendor_agreements (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),

  reference        text not null unique,

  -- kept even if the merchant is later deleted
  vendor_id        uuid references public.vendor_applications (id) on delete set null,
  vendor_company   text not null,
  vendor_contact   text not null,
  vendor_email     text not null,

  title            text not null,
  body             text not null,
  discount_min     numeric(5,2),
  discount_max     numeric(5,2),
  term_months      integer,
  document_hash    text not null,

  status           text not null default 'sent'
                     check (status in ('sent','signed','void')),
  sent_at          timestamptz,
  created_by       text,

  signed_at        timestamptz,
  signer_name      text,
  signer_title     text,
  signer_ip        text,
  signer_agent     text,

  voided_at        timestamptz
);

create index if not exists vendor_agreements_vendor_id_idx
  on public.vendor_agreements (vendor_id);
create index if not exists vendor_agreements_status_idx
  on public.vendor_agreements (status);

alter table public.vendor_agreements enable row level security;

-- ------------------------------------------------------------
-- A record of every email sent to a team member
-- ------------------------------------------------------------
create table if not exists public.team_emails (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  member_id   uuid references public.team_members (id) on delete cascade,
  to_email    text not null,
  subject     text not null,
  included    text[] not null default '{}',
  ok          boolean not null default true,
  error       text,
  sent_by     text
);

create index if not exists team_emails_member_id_idx
  on public.team_emails (member_id, created_at desc);

alter table public.team_emails enable row level security;
