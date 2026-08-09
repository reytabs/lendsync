-- Up Migration
-- Make RLS work on managed Postgres (e.g. Neon) where the app connects as a
-- non-superuser role that owns the tables.
--
-- 0006 used FORCE ROW LEVEL SECURITY, which applies RLS even to the owner. That
-- breaks bootstrap/auth paths that legitimately need cross-tenant access before
-- any tenant is known (signup creating an org, login looking up a user by
-- email). The correct pattern:
--   * Base app role (the connection role) BYPASSES RLS  -> auth/bootstrap work.
--   * Tenant queries SET ROLE lms_tenant (a non-owner role) -> RLS is enforced.
--
-- So here we (a) let the connection role assume lms_tenant, and (b) drop FORCE
-- so the owner is exempt while lms_tenant (non-owner) still has RLS applied.

-- Allow the current connection role (the one running migrations / the app) to
-- SET ROLE lms_tenant. Safe to re-run.
grant lms_tenant to current_user;

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
    -- RLS stays ENABLED (applies to non-owner roles like lms_tenant), but not
    -- FORCEd (so the owner/bootstrap role is exempt).
    execute format('alter table public.%I no force row level security', t);
  end loop;
end $$;

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
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

revoke lms_tenant from current_user;
