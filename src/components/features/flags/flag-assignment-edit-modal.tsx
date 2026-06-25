'use client';

import { Rocket, Save, Science } from '@mui/icons-material';
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Stack,
	Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { fetchRollout, fetchTest, updateRollout, updateTest } from '@/lib/api';
import type { DBTestRollout, Environment, FlagValue } from '@/types';
import FlagValueInput, {
	type FlagType,
	getDefaultValueForType,
	processValueForType,
	validateValue,
} from './flag-value-input';

// The flag-value assignments this modal edits are stored as a nested
// environment → flagId → value map per test variant / rollout. That nested
// shape is not captured by the shared TestVariant/TestRollout types, so it is
// modelled locally for the narrowing below.
type EnvFlagValueMap = Partial<Record<Environment, Record<string, FlagValue>>>;

interface AssignmentVariant {
	values?: EnvFlagValueMap;
}

interface AssignmentItem {
	name: string;
	variants?: Record<string, AssignmentVariant>;
	rolloutValues?: EnvFlagValueMap;
}

interface FlagAssignmentEditModalProps {
	open: boolean;
	onClose: () => void;
	onSave: () => void;
	type: 'test' | 'rollout';
	itemId: string;
	flagId: string;
	flagName: string;
	flagType: FlagType;
	environment: Environment;
}

export default function FlagAssignmentEditModal({
	open,
	onClose,
	onSave,
	type,
	itemId,
	flagId,
	flagName,
	flagType,
	environment,
}: FlagAssignmentEditModalProps) {
	const [item, setItem] = useState<AssignmentItem | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [flagValues, setFlagValues] = useState<Record<string, FlagValue>>({});

	useEffect(() => {
		const loadItem = async () => {
			if (!open || !itemId) {
				return;
			}

			setLoading(true);
			setError(null);

			try {
				const fetched: DBTestRollout =
					type === 'test'
						? await fetchTest(itemId)
						: await fetchRollout(itemId);
				// Reinterpret through the local nested-assignment shape (see types above).
				const data = fetched as unknown as AssignmentItem;
				setItem(data);

				// Extract current flag values
				const currentValues: Record<string, FlagValue> = {};

				if (type === 'test' && data.variants) {
					// For tests, get values from each variant
					Object.entries(data.variants).forEach(([variantName, variant]) => {
						const existing = variant.values?.[environment]?.[flagId];
						if (existing !== undefined) {
							currentValues[variantName] = existing;
						} else {
							currentValues[variantName] = getDefaultValueForType(flagType);
						}
					});
				} else if (type === 'rollout' && data.rolloutValues) {
					// For rollouts, get the single value
					const existing = data.rolloutValues[environment]?.[flagId];
					if (existing !== undefined) {
						currentValues.rollout = existing;
					} else {
						currentValues.rollout = getDefaultValueForType(flagType);
					}
				}

				setFlagValues(currentValues);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load item');
			} finally {
				setLoading(false);
			}
		};

		void loadItem();
	}, [open, itemId, type, environment, flagId, flagType]);

	const validateValues = (): boolean => {
		return Object.values(flagValues).every(
			(value) => validateValue(value, flagType).isValid,
		);
	};

	const handleValueChange = (key: string, value: FlagValue) => {
		setFlagValues((prev) => ({
			...prev,
			[key]: value,
		}));
	};

	const handleSave = async () => {
		if (!validateValues() || !item) {
			setError('Please fix validation errors before saving');
			return;
		}

		setSaving(true);
		setError(null);

		try {
			if (type === 'test') {
				// Update test variants
				const updatedVariants: Record<string, AssignmentVariant> = {
					...item.variants,
				};

				Object.entries(flagValues).forEach(([variantName, value]) => {
					// flagValues keys are derived from this same variants map, so the
					// variant is always present.
					const variant = updatedVariants[variantName];
					const values: EnvFlagValueMap = variant.values ?? {
						development: {},
						beta: {},
						production: {},
					};
					const envValues = values[environment] ?? {};
					envValues[flagId] = processValueForType(value, flagType);
					values[environment] = envValues;
					variant.values = values;
				});

				await updateTest(itemId, {
					variants: updatedVariants as DBTestRollout['variants'],
				});
			} else {
				// Update rollout values
				const updatedRolloutValues: EnvFlagValueMap = {
					...item.rolloutValues,
					[environment]: {
						...item.rolloutValues?.[environment],
						[flagId]: processValueForType(flagValues.rollout, flagType),
					},
				};

				await updateRollout(itemId, {
					rolloutValues: updatedRolloutValues,
				} as Partial<DBTestRollout>);
			}

			onSave();
			onClose();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Failed to update flag values',
			);
		} finally {
			setSaving(false);
		}
	};

	const renderValueInput = (key: string, value: FlagValue) => {
		return (
			<FlagValueInput
				flagType={flagType}
				value={value}
				onChange={(newValue) => handleValueChange(key, newValue)}
				size="small"
				fullWidth
			/>
		);
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					{type === 'test' ? (
						<Science color="primary" />
					) : (
						<Rocket color="secondary" />
					)}
					Edit Flag Values -{' '}
					{environment.charAt(0).toUpperCase() + environment.slice(1)}
				</Box>
			</DialogTitle>

			<DialogContent>
				<Box sx={{ mt: 1 }}>
					{loading && (
						<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
							<CircularProgress sx={{ mr: 2 }} />
							<Typography>Loading {type}...</Typography>
						</Box>
					)}

					{error && (
						<Alert severity="error" sx={{ mb: 3 }}>
							{error}
						</Alert>
					)}

					{item && !loading && (
						<>
							<Alert severity="info" sx={{ mb: 3 }}>
								Edit values for <strong>{flagName}</strong> ({flagType}) in{' '}
								<strong>{item.name}</strong>
							</Alert>

							<Stack spacing={3}>
								{Object.entries(flagValues).map(([key, value]) => (
									<Box key={key}>
										<Typography variant="subtitle2" sx={{ mb: 1 }}>
											{type === 'test' ? `${key} Group` : 'Rollout Value'}
										</Typography>
										{renderValueInput(key, value)}
									</Box>
								))}
							</Stack>
						</>
					)}
				</Box>
			</DialogContent>

			<DialogActions>
				<Button onClick={onClose}>Cancel</Button>
				<Button
					onClick={() => {
						void handleSave();
					}}
					variant="contained"
					disabled={saving || !validateValues() || loading}
					startIcon={saving ? <CircularProgress size={20} /> : <Save />}
				>
					{saving ? 'Saving...' : 'Save Changes'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
