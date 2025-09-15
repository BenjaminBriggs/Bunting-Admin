import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CreateFlagRequest } from '@/types';

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

// POST /api/flags - Create a new flag with environment defaults
export async function POST(request: NextRequest) {
  try {
    const body: CreateFlagRequest = await request.json();
    const { key, displayName, type, description, defaultValues, appId } = body;

    // Check if flag key already exists for this app
    const existingFlag = await prisma.flag.findUnique({
      where: {
        appId_key: {
          appId,
          key
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

    // Use the provided environment-specific default values

    // Initialize empty variants for all environments
    const variants = {
      development: [],
      staging: [],
      production: []
    };

    const flag = await prisma.flag.create({
      data: {
        appId,
        key,
        displayName,
        type: typeMap[type],
        description,
        defaultValues,
        variants
      },
      include: {
        app: {
          select: { name: true, identifier: true }
        }
      }
    });

    return NextResponse.json(flag, { status: 201 });
  } catch (error) {
    console.error('Error creating flag:', error);
    return NextResponse.json({ error: 'Failed to create flag' }, { status: 500 });
  }
}