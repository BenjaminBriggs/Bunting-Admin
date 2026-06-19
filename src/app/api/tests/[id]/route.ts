import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { updateTestSchema, zodErrorResponse } from '@/lib/validation-schemas';

// GET /api/tests/[id]
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const test = await prisma.testRollout.findUnique({
			where: {
				id,
				type: 'TEST',
			},
		});

		if (!test) {
			return NextResponse.json({ error: 'Test not found' }, { status: 404 });
		}

		return NextResponse.json(test);
	} catch (error) {
		console.error('Error fetching test:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch test' },
			{ status: 500 },
		);
	}
}

// PUT /api/tests/[id]
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		const updateData = updateTestSchema.parse(
			await request.json(),
		) as Prisma.TestRolloutUncheckedUpdateInput;

		const test = await prisma.testRollout.update({
			where: {
				id,
				type: 'TEST',
			},
			data: updateData,
		});

		return NextResponse.json(test);
	} catch (error) {
		const validationError = zodErrorResponse(error);
		if (validationError) {
			return validationError;
		}
		console.error('Error updating test:', error);
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2025'
		) {
			return NextResponse.json({ error: 'Test not found' }, { status: 404 });
		}
		return NextResponse.json(
			{ error: 'Failed to update test' },
			{ status: 500 },
		);
	}
}

// DELETE /api/tests/[id]
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	try {
		await prisma.testRollout.delete({
			where: {
				id,
				type: 'TEST',
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error deleting test:', error);
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === 'P2025'
		) {
			return NextResponse.json({ error: 'Test not found' }, { status: 404 });
		}
		return NextResponse.json(
			{ error: 'Failed to delete test' },
			{ status: 500 },
		);
	}
}
