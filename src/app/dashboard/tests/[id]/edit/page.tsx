'use client';

import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import TestForm, {
	type TestFormSubmit,
	type TestGroupValue,
} from '@/components/features/tests/test-form';
import {
	archiveTestRollout,
	deleteTest,
	fetchTestRollout,
	updateTestRollout,
} from '@/lib/api';
import { useChanges } from '@/lib/changes-context';
import type { Condition, TestVariant } from '@/types';

function isEvenSplit(groups: TestGroupValue[]): boolean {
	const n = groups.length;
	const base = Math.floor(100 / n);
	const rem = 100 - base * n;
	return groups.every((g, i) => g.weight === base + (i < rem ? 1 : 0));
}

export default function EditTestPage() {
	const params = useParams();
	const router = useRouter();
	const { markChangesDetected } = useChanges();
	const testId = params?.id as string;

	const [loading, setLoading] = useState(true);
	const [test, setTest] = useState<any>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);

	const loadTest = useCallback(async () => {
		try {
			setLoading(true);
			const data = await fetchTestRollout(testId);
			setTest(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load test');
		} finally {
			setLoading(false);
		}
	}, [testId]);

	useEffect(() => {
		loadTest();
	}, [loadTest]);

	const handleSubmit = async (payload: TestFormSubmit) => {
		if (!test) {
			return;
		}
		setSaving(true);
		setSaveError(null);
		try {
			const variants = payload.groups.reduce<Record<string, TestVariant>>(
				(acc, g) => {
					acc[g.name] = {
						percentage: g.weight,
						values: { development: '', beta: '', production: '' },
					};
					return acc;
				},
				{},
			);
			await updateTestRollout(testId, {
				name: payload.name,
				description: payload.description,
				group: payload.group || null,
				variants,
				conditions: payload.conditions,
				flagIds: test.flagIds || [],
				archived: test.archived,
			});
			markChangesDetected();
			router.push('/dashboard/tests');
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : 'Failed to update test');
		} finally {
			setSaving(false);
		}
	};

	const handleComplete = async () => {
		if (!test) {
			return;
		}
		try {
			await archiveTestRollout(testId, 'complete');
			markChangesDetected();
			router.push('/dashboard/tests');
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : 'Failed to complete test');
		}
	};

	const handleDelete = async () => {
		if (!test) {
			return;
		}
		if (
			confirm(
				'Are you sure you want to delete this test? This action cannot be undone.',
			)
		) {
			try {
				await deleteTest(testId);
				markChangesDetected();
				router.push('/dashboard/tests');
			} catch (err) {
				setSaveError(err instanceof Error ? err.message : 'Failed to delete test');
			}
		}
	};

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
				<CircularProgress sx={{ mr: 2 }} />
				<Typography>Loading test…</Typography>
			</Box>
		);
	}

	if (error || !test) {
		return (
			<Box sx={{ textAlign: 'center', py: 8 }}>
				<Alert severity="error" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
					{error || 'Test not found'}
				</Alert>
				<Button variant="outlined" component={Link} href="/dashboard/tests">
					Back to Tests
				</Button>
			</Box>
		);
	}

	const groups: TestGroupValue[] = Object.entries(test.variants || {}).map(
		([name, data]: [string, any]) => ({
			name,
			weight: data.percentage || 0,
		}),
	);
	const conditions: Condition[] = test.conditions || [];

	return (
		<Box sx={{ py: 1 }}>
			{test.archived && (
				<Alert severity="info" sx={{ maxWidth: 920, mx: 'auto', mb: 2 }}>
					This test is archived and no longer active.
				</Alert>
			)}
			<TestForm
				mode="edit"
				initial={{
					name: test.name,
					key: test.key,
					groups: groups.length > 0 ? groups : [
						{ name: 'Treatment', weight: 50 },
						{ name: 'Control', weight: 50 },
					],
					adjustSplit: groups.length > 0 ? !isEvenSplit(groups) : false,
					conditions,
					description: test.description || '',
					group: test.group || '',
					archived: test.archived,
				}}
				saving={saving}
				saveError={saveError}
				onSubmit={handleSubmit}
				onComplete={handleComplete}
				onDelete={handleDelete}
			/>
		</Box>
	);
}
