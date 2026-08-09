-- Up Migration
-- Add a nullable organization_id to every tenant-scoped table. Kept nullable
-- here so the migration is non-breaking; backfilled in 0004 and enforced in 0005.

alter table public.profiles            add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.loan_products       add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.loan_applications   add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.loans               add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.borrower_documents  add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.disbursements       add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.repayment_schedules add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.repayments          add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.audit_logs          add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.notifications       add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.system_settings     add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

-- Down Migration
alter table public.system_settings     drop column if exists organization_id;
alter table public.notifications        drop column if exists organization_id;
alter table public.audit_logs           drop column if exists organization_id;
alter table public.repayments           drop column if exists organization_id;
alter table public.repayment_schedules  drop column if exists organization_id;
alter table public.disbursements        drop column if exists organization_id;
alter table public.borrower_documents   drop column if exists organization_id;
alter table public.loans                drop column if exists organization_id;
alter table public.loan_applications    drop column if exists organization_id;
alter table public.loan_products        drop column if exists organization_id;
alter table public.profiles             drop column if exists organization_id;
