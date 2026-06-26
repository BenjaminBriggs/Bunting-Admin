# syntax=docker/dockerfile:1

# Shared base — Prisma needs openssl on Alpine; corepack provides pnpm (pinned via
# the "packageManager" field in package.json). Node 26 no longer bundles corepack,
# so install it explicitly before enabling.
FROM node:26-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
RUN npm install -g corepack@latest && corepack enable

# Install dependencies once, reuse for dev and build. Skip lifecycle scripts:
# the `postinstall` hook runs `prisma generate`, which needs the schema (not
# copied yet at this stage). The dev/build stages run `prisma generate`
# explicitly after copying the source.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Development target — used by docker-compose for hot reload (source bind-mounted).
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
RUN pnpm exec prisma generate
EXPOSE 3000
CMD ["pnpm", "run", "dev"]

# Production build — emits the standalone server. The Prisma 7 client is
# generated into src/generated/prisma and traced into .next/standalone by
# `next build`; queries run through the pg driver adapter, so there is no native
# query engine to stage.
FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN pnpm exec prisma generate && pnpm run build

# Production runtime — minimal, non-root.
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
# Isolated migration toolchain in /migrate. The prisma CLI and dotenv are devDeps
# omitted from the standalone trace, and npm's flat layout cannot be merged into
# the standalone's pnpm-symlinked node_modules (file/dir + symlink conflicts), so
# keep them in their own directory. prisma.config.ts + the schema/migrations are
# copied here too; the entrypoint runs `prisma migrate deploy` from /migrate.
WORKDIR /migrate
RUN npm install --no-save --no-package-lock prisma@7.8.0 dotenv@17.4.2 \
	&& npm cache clean --force
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./

# Application runtime — the minimal standalone bundle.
WORKDIR /app
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R nextjs:nodejs /app /migrate
USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
