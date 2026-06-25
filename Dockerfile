# syntax=docker/dockerfile:1

# Shared base — Prisma needs openssl on Alpine; corepack provides pnpm (pinned via
# the "packageManager" field in package.json).
FROM node:26-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable

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

# Production build — emits the standalone server. Stage the Prisma client/engine into
# a real directory (cp -L dereferences pnpm's symlinked store) for the runner to copy.
FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN pnpm exec prisma generate && pnpm run build && \
	mkdir -p /prisma-runtime/.prisma /prisma-runtime/@prisma && \
	cp -rL node_modules/.prisma/client /prisma-runtime/.prisma/client && \
	cp -rL node_modules/@prisma/client /prisma-runtime/@prisma/client

# Production runtime — minimal, non-root.
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
# Next's tracer does not reliably bundle the Prisma engine; copy it explicitly
# (dereferenced from pnpm's store in the build stage above).
COPY --from=build /prisma-runtime/.prisma ./node_modules/.prisma
COPY --from=build /prisma-runtime/@prisma ./node_modules/@prisma
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
