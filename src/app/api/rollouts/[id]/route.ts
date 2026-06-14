import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { updateRolloutSchema, zodErrorResponse } from '@/lib/validation-schemas';

// GET /api/rollouts/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rollout = await prisma.testRollout.findUnique({
      where: {
        id,
        type: 'ROLLOUT'
      }
    });

    if (!rollout) {
      return NextResponse.json({ error: 'Rollout not found' }, { status: 404 });
    }

    return NextResponse.json(rollout);
  } catch (error: any) {
    console.error('Error fetching rollout:', error);
    return NextResponse.json({ error: 'Failed to fetch rollout' }, { status: 500 });
  }
}

// PUT /api/rollouts/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const updateData: Record<string, any> = updateRolloutSchema.parse(await request.json());

    const rollout = await prisma.testRollout.update({
      where: {
        id,
        type: 'ROLLOUT'
      },
      data: updateData
    });

    return NextResponse.json(rollout);
  } catch (error: any) {
    const validationError = zodErrorResponse(error);
    if (validationError) return validationError;
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.testRollout.delete({
      where: {
        id,
        type: 'ROLLOUT'
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting rollout:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Rollout not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete rollout' }, { status: 500 });
  }
}