-- Seed admin + products + settings for local Postgres (lending)
-- Admin login: admin@lendsync.local / admin123
insert into public.profiles (id, email, full_name, role, password_hash, occupation, credit_score, kyc_status)
values (
  '00000000-0000-4000-8000-000000000001',
  'admin@lendsync.local',
  'Admin User',
  'admin',
  '$2b$10$ARWpcZ9dwIeiX/VedzxoiepR29f4BpJ2KAN2S/R49fdiBnhvAi0ra',
  'Super Admin',
  null,
  'verified'
)
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  password_hash = excluded.password_hash;

insert into public.profiles (id, email, full_name, role, occupation, credit_score, kyc_status)
values
  ('00000000-0000-4000-8000-000000000101', 'maria@example.com', 'Maria Santos', 'borrower', 'Business Owner', 720, 'verified'),
  ('00000000-0000-4000-8000-000000000102', 'david@example.com', 'David Torres', 'borrower', 'Real Estate Investor', 680, 'verified'),
  ('00000000-0000-4000-8000-000000000103', 'sofia@example.com', 'Sofia Mendez', 'borrower', 'Software Engineer', 745, 'pending'),
  ('00000000-0000-4000-8000-000000000201', 'james@lendsync.local', 'James Reyes', 'loan_officer', 'Loan Officer', null, 'verified')
on conflict (id) do nothing;

insert into public.loan_products (
  name, description, loan_type, interest_method, annual_rate_percent,
  min_amount_cents, max_amount_cents, min_tenure_months, max_tenure_months, grace_days, is_active
)
select * from (values
  ('Business Growth', 'Working capital for SMEs', 'business'::public.loan_type, 'reducing'::public.interest_method, 12.5, 1000000::bigint, 50000000::bigint, 6, 60, 5, true),
  ('Personal Flex', 'Unsecured personal loan', 'personal'::public.loan_type, 'reducing'::public.interest_method, 14.0, 50000::bigint, 10000000::bigint, 3, 36, 3, true),
  ('Home Equity Plus', 'Secured against property', 'home_equity'::public.loan_type, 'reducing'::public.interest_method, 9.5, 5000000::bigint, 100000000::bigint, 12, 120, 7, true),
  ('Auto Finance', 'Vehicle financing', 'auto'::public.loan_type, 'reducing'::public.interest_method, 11.0, 200000::bigint, 30000000::bigint, 12, 72, 5, true),
  ('Micro Boost', 'Microenterprise starter', 'micro'::public.loan_type, 'flat'::public.interest_method, 18.0, 10000::bigint, 500000::bigint, 3, 18, 0, true)
) as v(name, description, loan_type, interest_method, annual_rate_percent, min_amount_cents, max_amount_cents, min_tenure_months, max_tenure_months, grace_days, is_active)
where not exists (select 1 from public.loan_products limit 1);

insert into public.system_settings (key, value) values
  ('organization', '{"name":"LendSync","currency":"USD"}'::jsonb),
  ('security', '{"require2fa":false,"enforceTls":true,"autoBackups":true}'::jsonb),
  ('integrations', '{"stripe":{"enabled":true},"twilio":{"enabled":false},"experian":{"enabled":false},"docusign":{"enabled":false}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
