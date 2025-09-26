import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// PUT /api/rollouts/[id]/percentage
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { percentage } = await request.json();

    // Validate percentage
    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
      return NextResponse.json({ 
        error: 'Percentage must be a number between 0 and 100' 
      }, { status: 400 });
    }

    const rollout = await prisma.testRollout.update({
      where: {
        id,
        type: 'ROLLOUT'
      },
      data: { percentage }
    });

    return NextResponse.json(rollout);
  } catch (error: any) {
    console.error('Error updating rollout percentage:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Rollout not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update rollout percentage' }, { status: 500 });
  }
}