import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { generateSalt } from '@/lib/crypto';
import { prisma } from '@/lib/db';
import {
	createTestRolloutSchema,
	zodErrorResponse,
} from '@/lib/validation-schemas';

// GET /api/test-rollouts?appId=xxx&flagId=xxx
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const appId = searchParams.get('appId');
	const flagId = searchParams.get('flagId');

	if (!appId) {
		return NextResponse.json({ error: 'appId is required' }, { status: 400 });
	}

	try {
		const whereClause: any = {
			appId,
			archived: false,
		};

		// If flagId is provided, filter to tests/rollouts that include this flag
		if (flagId) {
			whereClause.flagIds = {
				array_contains: flagId,
			};
			console.log('Filtering test-rollouts by flagId:', flagId);
		}

		const testRollouts = await prisma.testRollout.findMany({
			where: whereClause,
			orderBy: { createdAt: 'desc' },
		});

		console.log(
			`Found ${testRollouts.length} test-rollouts for appId: ${appId}, flagId: ${flagId ?? 'all'}`,
		);

		return NextResponse.json(testRollouts);
	} catch (error) {
		console.error('Error fetching test rollouts:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch test rollouts' },
			{ status: 500 },
		);
	}
}

// POST /api/test-rollouts (for createTestRollout function)
export async function POST(request: NextRequest) {
	try {
		const {
			appId,
			name,
			description,
			group,
			type,
			variants,
			percentage,
			conditions,
			flagIds,
		} = createTestRolloutSchema.parse(await request.json());

		// Generate salt for consistent user bucketing
		const salt = generateSalt();

		// Generate key from name
		const key = name
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, '')
			.trim()
			.replace(/\s+/g, '_')
			.replace(/^[^a-z]/g, `${type.toLowerCase()}_`)
			.substring(0, 50);

		const data: any = {
			key,
			name,
			description,
			group: group ?? null,
			type,
			salt,
			conditions: conditions ?? [],
			flagIds: flagIds ?? [],
			appId,
		};

		if (type === 'TEST') {
			data.variants = variants;
		} else if (type === 'ROLLOUT') {
			data.percentage = percentage;
			data.rolloutValues = {
				development: null,
				beta: null,
				production: null,
			};
		}

		const testRollout = await prisma.testRollout.create({
			data,
		});

		return NextResponse.json(testRollout, { status: 201 });
	} catch (error) {
		const validationError = zodErrorResponse(error);
		if (validationError) {
			return validationError;
		}
		console.error('Error creating test/rollout:', error);
		return NextResponse.json(
			{ error: 'Failed to create test/rollout' },
			{ status: 500 },
		);
	}
}
