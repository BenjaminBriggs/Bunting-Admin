'use client';

import type { SxProps, Theme } from '@mui/material';
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	IconButton,
	Stack,
	Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { envColors, ink, monoFontFamily, surface } from '@/theme/designTokens';
import type { DBTestRollout, Environment, FlagValue } from '@/types';
import type { FlagType } from './flag-value-input';
import FlagValueInput, {
	getDefaultValueForType,
	processValueForType,
	validateValue,
} from './flag-value-input';

// Runtime shape stored in DBTestRollout.variants for a flag-assignment test:
// each group's `values` is keyed environment → flagId → value, which differs
// from the shared TestVariant.values type (environment → FlagValue). Modelled
// locally so this modal can read/write it without `any`. See report.
type FlagGroupValues = Partial<Record<Environment, Record<string, FlagValue>>>;
interface FlagTestVariant {
	values?: FlagGroupValues;
}
type RolloutFlagValues = Partial<
	Record<Environment, Record<string, FlagValue>>
>;

interface FlagTestAssignmentModalProps {
	open: boolean;
	onClose: () => void;
	onSave: () => void;
	environment: Environment;
	flagId: string;
	flagName: string;
	flagType: string;
	selectedTests: DBTestRollout[];
	selectedRollouts: DBTestRollout[];
}

interface TestGroupValue {
	testId: string;
	testName: string;
	groupName: string;
	value: FlagValue;
}

// Group swatch palette (matches the Test form / Tests card). Control reads soft + last.
const PALETTE = ['#F6A444', '#54C9C0', '#F47C5D', '#82C868', '#D8CFBC'];
const CONTROL_COLOR = '#D8CFBC';
const isControl = (name: string) => name.trim().toLowerCase() === 'control';

function Ms({ name, sx }: { name: string; sx?: SxProps<Theme> }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

function Label({ children }: { children: ReactNode }) {
	return (
		<Typography
			sx={{
				fontFamily: 'var(--font-nunito)',
				fontWeight: 700,
				fontSize: 10,
				letterSpacing: '.05em',
				textTransform: 'uppercase',
				color: ink.soft,
			}}
		>
			{children}
		</Typography>
	);
}

export default function FlagTestAssignmentModal({
	open,
	onClose,
	onSave,
	environment,
	flagId,
	flagName,
	flagType,
	selectedTests,
	selectedRollouts,
}: FlagTestAssignmentModalProps) {
	const [groupValues, setGroupValues] = useState<TestGroupValue[]>([]);
	const [rolloutValues, setRolloutValues] = useState<Record<string, FlagValue>>(
		{},
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const env = envColors[environment];
	const itemCount = selectedTests.length + selectedRollouts.length;

	useEffect(() => {
		if (!open) {
			return;
		}
		const initialValues: TestGroupValue[] = [];
		selectedTests.forEach((test) => {
			if (test.variants && typeof test.variants === 'object') {
				Object.keys(test.variants).forEach((groupName) => {
					initialValues.push({
						testId: test.id,
						testName: test.name,
						groupName,
						value: getDefaultValueForType(flagType as FlagType),
					});
				});
			}
		});
		setGroupValues(initialValues);

		const initialRollouts: Record<string, FlagValue> = {};
		selectedRollouts.forEach((rollout) => {
			initialRollouts[rollout.id] = getDefaultValueForType(
				flagType as FlagType,
			);
		});
		setRolloutValues(initialRollouts);
		setError(null);
	}, [open, selectedTests, selectedRollouts, flagType]);

	const handleGroupValueChange = (
		testId: string,
		groupName: string,
		value: FlagValue,
	) => {
		setGroupValues((prev) =>
			prev.map((gv) =>
				gv.testId === testId && gv.groupName === groupName
					? { ...gv, value }
					: gv,
			),
		);
	};

	const handleRolloutValueChange = (rolloutId: string, value: FlagValue) => {
		setRolloutValues((prev) => ({ ...prev, [rolloutId]: value }));
	};

	const validateValues = (): boolean => {
		const groupsOk = groupValues.every(
			(gv) => validateValue(gv.value, flagType as FlagType).isValid,
		);
		const rolloutsOk = Object.values(rolloutValues).every(
			(v) => validateValue(v, flagType as FlagType).isValid,
		);
		return groupsOk && rolloutsOk;
	};

	const handleSave = async () => {
		if (!validateValues()) {
			setError('Please fix the value errors before saving');
			return;
		}

		setSaving(true);
		setError(null);

		try {
			// Group values by test
			const testUpdates: Record<string, Record<string, FlagValue>> = {};
			groupValues.forEach((gv) => {
				const groups = (testUpdates[gv.testId] ??= {});
				groups[gv.groupName] = processValueForType(
					gv.value,
					flagType as FlagType,
				);
			});

			for (const testId of Object.keys(testUpdates)) {
				const test = selectedTests.find((t) => t.id === testId);
				if (test?.variants) {
					// The stored variants carry per-flag values (see FlagTestVariant).
					const updatedVariants = { ...test.variants } as Record<
						string,
						FlagTestVariant
					>;

					Object.keys(testUpdates[testId]).forEach((groupName) => {
						// groupName is always a key of updatedVariants (both derive from
						// test.variants), so the variant is guaranteed present here.
						const variant = updatedVariants[groupName];
						const values: FlagGroupValues = variant.values ?? {
							development: {},
							beta: {},
							production: {},
						};
						const envValues = values[environment] ?? {};
						envValues[flagId] = testUpdates[testId][groupName];
						values[environment] = envValues;
						variant.values = values;
					});

					const updatedFlagIds = test.flagIds.includes(flagId)
						? test.flagIds
						: [...test.flagIds, flagId];

					const response = await fetch(`/api/tests/${testId}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							variants: updatedVariants,
							flagIds: updatedFlagIds,
						}),
					});

					if (!response.ok) {
						const errorText = await response.text();
						throw new Error(`Failed to update test ${test.name}: ${errorText}`);
					}
				}
			}

			// Rollouts — one served value per rollout (the picked value, not a default)
			for (const rollout of selectedRollouts) {
				const rolloutValue = processValueForType(
					rolloutValues[rollout.id] ??
						getDefaultValueForType(flagType as FlagType),
					flagType as FlagType,
				);

				// rolloutValues is stored environment → flagId → value (see report).
				const existingRolloutValues = rollout.rolloutValues as
					| RolloutFlagValues
					| undefined;
				const updatedRolloutValues = {
					development: {},
					beta: {},
					production: {},
					...existingRolloutValues,
					[environment]: {
						...existingRolloutValues?.[environment],
						[flagId]: rolloutValue,
					},
				};

				const updatedFlagIds = rollout.flagIds.includes(flagId)
					? rollout.flagIds
					: [...rollout.flagIds, flagId];

				const response = await fetch(`/api/rollouts/${rollout.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						rolloutValues: updatedRolloutValues,
						flagIds: updatedFlagIds,
					}),
				});

				if (!response.ok) {
					throw new Error(`Failed to update rollout ${rollout.name}`);
				}
			}

			onSave();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to assign flag');
		} finally {
			setSaving(false);
		}
	};

	// Group the test group-values back per test, ordering any Control group last.
	const groupsForTest = (testId: string): TestGroupValue[] => {
		const rows = groupValues.filter((gv) => gv.testId === testId);
		return [...rows].sort(
			(a, b) =>
				(isControl(a.groupName) ? 1 : 0) - (isControl(b.groupName) ? 1 : 0),
		);
	};

	const headerIcon =
		selectedTests.length > 0 && selectedRollouts.length > 0
			? 'tune'
			: selectedRollouts.length > 0
				? 'rocket_launch'
				: 'science';

	const rowSx = {
		display: 'flex',
		alignItems: 'center',
		gap: 1.5,
		border: `1px solid ${surface.border}`,
		borderRadius: '11px',
		p: '11px 13px',
	} as const;

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			{/* header */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1.5,
					p: '18px 22px',
					borderBottom: '1px solid #F1EBDD',
				}}
			>
				<Box
					sx={{
						width: 40,
						height: 40,
						borderRadius: '11px',
						bgcolor: env.headerBg,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<Ms name={headerIcon} sx={{ fontSize: 22, color: env.text }} />
				</Box>
				<Box sx={{ flex: 1 }}>
					<Typography variant="h6" sx={{ fontSize: 17 }}>
						Configure flag values
					</Typography>
					<Typography sx={{ fontWeight: 600, fontSize: 11, color: ink.muted }}>
						{flagName} ·{' '}
						<Box component="span" sx={{ color: env.text }}>
							{env.label}
						</Box>
					</Typography>
				</Box>
				<IconButton onClick={onClose} size="small">
					<Ms name="close" sx={{ fontSize: 22, color: '#8B8472' }} />
				</IconButton>
			</Box>

			<DialogContent sx={{ p: '20px 22px' }}>
				<Stack spacing={2.5}>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'flex-start',
							gap: 1.25,
							bgcolor: env.headerBg,
							border: `1px solid ${env.border}`,
							borderRadius: '11px',
							p: '12px 14px',
						}}
					>
						<Ms name="info" sx={{ fontSize: 19, color: env.text, mt: '1px' }} />
						<Typography
							sx={{
								fontWeight: 600,
								fontSize: 13,
								color: env.text,
								lineHeight: 1.5,
							}}
						>
							Configure the value{' '}
							<Box component="span" sx={{ fontWeight: 800 }}>
								{flagName}
							</Box>{' '}
							(
							<Box
								component="span"
								sx={{ fontFamily: monoFontFamily, fontWeight: 700 }}
							>
								{flagType}
							</Box>
							) serves in {env.label} for each selected test group and rollout.
						</Typography>
					</Box>

					{error && <Alert severity="error">{error}</Alert>}

					{/* Rollouts */}
					{selectedRollouts.length > 0 && (
						<Box>
							<Box
								sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}
							>
								<Ms
									name="rocket_launch"
									sx={{ fontSize: 19, color: '#9A6F1C' }}
								/>
								<Typography variant="h6" sx={{ fontSize: 16 }}>
									Rollouts
								</Typography>
							</Box>
							<Stack spacing={1}>
								{selectedRollouts.map((rollout) => (
									<Box key={rollout.id} sx={rowSx}>
										<Box sx={{ flex: 1, minWidth: 0 }}>
											<Typography sx={{ fontWeight: 700, fontSize: 13 }}>
												{rollout.name}
											</Typography>
											<Typography
												sx={{
													fontFamily: monoFontFamily,
													fontSize: 10,
													color: ink.muted,
												}}
											>
												{rollout.key} · serves to rolled-out users
											</Typography>
										</Box>
										<FlagValueInput
											flagType={flagType as FlagType}
											value={rolloutValues[rollout.id]}
											onChange={(v) => handleRolloutValueChange(rollout.id, v)}
											fullWidth={false}
											size="small"
										/>
									</Box>
								))}
							</Stack>
						</Box>
					)}

					{/* A/B Tests */}
					{selectedTests.length > 0 && (
						<Box>
							<Box
								sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}
							>
								<Ms name="science" sx={{ fontSize: 19, color: '#9A6F1C' }} />
								<Typography variant="h6" sx={{ fontSize: 16 }}>
									A/B Tests
								</Typography>
							</Box>
							<Stack spacing={1.5}>
								{selectedTests.map((test) => {
									const rows = groupsForTest(test.id);
									if (rows.length === 0) {
										return null;
									}
									return (
										<Box
											key={test.id}
											sx={{
												border: `1px solid ${surface.border}`,
												borderRadius: '12px',
												p: '14px 15px',
											}}
										>
											<Typography
												sx={{ fontWeight: 700, fontSize: 14, mb: 1.25 }}
											>
												{test.name}
											</Typography>
											<Box sx={{ mb: 1 }}>
												<Label>Value per group</Label>
											</Box>
											<Stack spacing={1}>
												{rows.map((gv) => {
													const idx = Object.keys(test.variants ?? {}).indexOf(
														gv.groupName,
													);
													const color = isControl(gv.groupName)
														? CONTROL_COLOR
														: PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
													return (
														<Box
															key={`${gv.testId}-${gv.groupName}`}
															sx={{
																display: 'flex',
																alignItems: 'center',
																gap: 1.25,
																border: `1px solid ${surface.border}`,
																borderRadius: '10px',
																p: '10px 12px',
															}}
														>
															<Box
																sx={{
																	width: 9,
																	height: 9,
																	borderRadius: '3px',
																	bgcolor: color,
																	flexShrink: 0,
																}}
															/>
															<Typography
																sx={{
																	flex: 1,
																	fontWeight: 700,
																	fontSize: 13,
																	color: isControl(gv.groupName)
																		? '#8B8472'
																		: ink.primary,
																}}
															>
																{gv.groupName}
															</Typography>
															<FlagValueInput
																flagType={flagType as FlagType}
																value={gv.value}
																onChange={(v) =>
																	handleGroupValueChange(
																		gv.testId,
																		gv.groupName,
																		v,
																	)
																}
																fullWidth={false}
																size="small"
															/>
														</Box>
													);
												})}
											</Stack>
										</Box>
									);
								})}
							</Stack>
						</Box>
					)}
				</Stack>
			</DialogContent>

			<DialogActions
				sx={{
					p: '15px 22px',
					bgcolor: '#FCFAF3',
					borderTop: '1px solid #F1EBDD',
				}}
			>
				<Button variant="outlined" onClick={onClose}>
					Cancel
				</Button>
				<Button
					onClick={() => {
						void handleSave();
					}}
					disabled={saving || !validateValues()}
					startIcon={
						saving ? (
							<CircularProgress size={18} sx={{ color: '#fff' }} />
						) : (
							<Ms name="save" sx={{ fontSize: 18 }} />
						)
					}
					sx={{
						bgcolor: env.text,
						color: '#fff',
						borderRadius: '11px',
						px: 2.5,
						py: 1.25,
						fontWeight: 700,
						boxShadow: 'none',
						'&:hover': { bgcolor: env.text, opacity: 0.9, boxShadow: 'none' },
						'&.Mui-disabled': {
							bgcolor: '#C2BAA8',
							color: '#fff',
							opacity: 0.55,
						},
					}}
				>
					{saving
						? 'Assigning…'
						: `Assign Flag to ${itemCount} Item${itemCount !== 1 ? 's' : ''}`}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
