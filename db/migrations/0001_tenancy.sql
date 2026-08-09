-- Up Migration
-- Multi-tenancy foundation: organizations, memberships, platform admins.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.org_role as enum ('owner', 'admin', 'officer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum (
    'trialing', 'active', 'past_due', 'canceled', 'incomplete'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  currency text not null default 'USD',
  status text not null default 'active',
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Links a profile (user) to an organization with an org-scoped role. A single
-- profile may belong to multiple organizations (org switcher).
create table if not exists public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'officer',
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create index if not exists memberships_profile_idx
  on public.memberships (profile_id);

-- Platform operators (you) — global, not tied to any single tenant.
create table if not exists public.platform_admins (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Down Migration
drop table if exists public.platform_admins;
drop table if exists public.memberships;
drop table if exists public.organizations;
drop type if exists public.subscription_status;
drop type if exists public.org_role;
