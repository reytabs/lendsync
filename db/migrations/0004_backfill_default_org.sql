-- Up Migration
-- Create a default organization and attach all existing data to it so the
-- system stays functional during the transition to multi-tenancy.

insert into public.organizations (id, name, slug, currency, status)
values (
  '00000000-0000-4000-8000-0000000000aa',
  'Default Organization',
  'default',
  coalesce(
    (select (value->>0) from public.system_settings where key = 'currency' limit 1),
    'USD'
  ),
  'active'
)
on conflict (id) do nothing;

update public.profiles            set organization_id = '00000000-0000-4000-8000-0000000000aa' where organization_id is null;
update public.loan_products       set organization_id = '00000000-0000-4000-8000-0000000000aa' where organization_id is null;
update public.loan_applications   set organization_id = '00000000-0000-4000-8000-0000000000aa' where organization_id is null;
update public.loans               set organization_id = '00000000-0000-4000-8000-0000000000aa' where organization_id is null;
update public.borrower_documents  set organization_id = '00000000-0000-4000-8000-0000000000aa' where organization_id is null;
update public.disbursements       set organization_id = '00000000-0000-4000-8000-0000000000aa' where organization_id is null;
update public.repayment_schedules set organization_id = '00000000-0000-4000-8000-0000000000aa' where organization_id is null;
update public.repayments          set organization_id = '00000000-0000-4000-8000-0000000000aa' where organization_id is null;
update public.audit_logs          set organization_id = '00000000-0000-4000-8000-0000000000aa' where organization_id is null;
update public.notifications       set organization_id = '00000000-0000-4000-8000-0000000000aa' where organization_id is null;
update public.system_settings     set organization_id = '00000000-0000-4000-8000-0000000000aa' where organization_id is null;

-- Existing staff (admins/officers) become members of the default org.
insert into public.memberships (organization_id, profile_id, role)
select
  '00000000-0000-4000-8000-0000000000aa',
  id,
  case when role = 'admin' then 'admin'::public.org_role else 'officer'::public.org_role end
from public.profiles
where role in ('admin', 'loan_officer')
on conflict (organization_id, profile_id) do nothing;

-- Give the default org a trialing subscription on the Growth plan.
insert into public.subscriptions (organization_id, plan_code, status)
values ('00000000-0000-4000-8000-0000000000aa', 'growth', 'active')
on conflict (organization_id) do nothing;

-- Down Migration
delete from public.subscriptions where organization_id = '00000000-0000-4000-8000-0000000000aa';
delete from public.memberships where organization_id = '00000000-0000-4000-8000-0000000000aa';
-- Note: organization_id columns are left populated; the 0003 down migration drops them.
