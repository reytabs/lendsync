-- Up Migration
-- Default organization_id to the active tenant (from app.current_org) so
-- existing INSERTs that don't name the column keep working under RLS. Inside a
-- withTenant transaction this resolves to the tenant; on the owner connection
-- it is NULL (writes there must set organization_id explicitly).

alter table public.profiles            alter column organization_id set default public.current_org_id();
alter table public.loan_products       alter column organization_id set default public.current_org_id();
alter table public.loan_applications   alter column organization_id set default public.current_org_id();
alter table public.loans               alter column organization_id set default public.current_org_id();
alter table public.borrower_documents  alter column organization_id set default public.current_org_id();
alter table public.disbursements       alter column organization_id set default public.current_org_id();
alter table public.repayment_schedules alter column organization_id set default public.current_org_id();
alter table public.repayments          alter column organization_id set default public.current_org_id();
alter table public.audit_logs          alter column organization_id set default public.current_org_id();
alter table public.notifications       alter column organization_id set default public.current_org_id();
alter table public.system_settings     alter column organization_id set default public.current_org_id();

-- Down Migration
alter table public.system_settings     alter column organization_id drop default;
alter table public.notifications        alter column organization_id drop default;
alter table public.audit_logs           alter column organization_id drop default;
alter table public.repayments           alter column organization_id drop default;
alter table public.repayment_schedules  alter column organization_id drop default;
alter table public.disbursements        alter column organization_id drop default;
alter table public.borrower_documents   alter column organization_id drop default;
alter table public.loans                alter column organization_id drop default;
alter table public.loan_applications    alter column organization_id drop default;
alter table public.loan_products        alter column organization_id drop default;
alter table public.profiles             alter column organization_id drop default;
