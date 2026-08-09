-- Up Migration
-- Billing: subscription plans (tiered) and per-organization subscriptions.

create table if not exists public.plans (
  code text primary key,                       -- 'starter' | 'growth' | 'scale'
  name text not null,
  stripe_price_id text,                         -- nullable until Stripe is wired
  price_cents bigint not null default 0,
  interval text not null default 'month',       -- 'month' | 'year'
  limits jsonb not null default '{}'::jsonb,     -- {"seats":3,"active_loans":50,"features":[...]}
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_code text references public.plans (code),
  status public.subscription_status not null default 'trialing',
  current_period_end timestamptz,
  cancel_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Seed the initial tiered catalogue. Stripe price IDs are filled in later.
insert into public.plans (code, name, price_cents, limits, sort_order)
values
  ('starter', 'Starter', 4900,
    '{"seats":3,"active_loans":50,"features":["core"]}'::jsonb, 1),
  ('growth', 'Growth', 14900,
    '{"seats":10,"active_loans":500,"features":["core","reports","notifications"]}'::jsonb, 2),
  ('scale', 'Scale', 49900,
    '{"seats":-1,"active_loans":5000,"features":["core","reports","notifications","api_access","priority_support"]}'::jsonb, 3)
on conflict (code) do nothing;

-- Down Migration
drop table if exists public.subscriptions;
drop table if exists public.plans;
