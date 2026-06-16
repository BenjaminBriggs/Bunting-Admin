# syntax=docker/dockerfile:1

# Shared base — Prisma needs openssl on Alpine.
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

# Install dependencies once, reuse for dev and build.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Development target — used by docker-compose for hot reload (source bind-mounted).
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production build — emits the standalone server.
FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN npx prisma generate && npm run build

# Production runtime — minimal, non-root.
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
# Next's tracer does not reliably bundle the Prisma engine; copy it explicitly.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
