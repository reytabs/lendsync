-- Up Migration
-- Row-Level Security. Enforcement runs under a dedicated NOBYPASSRLS role
-- (lms_tenant) that the backend switches into per request via withTenant().
-- The app's owner/superuser connection is unaffected, so existing queries keep
-- working during the incremental cutover.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'lms_tenant') then
    create role lms_tenant nologin nobypassrls;
  end if;
end $$;

grant usage on schema public to lms_tenant;
grant select, insert, update, delete on all tables in schema public to lms_tenant;
alter default privileges in schema public
  grant select, insert, update, delete on tables to lms_tenant;

-- Platform-only tables are off-limits to tenant sessions.
revoke all on public.platform_admins from lms_tenant;

-- Resolve the active tenant from a per-transaction GUC. Returns NULL when unset
-- so policies default-deny.
create or replace function public.current_org_id() returns uuid
  language sql stable as $$
  select nullif(current_setting('app.current_org', true), '')::uuid
$$;

-- Apply RLS to every tenant-scoped table. FORCE makes it apply to the table
-- owner too, so only sessions that set app.current_org can read/write.
do $$
declare
  t text;
  tenant_tables text[] := array[
    'profiles', 'loan_products', 'loan_applications', 'loans',
    'borrower_documents', 'disbursements', 'repayment_schedules',
    'repayments', 'audit_logs', 'notifications', 'system_settings',
    'memberships', 'subscriptions'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format(
      'create policy tenant_isolation on public.%I
         using (organization_id = public.current_org_id())
         with check (organization_id = public.current_org_id())', t);
  end loop;

  -- organizations keys on id, not organization_id.
  execute 'alter table public.organizations enable row level security';
  execute 'alter table public.organizations force row level security';
  execute 'drop policy if exists tenant_isolation on public.organizations';
  execute 'create policy tenant_isolation on public.organizations
             using (id = public.current_org_id())
             with check (id = public.current_org_id())';
end $$;

-- plans is a global catalogue: readable by any tenant session, no RLS.
grant select on public.plans to lms_tenant;

-- Down Migration
do $$
declare
  t text;
  tenant_tables text[] := array[
    'profiles', 'loan_products', 'loan_applications', 'loans',
    'borrower_documents', 'disbursements', 'repayment_schedules',
    'repayments', 'audit_logs', 'notifications', 'system_settings',
    'memberships', 'subscriptions', 'organizations'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format('alter table public.%I no force row level security', t);
    execute format('alter table public.%I disable row level security', t);
  end loop;
end $$;

drop function if exists public.current_org_id();

-- Role is intentionally left in place (may own granted privileges); drop
-- manually with: drop owned by lms_tenant; drop role lms_tenant;
