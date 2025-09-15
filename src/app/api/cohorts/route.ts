import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CreateCohortRequest } from '@/types';

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

// POST /api/cohorts - Create a new cohort (condition group)
export async function POST(request: NextRequest) {
  try {
    const body: CreateCohortRequest = await request.json();
    const { key, name, description, conditions, appId } = body;

    // Check if cohort key already exists for this app
    const existingCohort = await prisma.cohort.findUnique({
      where: {
        appId_key: {
          appId,
          key
        }
      }
    });

    if (existingCohort) {
      return NextResponse.json(
        { error: 'A cohort with this key already exists' },
        { status: 409 }
      );
    }

    // Validate conditions don't contain cohort references (prevent circular dependencies)
    const hasCircularReference = conditions.some(condition => condition.type === 'cohort');
    if (hasCircularReference) {
      return NextResponse.json(
        { error: 'Cohorts cannot reference other cohorts' },
        { status: 400 }
      );
    }

    const cohort = await prisma.cohort.create({
      data: {
        key,
        name,
        description,
        conditions,
        appId
      },
      include: {
        app: {
          select: { name: true, identifier: true }
        }
      }
    });

    return NextResponse.json(cohort, { status: 201 });
  } catch (error) {
    console.error('Error creating cohort:', error);
    return NextResponse.json({ error: 'Failed to create cohort' }, { status: 500 });
  }
}