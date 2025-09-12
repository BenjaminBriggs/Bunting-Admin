import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateCohortSchema = z.object({
  key: z.string().optional(),
  name: z.string().optional(),
  percentage: z.number().min(0).max(100).optional(),
  rules: z.array(z.any()).optional(),
  description: z.string().optional(),
});

// GET /api/cohorts/[id] - Get a specific cohort
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cohort = await prisma.cohort.findUnique({
      where: { id: params.id },
      include: {
        app: {
          select: { name: true, identifier: true }
        }
      }
    });

    if (!cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    return NextResponse.json(cohort);
  } catch (error) {
    console.error('Error fetching cohort:', error);
    return NextResponse.json({ error: 'Failed to fetch cohort' }, { status: 500 });
  }
}

// PUT /api/cohorts/[id] - Update a cohort
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = updateCohortSchema.parse(body);

    const cohort = await prisma.cohort.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        app: {
          select: { name: true, identifier: true }
        }
      }
    });

    return NextResponse.json(cohort);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    
    console.error('Error updating cohort:', error);
    return NextResponse.json({ error: 'Failed to update cohort' }, { status: 500 });
  }
}

// DELETE /api/cohorts/[id] - Delete a cohort
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.cohort.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cohort:', error);
    return NextResponse.json({ error: 'Failed to delete cohort' }, { status: 500 });
  }
}