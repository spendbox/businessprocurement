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
  attachment_note text,

  -- when and where
  urgency         text not null,
  needed_by       date,
  city            text not null,
  region          text not null,
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
