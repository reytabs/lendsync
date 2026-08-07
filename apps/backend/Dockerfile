# Build from monorepo root (Railway Dockerfile path: apps/backend/Dockerfile
# with context = repository root). Prefer railway.toml + Nixpacks unless you
# explicitly switch the service to Dockerfile builder.

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
RUN pnpm install --filter @lms/backend... --frozen-lockfile || pnpm install --filter @lms/backend...

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/backend apps/backend
RUN pnpm run build:backend

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=build /app /app
EXPOSE 4000
CMD ["pnpm", "--filter", "@lms/backend", "start"]
