import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const createCohortSchema = z.object({
  appId: z.string(),
  key: z.string(),
  name: z.string(),
  percentage: z.number().min(0).max(100),
  rules: z.array(z.any()).optional(),
  description: z.string().optional(),
});

// GET /api/cohorts - List all cohorts for an app
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');

    if (!appId) {
      return NextResponse.json({ error: 'appId is required' }, { status: 400 });
    }

    const cohorts = await prisma.cohort.findMany({
      where: { appId },
      orderBy: { name: 'asc' },
      include: {
        app: {
          select: { name: true, identifier: true }
        }
      }
    });

    return NextResponse.json(cohorts);
  } catch (error) {
    console.error('Error fetching cohorts:', error);
    return NextResponse.json({ error: 'Failed to fetch cohorts' }, { status: 500 });
  }
}

// POST /api/cohorts - Create a new cohort
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createCohortSchema.parse(body);

    // Check if cohort key already exists for this app
    const existingCohort = await prisma.cohort.findUnique({
      where: {
        appId_key: {
          appId: validatedData.appId,
          key: validatedData.key
        }
      }
    });

    if (existingCohort) {
      return NextResponse.json(
        { error: 'A cohort with this key already exists' },
        { status: 409 }
      );
    }

    // Generate a random salt for this cohort
    const salt = randomBytes(16).toString('hex');

    const cohort = await prisma.cohort.create({
      data: {
        ...validatedData,
        rules: validatedData.rules || [],
        salt
      },
      include: {
        app: {
          select: { name: true, identifier: true }
        }
      }
    });

    return NextResponse.json(cohort, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    
    console.error('Error creating cohort:', error);
    return NextResponse.json({ error: 'Failed to create cohort' }, { status: 500 });
  }
}