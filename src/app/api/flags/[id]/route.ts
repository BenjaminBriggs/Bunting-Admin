import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/flags/[id] - Get a specific flag
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const flag = await prisma.flag.findUnique({
      where: { id: params.id },
      include: {
        app: {
          select: { name: true, identifier: true }
        }
      }
    });

    if (!flag) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
    }

    return NextResponse.json(flag);
  } catch (error) {
    console.error('Error fetching flag:', error);
    return NextResponse.json({ error: 'Failed to fetch flag' }, { status: 500 });
  }
}

// PUT /api/flags/[id] - Update a flag
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Remove fields that shouldn't be updated directly
    const { id, createdAt, updatedAt, appId, ...updateData } = body;

    // Handle archiving
    if (updateData.archived !== undefined && updateData.archived) {
      updateData.archivedAt = new Date();
    } else if (updateData.archived === false) {
      updateData.archivedAt = null;
    }

    // Map string type to enum if provided
    if (updateData.type) {
      const typeMap: Record<string, any> = {
        'bool': 'BOOL',
        'string': 'STRING',
        'int': 'INT', 
        'double': 'DOUBLE',
        'date': 'DATE',
        'json': 'JSON'
      };
      updateData.type = typeMap[updateData.type] || updateData.type;
    }

    const flag = await prisma.flag.update({
      where: { id: params.id },
      data: updateData,
      include: {
        app: {
          select: { name: true, identifier: true }
        }
      }
    });

    return NextResponse.json(flag);
  } catch (error) {
    console.error('Error updating flag:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update flag' }, { status: 500 });
  }
}

// DELETE /api/flags/[id] - Delete a flag
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.flag.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting flag:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete flag' }, { status: 500 });
  }
}