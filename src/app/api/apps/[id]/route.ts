import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateAppSchema = z.object({
  name: z.string().optional(),
  identifier: z.string().optional(),
  artifactUrl: z.string().optional(),
  publicKeys: z.array(z.object({
    kid: z.string(),
    pem: z.string()
  })).optional(),
  fetchPolicy: z.object({
    min_interval_seconds: z.number(),
    hard_ttl_days: z.number()
  }).optional(),
  storageConfig: z.object({
    bucket: z.string(),
    region: z.string(),
    endpoint: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional()
  }).optional()
});

// GET /api/apps/[id] - Get a specific app
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params in Next.js 15
  const { id } = await params;
  try {
    const app = await prisma.app.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            flags: true,
            cohorts: true
          }
        }
      }
    });

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    return NextResponse.json(app);
  } catch (error) {
    console.error('Error fetching app:', error);
    return NextResponse.json({ error: 'Failed to fetch app' }, { status: 500 });
  }
}

// PUT /api/apps/[id] - Update an app
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params in Next.js 15
  const { id } = await params;
  try {
    const body = await request.json();
    const validatedData = updateAppSchema.parse(body);

    // Check if app exists
    const existingApp = await prisma.app.findUnique({
      where: { id }
    });

    if (!existingApp) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // If identifier is being updated, check if it conflicts with another app
    if (validatedData.identifier && validatedData.identifier !== existingApp.identifier) {
      const conflictingApp = await prisma.app.findUnique({
        where: { identifier: validatedData.identifier }
      });

      if (conflictingApp) {
        return NextResponse.json(
          { error: 'An app with this identifier already exists' },
          { status: 409 }
        );
      }
    }

    const updatedApp = await prisma.app.update({
      where: { id },
      data: validatedData,
      include: {
        _count: {
          select: {
            flags: true,
            cohorts: true
          }
        }
      }
    });

    return NextResponse.json(updatedApp);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    
    console.error('Error updating app:', error);
    return NextResponse.json({ error: 'Failed to update app' }, { status: 500 });
  }
}

// DELETE /api/apps/[id] - Delete an app
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params in Next.js 15
  const { id } = await params;
  try {
    // Check if app exists
    const existingApp = await prisma.app.findUnique({
      where: { id }
    });

    if (!existingApp) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // Delete the app (cascades to flags and cohorts due to Prisma schema)
    await prisma.app.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'App deleted successfully' });
  } catch (error) {
    console.error('Error deleting app:', error);
    return NextResponse.json({ error: 'Failed to delete app' }, { status: 500 });
  }
}