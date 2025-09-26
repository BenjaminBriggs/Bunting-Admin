import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/test-rollouts/[id]/archive
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { type } = await request.json();

    if (!['cancel', 'complete'].includes(type)) {
      return NextResponse.json({ 
        error: 'Type must be either "cancel" or "complete"' 
      }, { status: 400 });
    }

    // Get the current test/rollout to determine its type
    const testRollout = await prisma.testRollout.findUnique({
      where: { id }
    });

    if (!testRollout) {
      return NextResponse.json({ error: 'Test/Rollout not found' }, { status: 404 });
    }

    let updateData: any = {
      archived: true,
      archivedAt: new Date()
    };

    // For rollouts, update percentage based on archive type
    if (testRollout.type === 'ROLLOUT') {
      updateData.percentage = type === 'cancel' ? 0 : 100;
    }

    // For tests, we could potentially update variant percentages here
    // but for now we'll just mark as archived

    const updated = await prisma.testRollout.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error archiving test/rollout:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Test/Rollout not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to archive test/rollout' }, { status: 500 });
  }
}