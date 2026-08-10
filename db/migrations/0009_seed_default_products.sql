-- Up Migration
-- Backfill the starter loan-product catalogue for any organization that has
-- none yet (e.g. workspaces created via signup before products were seeded).
-- Idempotent: skips orgs that already have at least one product.

insert into public.loan_products (
  organization_id, name, description, loan_type, interest_method,
  annual_rate_percent, min_amount_cents, max_amount_cents,
  min_tenure_months, max_tenure_months, grace_days, is_active
)
select o.id, v.*
from public.organizations o
cross join (values
  ('Business Growth', 'Working capital for SMEs', 'business'::public.loan_type, 'reducing'::public.interest_method, 12.5, 1000000::bigint, 50000000::bigint, 6, 60, 5, true),
  ('Personal Flex', 'Unsecured personal loan', 'personal'::public.loan_type, 'reducing'::public.interest_method, 14.0, 50000::bigint, 10000000::bigint, 3, 36, 3, true),
  ('Home Equity Plus', 'Secured against property', 'home_equity'::public.loan_type, 'reducing'::public.interest_method, 9.5, 5000000::bigint, 100000000::bigint, 12, 120, 7, true),
  ('Auto Finance', 'Vehicle financing', 'auto'::public.loan_type, 'reducing'::public.interest_method, 11.0, 200000::bigint, 30000000::bigint, 12, 72, 5, true),
  ('Micro Boost', 'Microenterprise starter', 'micro'::public.loan_type, 'flat'::public.interest_method, 18.0, 10000::bigint, 500000::bigint, 3, 18, 0, true)
) as v(name, description, loan_type, interest_method, annual_rate_percent, min_amount_cents, max_amount_cents, min_tenure_months, max_tenure_months, grace_days, is_active)
where not exists (
  select 1 from public.loan_products lp where lp.organization_id = o.id
);

-- Down Migration
-- Intentionally empty: do not delete products that may already be in use by
-- applications/loans. Revert by deleting specific seed rows manually if needed.
