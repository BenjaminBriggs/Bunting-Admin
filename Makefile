.PHONY: help install setup dev build start lint format type-check test test-unit test-integration test-e2e smoke db-generate db-migrate clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	pnpm install --frozen-lockfile

setup: ## Start local services (Postgres, MinIO, OIDC) and push the schema
	pnpm run setup

dev: ## Start the dev server
	pnpm run dev

build: ## Production build
	pnpm run build

start: ## Start the production server
	pnpm run start

lint: ## Lint with ESLint
	pnpm run lint

format: ## Check formatting with Prettier
	pnpm run format

type-check: ## Type-check with tsc
	pnpm run type-check

test: ## Run all tests
	pnpm test

test-unit: ## Run unit tests
	pnpm run test:unit

test-integration: ## Run integration tests
	pnpm run test:integration

test-e2e: ## Run Playwright e2e tests
	pnpm run test:e2e

smoke: ## Full-stack smoke: fresh stack → login → app → flags → publish → teardown
	./scripts/smoke.sh

db-generate: ## Regenerate the Prisma client
	pnpm run db:generate

db-migrate: ## Run database migrations
	pnpm run db:migrate

clean: ## Remove build output and caches
	pnpm exec rimraf .next coverage node_modules
