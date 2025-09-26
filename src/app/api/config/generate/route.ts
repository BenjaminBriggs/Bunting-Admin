import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateConfigFromDb } from '@/lib/config-generator';

const generateConfigSchema = z.object({
  appId: z.string(),
});

// POST /api/config/generate - Generate current config JSON from database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId } = generateConfigSchema.parse(body);

    const config = await generateConfigFromDb(appId);
    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 });
    }
    
    console.error('Error generating config:', error);
    return NextResponse.json({ 
      error: 'Failed to generate config',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}