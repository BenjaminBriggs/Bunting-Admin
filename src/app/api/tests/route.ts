import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CreateTestRequest } from '@/types';

// GET /api/tests?appId=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('appId');

  if (!appId) {
    return NextResponse.json({ error: 'appId is required' }, { status: 400 });
  }

  try {
    const tests = await prisma.testRollout.findMany({
      where: {
        appId,
        type: 'TEST'
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(tests);
  } catch (error) {
    console.error('Error fetching tests:', error);
    return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 });
  }
}

// POST /api/tests
export async function POST(request: NextRequest) {
  try {
    const body: CreateTestRequest = await request.json();
    const { key, name, description, conditions, variantCount, trafficSplit, variantNames, appId } = body;

    // Validate traffic split adds up to 100
    const totalTraffic = trafficSplit.reduce((sum, percent) => sum + percent, 0);
    if (totalTraffic !== 100) {
      return NextResponse.json({ 
        error: 'Traffic split must add up to 100%' 
      }, { status: 400 });
    }

    // Validate variant count matches traffic split
    if (variantCount !== trafficSplit.length) {
      return NextResponse.json({
        error: 'Variant count must match traffic split array length'
      }, { status: 400 });
    }

    // Validate variant names array length
    if (!variantNames || variantNames.length !== variantCount) {
      return NextResponse.json({
        error: 'Variant names array must match variant count'
      }, { status: 400 });
    }

    // Validate variant names are not empty
    if (variantNames.some(name => !name || name.trim().length === 0)) {
      return NextResponse.json({
        error: 'All variant names must be non-empty'
      }, { status: 400 });
    }

    // Generate salt for consistent user bucketing
    const salt = Math.random().toString(36).substring(2, 15);

    // Create variants object with default null values for each environment
    const variants: Record<string, any> = {};
    variantNames.forEach((variantName, index) => {
      variants[variantName] = {
        percentage: trafficSplit[index],
        values: {
          development: null,
          staging: null,
          production: null
        }
      };
    });

    const test = await prisma.testRollout.create({
      data: {
        key,
        name,
        description,
        type: 'TEST',
        salt,
        conditions: conditions as any,
        variants,
        flagIds: [], // Will be populated when flags are assigned to this test
        appId
      }
    });

    return NextResponse.json(test, { status: 201 });
  } catch (error) {
    console.error('Error creating test:', error);
    return NextResponse.json({ error: 'Failed to create test' }, { status: 500 });
  }
}