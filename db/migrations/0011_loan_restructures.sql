-- Up Migration
-- Loan restructuring history + early settlement audit trail

create table if not exists public.loan_restructures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade
    default public.current_org_id(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  kind text not null
    check (kind in ('early_settlement', 'tenure_change', 'payment_holiday', 'rate_change')),
  actor_id uuid references public.profiles (id) on delete set null,
  notes text,
  before_tenure_months integer,
  after_tenure_months integer,
  before_annual_rate_percent numeric(6,3),
  after_annual_rate_percent numeric(6,3),
  holiday_months integer,
  outstanding_principal_cents bigint,
  outstanding_interest_cents bigint,
  settlement_amount_cents bigint,
  waived_interest_cents bigint not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists loan_restructures_loan_idx
  on public.loan_restructures (loan_id, created_at desc);
create index if not exists loan_restructures_org_idx
  on public.loan_restructures (organization_id, created_at desc);

do $$ begin
  alter table public.loan_restructures enable row level security;
  alter table public.loan_restructures force row level security;
  drop policy if exists tenant_isolation on public.loan_restructures;
  create policy tenant_isolation on public.loan_restructures
    using (organization_id = public.current_org_id())
    with check (organization_id = public.current_org_id());
exception when others then null;
end $$;

grant select, insert, update, delete on public.loan_restructures to lms_tenant;

-- Down Migration
drop policy if exists tenant_isolation on public.loan_restructures;
drop table if exists public.loan_restructures;
