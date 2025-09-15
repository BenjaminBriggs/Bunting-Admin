import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

// PUT /api/cohorts/[id] - Update a cohort (condition group)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Remove fields that shouldn't be updated directly
    const { id, createdAt, updatedAt, appId, ...updateData } = body;

    // Validate conditions don't contain cohort references if being updated
    if (updateData.conditions) {
      const hasCircularReference = updateData.conditions.some((condition: any) => condition.type === 'cohort');
      if (hasCircularReference) {
        return NextResponse.json(
          { error: 'Cohorts cannot reference other cohorts' },
          { status: 400 }
        );
      }
    }

    const cohort = await prisma.cohort.update({
      where: { id: params.id },
      data: updateData,
      include: {
        app: {
          select: { name: true, identifier: true }
        }
      }
    });

    return NextResponse.json(cohort);
  } catch (error) {
    console.error('Error updating cohort:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }
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
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete cohort' }, { status: 500 });
  }
}