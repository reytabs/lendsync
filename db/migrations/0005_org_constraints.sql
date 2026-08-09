-- Up Migration
-- Enforce tenant integrity now that data is backfilled.

alter table public.profiles            alter column organization_id set not null;
alter table public.loan_products       alter column organization_id set not null;
alter table public.loan_applications   alter column organization_id set not null;
alter table public.loans               alter column organization_id set not null;
alter table public.borrower_documents  alter column organization_id set not null;
alter table public.disbursements       alter column organization_id set not null;
alter table public.repayment_schedules alter column organization_id set not null;
alter table public.repayments          alter column organization_id set not null;
alter table public.audit_logs          alter column organization_id set not null;
alter table public.notifications       alter column organization_id set not null;
alter table public.system_settings     alter column organization_id set not null;

-- Email is now unique per-organization, not globally.
alter table public.profiles drop constraint if exists profiles_email_key;
create unique index if not exists profiles_org_email_key
  on public.profiles (organization_id, lower(email));

-- system_settings become per-tenant keyed.
alter table public.system_settings drop constraint if exists system_settings_pkey;
alter table public.system_settings add primary key (organization_id, key);

-- Hot-path indexes scoped by tenant.
create index if not exists profiles_org_idx            on public.profiles (organization_id);
create index if not exists loan_products_org_idx       on public.loan_products (organization_id);
create index if not exists loan_applications_org_idx   on public.loan_applications (organization_id, status);
create index if not exists loans_org_idx               on public.loans (organization_id, borrower_id);
create index if not exists repayment_schedules_org_idx on public.repayment_schedules (organization_id, due_date, status);
create index if not exists notifications_org_user_idx  on public.notifications (organization_id, user_id, created_at desc);

-- Down Migration
drop index if exists public.notifications_org_user_idx;
drop index if exists public.repayment_schedules_org_idx;
drop index if exists public.loans_org_idx;
drop index if exists public.loan_applications_org_idx;
drop index if exists public.loan_products_org_idx;
drop index if exists public.profiles_org_idx;

alter table public.system_settings drop constraint if exists system_settings_pkey;
alter table public.system_settings add primary key (key);

drop index if exists public.profiles_org_email_key;
alter table public.profiles add constraint profiles_email_key unique (email);

alter table public.system_settings     alter column organization_id drop not null;
alter table public.notifications        alter column organization_id drop not null;
alter table public.audit_logs           alter column organization_id drop not null;
alter table public.repayments           alter column organization_id drop not null;
alter table public.repayment_schedules  alter column organization_id drop not null;
alter table public.disbursements        alter column organization_id drop not null;
alter table public.borrower_documents   alter column organization_id drop not null;
alter table public.loans                alter column organization_id drop not null;
alter table public.loan_applications    alter column organization_id drop not null;
alter table public.loan_products        alter column organization_id drop not null;
alter table public.profiles             alter column organization_id drop not null;
