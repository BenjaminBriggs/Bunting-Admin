import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { updateCohortSchema, zodErrorResponse } from '@/lib/validation-schemas';

// GET /api/cohorts/[id] - Get a specific cohort
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const cohort = await prisma.cohort.findUnique({
			where: { id },
			include: {
				app: {
					select: { name: true, identifier: true },
				},
			},
		});

		if (!cohort) {
			return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
		}

		return NextResponse.json(cohort);
	} catch (error: any) {
		console.error('Error fetching cohort:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch cohort' },
			{ status: 500 },
		);
	}
}

// PUT /api/cohorts/[id] - Update a cohort (condition group)
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const updateData: Record<string, any> = updateCohortSchema.parse(
			await request.json(),
		);

		// Validate conditions don't contain cohort references if being updated
		if (updateData.conditions) {
			const hasCircularReference = updateData.conditions.some(
				(condition: any) => condition.type === 'cohort',
			);
			if (hasCircularReference) {
				return NextResponse.json(
					{ error: 'Cohorts cannot reference other cohorts' },
					{ status: 400 },
				);
			}
		}

		const cohort = await prisma.cohort.update({
			where: { id },
			data: updateData,
			include: {
				app: {
					select: { name: true, identifier: true },
				},
			},
		});

		return NextResponse.json(cohort);
	} catch (error: any) {
		const validationError = zodErrorResponse(error);
		if (validationError) {
			return validationError;
		}
		console.error('Error updating cohort:', error);
		if (error.code === 'P2025') {
			return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
		}
		return NextResponse.json(
			{ error: 'Failed to update cohort' },
			{ status: 500 },
		);
	}
}

// DELETE /api/cohorts/[id] - Delete a cohort
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		await prisma.cohort.delete({
			where: { id },
		});

		return NextResponse.json({ success: true });
	} catch (error: any) {
		console.error('Error deleting cohort:', error);
		if (error.code === 'P2025') {
			return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
		}
		return NextResponse.json(
			{ error: 'Failed to delete cohort' },
			{ status: 500 },
		);
	}
}
