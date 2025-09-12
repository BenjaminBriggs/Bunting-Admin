import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for creating/updating flags
const createFlagSchema = z.object({
  appId: z.string(),
  key: z.string(),
  displayName: z.string(),
  type: z.enum(['bool', 'string', 'int', 'double', 'date', 'json']),
  defaultValue: z.any(),
  rules: z.array(z.any()).optional(),
  description: z.string().optional(),
});

// GET /api/flags - List all flags for an app
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');

    if (!appId) {
      return NextResponse.json({ error: 'appId is required' }, { status: 400 });
    }

    const flags = await prisma.flag.findMany({
      where: { appId },
      orderBy: { updatedAt: 'desc' },
      include: {
        app: {
          select: { name: true, identifier: true }
        }
      }
    });

    return NextResponse.json(flags);
  } catch (error) {
    console.error('Error fetching flags:', error);
    return NextResponse.json({ error: 'Failed to fetch flags' }, { status: 500 });
  }
}

// POST /api/flags - Create a new flag
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createFlagSchema.parse(body);

    // Check if flag key already exists for this app
    const existingFlag = await prisma.flag.findUnique({
      where: {
        appId_key: {
          appId: validatedData.appId,
          key: validatedData.key
        }
      }
    });

    if (existingFlag) {
      return NextResponse.json(
        { error: 'A flag with this key already exists' },
        { status: 409 }
      );
    }

    // Map string type to enum
    const typeMap: Record<string, any> = {
      'bool': 'BOOL',
      'string': 'STRING', 
      'int': 'INT',
      'double': 'DOUBLE',
      'date': 'DATE',
      'json': 'JSON'
    };

    const flag = await prisma.flag.create({
      data: {
        appId: validatedData.appId,
        key: validatedData.key,
        displayName: validatedData.displayName,
        type: typeMap[validatedData.type],
        defaultValue: validatedData.defaultValue,
        rules: validatedData.rules || [],
        description: validatedData.description,
      },
      include: {
        app: {
          select: { name: true, identifier: true }
        }
      }
    });

    return NextResponse.json(flag, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    
    console.error('Error creating flag:', error);
    return NextResponse.json({ error: 'Failed to create flag' }, { status: 500 });
  }
}