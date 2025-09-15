import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/test-rollouts?appId=xxx&flagId=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('appId');
  const flagId = searchParams.get('flagId');

  if (!appId) {
    return NextResponse.json({ error: 'appId is required' }, { status: 400 });
  }

  try {
    const whereClause: any = {
      appId,
      archived: false
    };

    // If flagId is provided, filter to tests/rollouts that include this flag
    if (flagId) {
      whereClause.flagIds = {
        array_contains: flagId
      };
      console.log('Filtering test-rollouts by flagId:', flagId);
    }

    const testRollouts = await prisma.testRollout.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${testRollouts.length} test-rollouts for appId: ${appId}, flagId: ${flagId || 'all'}`);

    return NextResponse.json(testRollouts);
  } catch (error) {
    console.error('Error fetching test rollouts:', error);
    return NextResponse.json({ error: 'Failed to fetch test rollouts' }, { status: 500 });
  }
}

// POST /api/test-rollouts (for createTestRollout function)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, name, description, type, variants, percentage, conditions, flagIds } = body;

    // Generate salt for consistent user bucketing
    const salt = Math.random().toString(36).substring(2, 15);

    // Generate key from name
    const key = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/^[^a-z]/g, `${type.toLowerCase()}_`)
      .substring(0, 50);

    const data: any = {
      key,
      name,
      description,
      type,
      salt,
      conditions: conditions || [],
      flagIds: flagIds || [],
      appId
    };

    if (type === 'TEST') {
      data.variants = variants;
    } else if (type === 'ROLLOUT') {
      data.percentage = percentage;
      data.rolloutValues = {
        development: null,
        staging: null,
        production: null
      };
    }

    const testRollout = await prisma.testRollout.create({
      data
    });

    return NextResponse.json(testRollout, { status: 201 });
  } catch (error) {
    console.error('Error creating test/rollout:', error);
    return NextResponse.json({ error: 'Failed to create test/rollout' }, { status: 500 });
  }
}