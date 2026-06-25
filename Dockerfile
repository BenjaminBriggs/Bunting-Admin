# syntax=docker/dockerfile:1

# Shared base — Prisma needs openssl on Alpine; corepack provides pnpm (pinned via
# the "packageManager" field in package.json). Node 26 no longer bundles corepack,
# so install it explicitly before enabling.
FROM node:26-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
RUN npm install -g corepack@latest && corepack enable

# Install dependencies once, reuse for dev and build.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Development target — used by docker-compose for hot reload (source bind-mounted).
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
RUN pnpm exec prisma generate
EXPOSE 3000
CMD ["pnpm", "run", "dev"]

# Production build — emits the standalone server. `next build` traces the Prisma
# client and its query engine (.so) into .next/standalone/node_modules, preserving
# pnpm's store layout, so no manual staging of the engine is needed.
FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN pnpm exec prisma generate && pnpm run build

# Production runtime — minimal, non-root.
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build /app/public ./public
# The standalone bundle ships its own node_modules (incl. @prisma/client + the
# query engine); copy it wholesale and do not overlay a flattened Prisma tree on
# top, which would clash with the pnpm symlinks it already contains.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
