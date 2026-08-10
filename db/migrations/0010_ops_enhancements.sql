-- Up Migration
-- Ops enhancements: password change flag, finer roles, collections fields

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- Extend app roles (staff viewer / collections agent)
do $$ begin
  alter type public.user_role add value if not exists 'viewer';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.user_role add value if not exists 'collector';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.org_role add value if not exists 'viewer';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.org_role add value if not exists 'collector';
exception when duplicate_object then null;
end $$;

alter table public.repayment_schedules
  add column if not exists collector_id uuid references public.profiles (id) on delete set null;

alter table public.repayment_schedules
  add column if not exists promise_to_pay_date date;

create table if not exists public.collection_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade
    default public.current_org_id(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  schedule_id uuid references public.repayment_schedules (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  channel text not null default 'other'
    check (channel in ('call', 'sms', 'email', 'visit', 'other')),
  note text not null,
  promise_to_pay_date date,
  created_at timestamptz not null default now()
);

create index if not exists collection_notes_org_idx
  on public.collection_notes (organization_id, created_at desc);
create index if not exists collection_notes_loan_idx
  on public.collection_notes (loan_id, created_at desc);
create index if not exists collection_notes_schedule_idx
  on public.collection_notes (schedule_id, created_at desc);
create index if not exists repayment_schedules_collector_idx
  on public.repayment_schedules (collector_id)
  where collector_id is not null;

-- RLS for collection_notes (same tenant pattern as other tables)
do $$ begin
  alter table public.collection_notes enable row level security;
  alter table public.collection_notes no force row level security;
  drop policy if exists tenant_isolation on public.collection_notes;
  create policy tenant_isolation on public.collection_notes
    using (organization_id = public.current_org_id())
    with check (organization_id = public.current_org_id());
exception when others then null;
end $$;

grant select, insert, update, delete on public.collection_notes to lms_tenant;

-- Down Migration
drop policy if exists tenant_isolation on public.collection_notes;
drop table if exists public.collection_notes;
drop index if exists public.repayment_schedules_collector_idx;
alter table public.repayment_schedules drop column if exists promise_to_pay_date;
alter table public.repayment_schedules drop column if exists collector_id;
alter table public.profiles drop column if exists must_change_password;
-- Enum values cannot be removed safely; leave viewer/collector in place.
