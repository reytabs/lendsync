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

- Demo: any email + demo button uses `dev-admin-token` when `ALLOW_DEV_AUTH=true`
- Real login: `admin@lendsync.local` / `admin123`

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
cd apps/backend
docker compose up --build
```

## API docs

Swagger: http://localhost:4000/api/docs
