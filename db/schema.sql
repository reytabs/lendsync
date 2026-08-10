-- LendSync schema for local Postgres (database: lending)
create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('borrower', 'loan_officer', 'admin', 'viewer', 'collector');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loan_status as enum (
    'draft', 'submitted', 'under_review', 'approved', 'rejected',
    'disbursed', 'active', 'completed', 'defaulted', 'closed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loan_type as enum ('business', 'personal', 'home_equity', 'auto', 'micro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.interest_method as enum ('reducing', 'flat');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_type as enum ('government_id', 'proof_of_income', 'collateral', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_status as enum ('pending', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.schedule_status as enum ('upcoming', 'paid', 'overdue', 'partial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.disbursement_status as enum ('pending', 'processing', 'succeeded', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.kyc_status as enum ('unverified', 'pending', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  phone text,
  password_hash text,
  role public.user_role not null default 'borrower',
  occupation text,
  credit_score integer check (credit_score is null or (credit_score >= 300 and credit_score <= 850)),
  kyc_status public.kyc_status not null default 'unverified',
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loan_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  loan_type public.loan_type not null,
  interest_method public.interest_method not null default 'reducing',
  annual_rate_percent numeric(6,3) not null,
  min_amount_cents bigint not null,
  max_amount_cents bigint not null,
  min_tenure_months integer not null,
  max_tenure_months integer not null,
  grace_days integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.profiles (id),
  product_id uuid not null references public.loan_products (id),
  loan_type public.loan_type not null,
  principal_cents bigint not null check (principal_cents > 0),
  tenure_months integer not null check (tenure_months > 0),
  annual_rate_percent numeric(6,3) not null,
  purpose text,
  status public.loan_status not null default 'draft',
  officer_id uuid references public.profiles (id),
  decision_notes text,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.loan_applications (id),
  borrower_id uuid not null references public.profiles (id),
  product_id uuid not null references public.loan_products (id),
  loan_type public.loan_type not null,
  principal_cents bigint not null,
  tenure_months integer not null,
  annual_rate_percent numeric(6,3) not null,
  interest_method public.interest_method not null default 'reducing',
  status public.loan_status not null default 'approved',
  officer_id uuid references public.profiles (id),
  disbursed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.borrower_documents (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.profiles (id),
  application_id uuid references public.loan_applications (id),
  doc_type public.document_type not null,
  storage_path text not null,
  status public.document_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.disbursements (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id),
  amount_cents bigint not null,
  status public.disbursement_status not null default 'pending',
  stripe_transfer_id text,
  initiated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.repayment_schedules (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  installment_no integer not null,
  due_date date not null,
  principal_cents bigint not null,
  interest_cents bigint not null,
  total_cents bigint not null,
  status public.schedule_status not null default 'upcoming',
  collector_id uuid references public.profiles (id) on delete set null,
  promise_to_pay_date date,
  unique (loan_id, installment_no)
);

create table if not exists public.repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id),
  schedule_id uuid references public.repayment_schedules (id),
  amount_cents bigint not null,
  stripe_payment_intent_id text,
  recorded_by uuid references public.profiles (id),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.collection_notes (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  schedule_id uuid references public.repayment_schedules (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  channel text not null default 'other'
    check (channel in ('call', 'sms', 'email', 'visit', 'other')),
  note text not null,
  promise_to_pay_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$ begin
  create type public.notification_kind as enum (
    'loan_submitted', 'loan_approved', 'loan_rejected',
    'loan_disbursed', 'payment_recorded', 'emi_overdue', 'emi_due_soon'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text not null,
  href text,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists loan_applications_status_idx on public.loan_applications (status);
create index if not exists loans_borrower_idx on public.loans (borrower_id);
create index if not exists repayment_schedules_due_idx on public.repayment_schedules (due_date, status);
