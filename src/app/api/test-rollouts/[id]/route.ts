import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
	updateTestRolloutSchema,
	zodErrorResponse,
} from '@/lib/validation-schemas';

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const testRollout = await prisma.testRollout.findUnique({
			where: {
				id,
			},
		});

		if (!testRollout) {
			return NextResponse.json(
				{ error: 'Test/Rollout not found' },
				{ status: 404 },
			);
		}

		return NextResponse.json(testRollout);
	} catch (error) {
		console.error('Failed to fetch test/rollout:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch test/rollout' },
			{ status: 500 },
		);
	}
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const {
			name,
			description,
			percentage,
			conditions,
			flagIds,
			archived,
			variants,
			rolloutValues,
		} = updateTestRolloutSchema.parse(await request.json());

		const testRollout = await prisma.testRollout.update({
			where: {
				id,
			},
			data: {
				name,
				description,
				percentage,
				conditions: conditions || [],
				flagIds: flagIds || [],
				archived: archived || false,
				variants: variants || null,
				rolloutValues: rolloutValues || null,
				updatedAt: new Date(),
			},
		});

		return NextResponse.json(testRollout);
	} catch (error) {
		const validationError = zodErrorResponse(error);
		if (validationError) {
			return validationError;
		}
		console.error('Failed to update test/rollout:', error);
		return NextResponse.json(
			{ error: 'Failed to update test/rollout' },
			{ status: 500 },
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		await prisma.testRollout.delete({
			where: {
				id,
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Failed to delete test/rollout:', error);
		return NextResponse.json(
			{ error: 'Failed to delete test/rollout' },
			{ status: 500 },
		);
	}
}
