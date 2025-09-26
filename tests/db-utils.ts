import { prisma } from '@/lib/db';

const orderedDeletions = [
  () => prisma.accessList.deleteMany(),
  () => prisma.user.deleteMany(),
  () => prisma.auditLog.deleteMany(),
  () => prisma.publication.deleteMany(),
  () => prisma.signingKey.deleteMany(),
  () => prisma.rule.deleteMany(),
  () => prisma.testRollout.deleteMany(),
  () => prisma.flag.deleteMany(),
  () => prisma.cohort.deleteMany(),
  () => prisma.app.deleteMany(),
];

export async function truncateAll() {
  if (!process.env.DATABASE_URL) {
    return;
  }

  await prisma.$transaction(orderedDeletions.map((fn) => fn()));
}
