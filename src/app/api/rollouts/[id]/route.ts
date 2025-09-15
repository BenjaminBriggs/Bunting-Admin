import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/rollouts/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rollout = await prisma.testRollout.findUnique({
      where: { 
        id: params.id,
        type: 'ROLLOUT'
      }
    });

    if (!rollout) {
      return NextResponse.json({ error: 'Rollout not found' }, { status: 404 });
    }

    return NextResponse.json(rollout);
  } catch (error) {
    console.error('Error fetching rollout:', error);
    return NextResponse.json({ error: 'Failed to fetch rollout' }, { status: 500 });
  }
}

// PUT /api/rollouts/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Remove fields that shouldn't be updated directly
    const { id, createdAt, updatedAt, appId, type, ...updateData } = body;

    // Validate percentage if it's being updated
    if (updateData.percentage !== undefined) {
      if (updateData.percentage < 0 || updateData.percentage > 100) {
        return NextResponse.json({ 
          error: 'Percentage must be between 0 and 100' 
        }, { status: 400 });
      }
    }

    const rollout = await prisma.testRollout.update({
      where: { 
        id: params.id,
        type: 'ROLLOUT'
      },
      data: updateData
    });

    return NextResponse.json(rollout);
  } catch (error) {
    console.error('Error updating rollout:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Rollout not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update rollout' }, { status: 500 });
  }
}

// DELETE /api/rollouts/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.testRollout.delete({
      where: { 
        id: params.id,
        type: 'ROLLOUT'
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting rollout:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Rollout not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete rollout' }, { status: 500 });
  }
}