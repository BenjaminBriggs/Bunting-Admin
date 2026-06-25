'use client';

import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Typography,
} from '@mui/material';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import RolloutForm, {
	type RolloutFormSubmit,
} from '@/components/features/rollouts/rollout-form';
import {
	archiveTestRollout,
	deleteRollout,
	fetchTestRollout,
	type TestRollout,
	updateTestRollout,
} from '@/lib/api';
import { useChanges } from '@/lib/changes-context';

export default function EditRolloutPage() {
	const params = useParams();
	const router = useRouter();
	const { markChangesDetected } = useChanges();
	const rolloutId = params.id as string;

	const [loading, setLoading] = useState(true);
	const [rollout, setRollout] = useState<TestRollout | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		const loadRollout = async () => {
			try {
				setLoading(true);
				const data = await fetchTestRollout(rolloutId);
				if (active) {
					setRollout(data);
				}
			} catch (err) {
				if (active) {
					setError(
						err instanceof Error ? err.message : 'Failed to load rollout',
					);
				}
			} finally {
				if (active) {
					setLoading(false);
				}
			}
		};
		void loadRollout();
		return () => {
			active = false;
		};
	}, [rolloutId]);

	const handleSubmit = async (payload: RolloutFormSubmit) => {
		if (!rollout) {
			return;
		}
		setSaving(true);
		setSaveError(null);
		try {
			await updateTestRollout(rolloutId, {
				name: payload.name,
				description: payload.description,
				group: payload.group || null,
				percentage: payload.percentage,
				conditions: payload.conditions,
				archived: rollout.archived,
			});
			markChangesDetected();
			router.push('/dashboard/rollouts');
		} catch (err) {
			setSaveError(
				err instanceof Error ? err.message : 'Failed to update rollout',
			);
		} finally {
			setSaving(false);
		}
	};

	const handleComplete = async () => {
		if (!rollout) {
			return;
		}
		try {
			await archiveTestRollout(rolloutId, 'complete');
			markChangesDetected();
			router.push('/dashboard/rollouts');
		} catch (err) {
			setSaveError(
				err instanceof Error ? err.message : 'Failed to complete rollout',
			);
		}
	};

	const handleDelete = async () => {
		if (!rollout) {
			return;
		}
		if (
			confirm(
				'Are you sure you want to delete this rollout? This action cannot be undone.',
			)
		) {
			try {
				await deleteRollout(rolloutId);
				markChangesDetected();
				router.push('/dashboard/rollouts');
			} catch (err) {
				setSaveError(
					err instanceof Error ? err.message : 'Failed to delete rollout',
				);
			}
		}
	};

	if (loading) {
		return (
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					py: 8,
				}}
			>
				<CircularProgress sx={{ mr: 2 }} />
				<Typography>Loading rollout…</Typography>
			</Box>
		);
	}

	if (error || !rollout) {
		return (
			<Box sx={{ textAlign: 'center', py: 8 }}>
				<Alert severity="error" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
					{error ?? 'Rollout not found'}
				</Alert>
				<Button variant="outlined" component={Link} href="/dashboard/rollouts">
					Back to Rollouts
				</Button>
			</Box>
		);
	}

	return (
		<Box sx={{ py: 1 }}>
			{rollout.archived && (
				<Alert severity="info" sx={{ maxWidth: 920, mx: 'auto', mb: 2 }}>
					This rollout is archived and no longer active.
				</Alert>
			)}
			<RolloutForm
				mode="edit"
				initial={{
					name: rollout.name,
					key: rollout.key,
					percentage: rollout.percentage ?? 0,
					description: rollout.description ?? '',
					group: rollout.group ?? '',
					archived: rollout.archived,
					conditions: rollout.conditions,
				}}
				saving={saving}
				saveError={saveError}
				onSubmit={(payload) => void handleSubmit(payload)}
				onComplete={() => void handleComplete()}
				onDelete={() => void handleDelete()}
			/>
		</Box>
	);
}
