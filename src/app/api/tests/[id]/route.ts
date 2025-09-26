import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/tests/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const test = await prisma.testRollout.findUnique({
      where: {
        id,
        type: 'TEST'
      }
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    return NextResponse.json(test);
  } catch (error: any) {
    console.error('Error fetching test:', error);
    return NextResponse.json({ error: 'Failed to fetch test' }, { status: 500 });
  }
}

// PUT /api/tests/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();

    // Remove fields that shouldn't be updated directly
    const { id: bodyId, createdAt, updatedAt, appId, type, ...updateData } = body;

    const test = await prisma.testRollout.update({
      where: {
        id,
        type: 'TEST'
      },
      data: updateData
    });

    return NextResponse.json(test);
  } catch (error: any) {
    console.error('Error updating test:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update test' }, { status: 500 });
  }
}

// DELETE /api/tests/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.testRollout.delete({
      where: {
        id,
        type: 'TEST'
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting test:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete test' }, { status: 500 });
  }
}