'use client';

import { Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import FlagForm, {
	type FlagFormSubmit,
} from '@/components/features/flags/flag-form';
import { createFlag, fetchFlags } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { useChanges } from '@/lib/changes-context';

export default function NewFlagPage() {
	const router = useRouter();
	const { selectedApp } = useApp();
	const { markChangesDetected } = useChanges();
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [existingGroups, setExistingGroups] = useState<string[]>([]);

	// Redirect if no app is selected
	useEffect(() => {
		if (!selectedApp) {
			router.push('/dashboard');
		}
	}, [selectedApp, router]);

	// Load existing group names so the group field can autocomplete them.
	useEffect(() => {
		if (!selectedApp) {
			return;
		}
		fetchFlags(selectedApp.id)
			.then((flags) => {
				const groups = [
					...new Set(
						flags
							.map((f) => f.group?.trim())
							.filter((g): g is string => !!g),
					),
				].sort((a, b) => a.localeCompare(b));
				setExistingGroups(groups);
			})
			.catch(() => setExistingGroups([]));
	}, [selectedApp]);

	const handleSubmit = async (payload: FlagFormSubmit) => {
		if (!selectedApp) {return;}
		setSaving(true);
		setSaveError(null);
		try {
			await createFlag({
				appId: selectedApp.id,
				key: payload.key,
				displayName: payload.displayName,
				type: payload.type,
				defaultValues: payload.defaultValues,
				description: payload.description,
				group: payload.group || null,
			});
			markChangesDetected();
			router.push('/dashboard/flags');
		} catch (error) {
			setSaveError(
				error instanceof Error ? error.message : 'Failed to create flag',
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Box sx={{ py: 1 }}>
			<FlagForm
				mode="create"
				initial={{
					displayName: '',
					key: '',
					type: 'bool',
					description: '',
					group: '',
					defaultValues: {
						development: false,
						beta: false,
						production: false,
					},
				}}
				saving={saving}
				saveError={saveError}
				existingGroups={existingGroups}
				onSubmit={handleSubmit}
			/>
		</Box>
	);
}
