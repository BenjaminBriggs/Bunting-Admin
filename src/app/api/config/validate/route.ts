import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppNotFoundError, generateConfigFromDb } from '@/lib/config-generator';
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
}

export interface ValidationWarning {
	type: string;
	message: string;
	flagKey?: string;
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
			return NextResponse.json(
				{ error: 'Invalid request data', details: error.issues },
				{ status: 400 },
			);
		}

		// A missing app is an expected condition (empty DB / stale client selection),
		// not a server fault. Return 404 without logging a stack trace.
		if (error instanceof AppNotFoundError) {
			return NextResponse.json({ error: 'App not found' }, { status: 404 });
		}

		console.error('Error validating config:', error);
		return NextResponse.json(
			{ error: 'Failed to validate configuration' },
			{ status: 500 },
		);
	}
}
