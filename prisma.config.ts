import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer auto-loads .env or auto-discovers the schema; declare both
// here. `dotenv/config` (imported above) populates process.env for CLI commands.
// Read DATABASE_URL directly (not via the throwing `env()` helper) so that
// `prisma generate` works at build time without a database — only the
// connecting commands (migrate/db) actually need a real URL.
export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations',
	},
	datasource: {
		url: process.env.DATABASE_URL ?? '',
	},
});
