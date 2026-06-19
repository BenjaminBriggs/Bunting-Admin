'use client';

import { Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import RolloutForm, {
	type RolloutFormSubmit,
} from '@/components/features/rollouts/rollout-form';
import { createRollout } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { useChanges } from '@/lib/changes-context';

export default function NewRolloutPage() {
	const router = useRouter();
	const { selectedApp } = useApp();
	const { markChangesDetected } = useChanges();
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// Redirect if no app is selected
	useEffect(() => {
		if (!selectedApp) {
			router.push('/dashboard');
		}
	}, [selectedApp, router]);

	const handleSubmit = async (payload: RolloutFormSubmit) => {
		if (!selectedApp) {
			setSaveError('No application selected');
			return;
		}
		setSaving(true);
		setSaveError(null);
		try {
			await createRollout({
				appId: selectedApp.id,
				key: payload.key,
				name: payload.name,
				description: payload.description,
				group: payload.group || null,
				percentage: payload.percentage,
				conditions: payload.conditions,
			});
			markChangesDetected();
			router.push('/dashboard/rollouts');
		} catch (err) {
			setSaveError(
				err instanceof Error ? err.message : 'Failed to create rollout',
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Box sx={{ py: 1 }}>
			<RolloutForm
				mode="create"
				initial={{
					name: '',
					key: '',
					percentage: 10,
					description: '',
					group: '',
					conditions: [],
				}}
				saving={saving}
				saveError={saveError}
				onSubmit={(payload) => void handleSubmit(payload)}
			/>
		</Box>
	);
}
