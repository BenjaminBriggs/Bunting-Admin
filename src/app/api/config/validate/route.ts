import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateConfigFromDb } from '@/lib/config-generator';
import { validateConfig } from '@/lib/config-validation';

const validateConfigSchema = z.object({
  appId: z.string(),
});

export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: string;
  message: string;
  flagKey?: string;
  cohortKey?: string;
}

export interface ValidationWarning {
  type: string;
  message: string;
  flagKey?: string;
  cohortKey?: string;
}


// POST /api/config/validate - Validate current configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId } = validateConfigSchema.parse(body);

    // Generate current config
    const config = await generateConfigFromDb(appId);
    
    // Run validation
    const validation = validateConfig(config);

    return NextResponse.json(validation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    
    console.error('Error validating config:', error);
    return NextResponse.json({ error: 'Failed to validate configuration' }, { status: 500 });
  }
}

