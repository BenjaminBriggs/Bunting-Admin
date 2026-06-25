'use client';

import { Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import TestForm, {
	type TestFormSubmit,
} from '@/components/features/tests/test-form';
import { useApp } from '@/lib/app-context';
import { useChanges } from '@/lib/changes-context';

export default function NewTestPage() {
	const router = useRouter();
	const { selectedApp } = useApp();
	const { markChangesDetected } = useChanges();
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	useEffect(() => {
		if (!selectedApp) {
			router.push('/dashboard');
		}
	}, [selectedApp, router]);

	const handleSubmit = async (payload: TestFormSubmit) => {
		if (!selectedApp) {
			return;
		}
		setSaving(true);
		setSaveError(null);
		try {
			// Shape expected by POST /api/tests (preserved from the prior form).
			const testData = {
				key: payload.key,
				name: payload.name,
				description: payload.description,
				group: payload.group || null,
				conditions: payload.conditions,
				variantCount: payload.groups.length,
				trafficSplit: payload.groups.map((g) => g.weight),
				variantNames: payload.groups.map((g) => g.name),
				appId: selectedApp.id,
			};
			const response = await fetch('/api/tests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testData),
			});
			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.error || 'Failed to create test');
			}
			markChangesDetected();
			router.push('/dashboard/tests');
		} catch (err) {
			setSaveError(
				err instanceof Error ? err.message : 'Failed to create test',
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Box sx={{ py: 1 }}>
			<TestForm
				mode="create"
				initial={{
					name: '',
					key: '',
					groups: [
						{ name: 'Treatment', weight: 50 },
						{ name: 'Control', weight: 50 },
					],
					adjustSplit: false,
					conditions: [],
					description: '',
					group: '',
				}}
				saving={saving}
				saveError={saveError}
				onSubmit={handleSubmit}
			/>
		</Box>
	);
}
