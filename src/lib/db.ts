import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

// Prisma 7 requires a driver adapter for the connection; the URL is no longer
// read from the schema. `pg` pools the Postgres connection.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
export const db = prisma; // Export as 'db' for compatibility

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}
