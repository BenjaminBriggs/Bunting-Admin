import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const getHistorySchema = z.object({
  appId: z.string(),
  limit: z.number().optional().default(10),
});

export interface PublishHistoryItem {
  id: string;
  version: string;
  publishedAt: string;
  publishedBy: string;
  changelog: string;
  flagCount: number;
  cohortCount: number;
  changes?: Array<{
    type: 'flag' | 'cohort';
    action: 'added' | 'modified' | 'removed';
    key: string;
    name: string;
  }>;
}

// POST /api/config/history - Get publish history for an app
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, limit } = getHistorySchema.parse(body);

    // Query audit logs for publish history
    const auditLogs = await prisma.auditLog.findMany({
      where: { appId },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        configVersion: true,
        publishedAt: true,
        publishedBy: true,
        changelog: true,
        configDiff: true,
      }
    });

    // Transform audit logs to PublishHistoryItem format
    const history: PublishHistoryItem[] = auditLogs.map((log) => {
      const diff = log.configDiff as any;
      
      // Extract changes from configDiff
      const changes: PublishHistoryItem['changes'] = [];
      
      if (diff && diff.changes) {
        for (const change of diff.changes) {
          changes.push({
            type: change.type || 'flag',
            action: change.action || 'modified',
            key: change.key || '',
            name: change.name || change.key || '',
          });
        }
      }
      
      // Count flags and cohorts from diff or set defaults
      const flagCount = diff?.flagCount || 0;
      const cohortCount = diff?.cohortCount || 0;
      
      return {
        id: log.id,
        version: log.configVersion,
        publishedAt: log.publishedAt.toISOString(),
        publishedBy: log.publishedBy || 'System',
        changelog: log.changelog || '',
        flagCount,
        cohortCount,
        changes: changes.length > 0 ? changes : undefined,
      };
    });

    return NextResponse.json(history);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 });
    }
    
    console.error('Error fetching publish history:', error);
    return NextResponse.json({ error: 'Failed to fetch publish history' }, { status: 500 });
  }
}