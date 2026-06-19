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
import { useCallback, useEffect, useState } from 'react';
import FlagForm, {
	type FlagFormSubmit,
} from '@/components/features/flags/flag-form';
import {
	deleteFlag,
	fetchFlag,
	fetchFlags,
	type Flag as FlagType,
	updateFlag,
} from '@/lib/api';
import { useChanges } from '@/lib/changes-context';
import type { FlagType as FlagTypeValue } from '@/types';

type EnvKey = 'development' | 'beta' | 'production';

export default function EditFlagPage() {
	const params = useParams();
	const router = useRouter();
	const { markChangesDetected } = useChanges();
	const flagId = params.id as string;

	const [loading, setLoading] = useState(true);
	const [flag, setFlag] = useState<FlagType | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [existingGroups, setExistingGroups] = useState<string[]>([]);

	const loadFlag = useCallback(async () => {
		try {
			const flagData = await fetchFlag(flagId);
			setFlag(flagData);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load flag');
		} finally {
			setLoading(false);
		}
	}, [flagId]);

	useEffect(() => {
		let active = true;
		fetchFlag(flagId)
			.then((flagData) => {
				if (active) {
					setFlag(flagData);
				}
			})
			.catch((err: unknown) => {
				if (active) {
					setError(err instanceof Error ? err.message : 'Failed to load flag');
				}
			})
			.finally(() => {
				if (active) {
					setLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, [flagId]);

	// Once the flag loads we know its app — pull sibling group names for autocomplete.
	useEffect(() => {
		if (!flag?.appId) {
			return;
		}
		fetchFlags(flag.appId)
			.then((flags) => {
				const groups = [
					...new Set(
						flags.map((f) => f.group?.trim()).filter((g): g is string => !!g),
					),
				].sort((a, b) => a.localeCompare(b));
				setExistingGroups(groups);
			})
			.catch(() => setExistingGroups([]));
	}, [flag?.appId]);

	const handleSubmit = async (payload: FlagFormSubmit) => {
		if (!flag) {
			return;
		}
		setSaving(true);
		setSaveError(null);
		try {
			await updateFlag(flagId, {
				key: payload.key,
				displayName: payload.displayName,
				type: payload.type as FlagTypeValue,
				defaultValues: payload.defaultValues,
				variants: flag.variants,
				description: payload.description,
				group: payload.group || null,
				archived: flag.archived,
			});
			markChangesDetected();
			router.push('/dashboard/flags');
		} catch (err) {
			setSaveError(
				err instanceof Error ? err.message : 'Failed to update flag',
			);
		} finally {
			setSaving(false);
		}
	};

	const handleArchiveToggle = async () => {
		if (!flag) {
			return;
		}
		try {
			setLoading(true);
			await updateFlag(flagId, { archived: !flag.archived });
			markChangesDetected();
			await loadFlag();
		} catch (err) {
			setSaveError(
				err instanceof Error ? err.message : 'Failed to archive flag',
			);
		}
	};

	const handleDelete = async () => {
		if (!flag) {
			return;
		}
		if (
			confirm(
				'Are you sure you want to delete this flag? This action cannot be undone.',
			)
		) {
			try {
				await deleteFlag(flagId);
				markChangesDetected();
				router.push('/dashboard/flags');
			} catch (err) {
				setSaveError(
					err instanceof Error ? err.message : 'Failed to delete flag',
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
				<Typography>Loading flag…</Typography>
			</Box>
		);
	}

	if (error || !flag) {
		return (
			<Box sx={{ textAlign: 'center', py: 8 }}>
				<Alert severity="error" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
					{error ?? 'Flag not found'}
				</Alert>
				<Button variant="outlined" component={Link} href="/dashboard/flags">
					Back to Flags
				</Button>
			</Box>
		);
	}

	const flagTypeLower = flag.type.toLowerCase();
	const envDefault = (env: EnvKey) => flag.defaultValues[env];

	return (
		<Box sx={{ py: 1 }}>
			{flag.archived && (
				<Alert severity="warning" sx={{ maxWidth: 920, mx: 'auto', mb: 2 }}>
					This flag is archived and locked. It is still published, marked
					deprecated so SDK consumers get a warning, and can be deleted once the
					archived state has been released. Unarchive it to edit.
				</Alert>
			)}
			<FlagForm
				mode="edit"
				initial={{
					displayName: flag.displayName,
					key: flag.key,
					type: flagTypeLower,
					description: flag.description ?? '',
					group: flag.group ?? '',
					archived: flag.archived,
					defaultValues: {
						development: envDefault('development'),
						beta: envDefault('beta'),
						production: envDefault('production'),
					},
				}}
				saving={saving}
				saveError={saveError}
				existingGroups={existingGroups}
				onSubmit={(payload) => void handleSubmit(payload)}
				onArchiveToggle={() => void handleArchiveToggle()}
				onDelete={() => void handleDelete()}
			/>
		</Box>
	);
}
