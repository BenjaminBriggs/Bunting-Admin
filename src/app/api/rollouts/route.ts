import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { generateSalt } from '@/lib/crypto';
import { prisma } from '@/lib/db';
import {
	createRolloutSchema,
	zodErrorResponse,
} from '@/lib/validation-schemas';

// GET /api/rollouts?appId=xxx
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const appId = searchParams.get('appId');

	if (!appId) {
		return NextResponse.json({ error: 'appId is required' }, { status: 400 });
	}

	try {
		const rollouts = await prisma.testRollout.findMany({
			where: {
				appId,
				type: 'ROLLOUT',
			},
			orderBy: { createdAt: 'desc' },
		});

		return NextResponse.json(rollouts);
	} catch (error) {
		console.error('Error fetching rollouts:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch rollouts' },
			{ status: 500 },
		);
	}
}

// POST /api/rollouts
export async function POST(request: NextRequest) {
	try {
		const { key, name, description, group, conditions, percentage, appId } =
			createRolloutSchema.parse(await request.json());

		// Validate percentage
		if (percentage < 0 || percentage > 100) {
			return NextResponse.json(
				{
					error: 'Percentage must be between 0 and 100',
				},
				{ status: 400 },
			);
		}

		// Generate salt for consistent user bucketing
		const salt = generateSalt();

		const rollout = await prisma.testRollout.create({
			data: {
				key,
				name,
				description,
				group: group ?? null,
				type: 'ROLLOUT',
				salt,
				conditions: conditions as any,
				percentage,
				rolloutValues: {
					development: null,
					beta: null,
					production: null,
				},
				flagIds: [], // Will be populated when flags are assigned to this rollout
				appId,
			},
		});

		return NextResponse.json(rollout, { status: 201 });
	} catch (error) {
		const validationError = zodErrorResponse(error);
		if (validationError) {
			return validationError;
		}
		console.error('Error creating rollout:', error);
		return NextResponse.json(
			{ error: 'Failed to create rollout' },
			{ status: 500 },
		);
	}
}
