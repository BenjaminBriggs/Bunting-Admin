import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateFlagSchema = z.object({
  key: z.string().optional(),
  displayName: z.string().optional(),
  type: z.enum(['bool', 'string', 'int', 'double', 'date', 'json']).optional(),
  defaultValue: z.any().optional(),
  rules: z.array(z.any()).optional(),
  description: z.string().optional(),
  archived: z.boolean().optional(),
});

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
    const validatedData = updateFlagSchema.parse(body);

    // Map string type to enum if provided
    let typeEnum;
    if (validatedData.type) {
      const typeMap: Record<string, any> = {
        'bool': 'BOOL',
        'string': 'STRING',
        'int': 'INT', 
        'double': 'DOUBLE',
        'date': 'DATE',
        'json': 'JSON'
      };
      typeEnum = typeMap[validatedData.type];
    }

    const updateData: any = {
      ...validatedData,
      ...(typeEnum && { type: typeEnum }),
      ...(validatedData.archived !== undefined && validatedData.archived && {
        archivedAt: new Date()
      }),
      ...(validatedData.archived === false && {
        archivedAt: null
      })
    };

    // Remove the string type field if we converted it
    if (typeEnum) {
      delete updateData.type;
      updateData.type = typeEnum;
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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    
    console.error('Error updating flag:', error);
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
    return NextResponse.json({ error: 'Failed to delete flag' }, { status: 500 });
  }
}