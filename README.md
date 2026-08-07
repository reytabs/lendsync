# LendSync (LMS)

Full-stack Lending Management System with a dark-theme **LendSync** console.

## Stack

- **Web:** Next.js 15 + Tailwind + shadcn-style components (Fraunces + DM Mono)
- **API:** NestJS REST (`/api`)
- **Database:** Local PostgreSQL (`lending`)
- **Auth:** JWT (bcrypt passwords) + optional `ALLOW_DEV_AUTH` demo token
- **Payments:** Stripe (simulated when keys absent)

## Monorepo

```
apps/web       → LendSync UI (6 pages)
apps/backend   → NestJS API
packages/types → Shared TypeScript types
packages/utils → EMI calculator + money helpers
db/            → Postgres schema + seed
```

## Quick start

```bash
# Install toolchain
corepack enable || npm i -g pnpm@9.15.0
pnpm install

# Create DB (once)
createdb lending

# Schema + seed
export DATABASE_URL=postgresql://$USER@localhost:5432/lending
pnpm db:push
pnpm db:seed

# Env
cp apps/web/.env.local.example apps/web/.env.local
cp apps/backend/.env.example apps/backend/.env
# Set DATABASE_URL in apps/backend/.env

# Build shared packages
pnpm --filter @lms/types build
pnpm --filter @lms/utils build

# Run
pnpm --filter @lms/backend dev   # :4000
pnpm --filter @lms/web dev       # :3000
```

Open [http://localhost:3000/login](http://localhost:3000/login)

- **Staff console:** `admin@lendsync.local` / `admin123` → `/dashboard`
- **Borrower portal:** `maria@example.com` / `borrower123` → `/portal`

Borrowers are staff-created only (Borrowers → New borrower). Portal features: apply, track loans, view EMI schedule (read-only), documents, profile.

## Design

UI follows the Figma Make prototype: https://salty-trick-85813986.figma.site/

- Ground `#0A0B0E`, primary `#D4A53C`
- Pages: Dashboard, Loan Applications, Borrowers, EMI Calculator, Reports, Admin

## Database

```bash
export DATABASE_URL=postgresql://$USER@localhost:5432/lending
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed.sql
```

## Docker (API)

```bash
# From monorepo root (build context must include packages/)
docker build -f apps/backend/Dockerfile -t lendsync-api .
docker run --rm -p 4000:4000 --env-file apps/backend/.env lendsync-api
```

## Deploy (Railway API)

1. Create a Railway service from this GitHub repo.
2. **Root Directory:** leave empty (monorepo root). Do **not** use `apps/backend`.
3. Use the included [`railway.toml`](railway.toml) — build runs `pnpm run build:backend` (builds `@lms/types` + `@lms/utils` then Nest).
4. Variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (your Vercel URL), `PORT` (Railway sets this; Nest should read `process.env.PORT`).
5. Redeploy after pushing `railway.toml`.

If you previously set Custom Build Command to only `pnpm --filter @lms/backend build`, remove it — that skips workspace packages and fails with `Cannot find module '@lms/utils'`.

## API docs

Swagger: http://localhost:4000/api/docs
