import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/tests/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const test = await prisma.testRollout.findUnique({
      where: { 
        id: params.id,
        type: 'TEST'
      }
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    return NextResponse.json(test);
  } catch (error) {
    console.error('Error fetching test:', error);
    return NextResponse.json({ error: 'Failed to fetch test' }, { status: 500 });
  }
}

// PUT /api/tests/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Remove fields that shouldn't be updated directly
    const { id, createdAt, updatedAt, appId, type, ...updateData } = body;

    const test = await prisma.testRollout.update({
      where: { 
        id: params.id,
        type: 'TEST'
      },
      data: updateData
    });

    return NextResponse.json(test);
  } catch (error) {
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
  { params }: { params: { id: string } }
) {
  try {
    await prisma.testRollout.delete({
      where: { 
        id: params.id,
        type: 'TEST'
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting test:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete test' }, { status: 500 });
  }
}