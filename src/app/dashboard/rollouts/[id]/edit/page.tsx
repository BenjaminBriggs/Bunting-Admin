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
	type FinishAction,
	FinishDialog,
} from '@/components/features/test-rollouts/FinishDialog';
import {
	abandonTestRollout,
	completeTestRollout,
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
	const [finishAction, setFinishAction] = useState<FinishAction | null>(null);
	const [finishBusy, setFinishBusy] = useState(false);
	const [finishError, setFinishError] = useState<string | null>(null);

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

	const openFinish = (action: FinishAction) => {
		setFinishError(null);
		setFinishAction(action);
	};

	const handleFinish = async () => {
		if (!rollout || !finishAction) {
			return;
		}
		setFinishBusy(true);
		setFinishError(null);
		try {
			if (finishAction === 'complete') {
				await completeTestRollout(rolloutId);
			} else {
				await abandonTestRollout(rolloutId);
			}
			markChangesDetected();
			router.push('/dashboard/rollouts');
		} catch (err) {
			setFinishError(
				err instanceof Error
					? err.message
					: `Failed to ${finishAction} rollout`,
			);
		} finally {
			setFinishBusy(false);
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
					{rollout.outcome === 'COMPLETED'
						? 'This rollout is completed. Its value was baked into the attached flags, and it is no longer active.'
						: rollout.outcome === 'ABANDONED'
							? 'This rollout was abandoned and is no longer active.'
							: 'This rollout is archived and no longer active.'}
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
				onComplete={() => openFinish('complete')}
				onAbandon={() => openFinish('abandon')}
				onDelete={() => void handleDelete()}
			/>
			{finishAction && (
				<FinishDialog
					open
					action={finishAction}
					kind="rollout"
					name={rollout.name}
					hasConditions={rollout.conditions.length > 0}
					busy={finishBusy}
					error={finishError}
					onConfirm={() => void handleFinish()}
					onClose={() => setFinishAction(null)}
				/>
			)}
		</Box>
	);
}
