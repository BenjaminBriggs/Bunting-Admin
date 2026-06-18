'use client';

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
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { fetchRollouts, fetchTests } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { envColors, ink, monoFontFamily, surface } from '@/theme/designTokens';
import type { DBTestRollout, Environment } from '@/types';
import FlagValueInput, {
	getDefaultValueForType,
	processValueForType,
	validateValue,
} from './flag-value-input';

interface TestRolloutAssignmentModalProps {
	open: boolean;
	onClose: () => void;
	environment: Environment;
	flagId: string;
	flagName: string;
	flagType: string;
	onComplete?: () => void;
}

type Segment = 'rollout' | 'test';

// Segment accent: rollouts read green, tests read amber. These borrow the fixed
// production / development environment colours so the modal stays in the system
// palette — the accent communicates the *mode*, while the subtitle keeps the
// actual environment identity.
const SEGMENT_ACCENT: Record<Segment, { accent: string; tint: string; icon: string }> = {
	rollout: {
		accent: envColors.production.text,
		tint: envColors.production.headerBg,
		icon: 'rocket_launch',
	},
	test: {
		accent: envColors.development.text,
		tint: envColors.development.headerBg,
		icon: 'science',
	},
};

// Group swatch palette (matches the Test form / Tests card). Control reads soft + last.
const PALETTE = ['#F6A444', '#54C9C0', '#F47C5D', '#82C868', '#D8CFBC'];
const CONTROL_COLOR = '#D8CFBC';
const isControl = (name: string) => name.trim().toLowerCase() === 'control';

function Ms({ name, sx }: { name: string; sx?: any }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

function Label({ children }: { children: React.ReactNode }) {
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

export default function TestRolloutAssignmentModal({
	open,
	onClose,
	environment,
	flagId,
	flagName,
	flagType,
	onComplete,
}: TestRolloutAssignmentModalProps) {
	const router = useRouter();
	const { selectedApp } = useApp();
	const [segment, setSegment] = useState<Segment>('rollout');
	const [tests, setTests] = useState<DBTestRollout[]>([]);
	const [rollouts, setRollouts] = useState<DBTestRollout[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [servedValue, setServedValue] = useState<any>(
		getDefaultValueForType(flagType as any),
	);
	const [groupValues, setGroupValues] = useState<Record<string, any>>({});
	const [dataLoading, setDataLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const env = envColors[environment] ?? envColors.production;
	const { accent, tint, icon: segIcon } = SEGMENT_ACCENT[segment];
	const isRollout = segment === 'rollout';

	useEffect(() => {
		const load = async () => {
			if (!open || !selectedApp) {
				return;
			}
			setDataLoading(true);
			setError(null);
			setSelectedId(null);
			try {
				const [testsData, rolloutsData] = await Promise.all([
					fetchTests(selectedApp.id),
					fetchRollouts(selectedApp.id),
				]);
				setTests(testsData.filter((t) => !t.archived));
				setRollouts(rolloutsData.filter((r) => !r.archived));
			} catch (err) {
				setError(
					err instanceof Error
						? err.message
						: 'Failed to load tests and rollouts',
				);
			} finally {
				setDataLoading(false);
			}
		};
		load();
	}, [open, selectedApp]);

	// Only the items belonging to the active segment are shown / selectable.
	const options = isRollout ? rollouts : tests;
	const selected = options.find((o) => o.id === selectedId) || null;
	const isEmpty = !dataLoading && options.length === 0;

	const switchSegment = (next: Segment) => {
		if (next === segment) {
			return;
		}
		setSegment(next);
		setSelectedId(null);
		setError(null);
	};

	// Group names for the selected test, Control last.
	const selectedGroups = useMemo(() => {
		if (selected?.type !== 'TEST' || !selected.variants) {
			return [] as string[];
		}
		return Object.keys(selected.variants).sort(
			(a, b) => (isControl(a) ? 1 : 0) - (isControl(b) ? 1 : 0),
		);
	}, [selected]);

	// Initialise value control(s) when the selection changes.
	const handleSelect = (item: DBTestRollout) => {
		setSelectedId(item.id);
		setError(null);
		if (item.type === 'ROLLOUT') {
			setServedValue(getDefaultValueForType(flagType as any));
		} else {
			const init: Record<string, any> = {};
			Object.keys(item.variants || {}).forEach((g) => {
				init[g] = getDefaultValueForType(flagType as any);
			});
			setGroupValues(init);
		}
	};

	const handleCreateNew = () => {
		const path = isRollout
			? '/dashboard/rollouts/new'
			: '/dashboard/tests/new';
		onClose();
		router.push(`${path}?flagId=${flagId}`);
	};

	const valuesValid = (() => {
		if (!selected) {
			return false;
		}
		if (selected.type === 'ROLLOUT') {
			return validateValue(servedValue, flagType as any).isValid;
		}
		return selectedGroups.every(
			(g) => validateValue(groupValues[g], flagType as any).isValid,
		);
	})();

	const canAdd = Boolean(selected) && valuesValid && !saving;

	const handleAdd = async () => {
		if (!selected || !canAdd) {
			return;
		}
		setSaving(true);
		setError(null);
		try {
			if (selected.type === 'ROLLOUT') {
				const value = processValueForType(servedValue, flagType as any);
				const rolloutValues: any = { ...(selected.rolloutValues || {}) };
				rolloutValues[environment] = {
					...(rolloutValues[environment] || {}),
					[flagId]: value,
				};
				const flagIds = selected.flagIds.includes(flagId)
					? selected.flagIds
					: [...selected.flagIds, flagId];
				const res = await fetch(`/api/rollouts/${selected.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ rolloutValues, flagIds }),
				});
				if (!res.ok) {
					const text = await res.text();
					throw new Error(`Failed to update rollout ${selected.name}: ${text}`);
				}
			} else {
				const variants: any = { ...(selected.variants || {}) };
				selectedGroups.forEach((g) => {
					if (!variants[g]) {
						return;
					}
					const current = { ...variants[g] };
					const values: any = { ...(current.values || {}) };
					values[environment] = {
						...(values[environment] || {}),
						[flagId]: processValueForType(groupValues[g], flagType as any),
					};
					variants[g] = { ...current, values };
				});
				const flagIds = selected.flagIds.includes(flagId)
					? selected.flagIds
					: [...selected.flagIds, flagId];
				const res = await fetch(`/api/tests/${selected.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ variants, flagIds }),
				});
				if (!res.ok) {
					const text = await res.text();
					throw new Error(`Failed to update test ${selected.name}: ${text}`);
				}
			}
			onComplete?.();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to assign flag');
		} finally {
			setSaving(false);
		}
	};

	const defaultDisplay =
		flagType === 'json'
			? '{ … }'
			: String(getDefaultValueForType(flagType as any));

	const confirmLabel = isEmpty
		? isRollout
			? 'Create a rollout'
			: 'Create a test'
		: isRollout
			? 'Add rollout'
			: 'Add test';

	const segTabs: Array<{ value: Segment; label: string }> = [
		{ value: 'rollout', label: 'Rollouts' },
		{ value: 'test', label: 'Tests' },
	];

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			{/* header */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1.5,
					p: '18px 22px 16px',
				}}
			>
				<Box
					sx={{
						width: 40,
						height: 40,
						borderRadius: '11px',
						bgcolor: tint,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						transition: 'background .14s ease',
					}}
				>
					<Ms name={segIcon} sx={{ fontSize: 22, color: accent }} />
				</Box>
				<Box sx={{ flex: 1 }}>
					<Typography variant="h6" sx={{ fontSize: 17 }}>
						{isRollout ? 'Add to a rollout' : 'Add to a test'}
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

			{/* segmented control */}
			<Box sx={{ px: '22px', pb: '16px' }}>
				<Box
					sx={{
						display: 'flex',
						gap: '5px',
						bgcolor: '#F4F1E9',
						borderRadius: '12px',
						p: '5px',
					}}
				>
					{segTabs.map(({ value, label }) => {
						const active = segment === value;
						return (
							<Box
								key={value}
								onClick={() => switchSegment(value)}
								sx={{
									flex: 1,
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: 0.875,
									fontFamily: 'var(--font-nunito)',
									fontWeight: 700,
									fontSize: 13,
									borderRadius: '9px',
									py: '9px',
									cursor: 'pointer',
									transition: 'all .14s ease',
									bgcolor: active ? '#fff' : 'transparent',
									color: active ? ink.primary : '#8B8472',
									boxShadow: active
										? '0 1px 3px rgba(40,33,20,.14)'
										: 'none',
								}}
							>
								<Ms name={SEGMENT_ACCENT[value].icon} sx={{ fontSize: 18 }} />
								{label}
							</Box>
						);
					})}
				</Box>
			</Box>

			<DialogContent sx={{ p: '0 22px 4px' }}>
				<Stack spacing={2}>
					{error && <Alert severity="error">{error}</Alert>}

					{dataLoading && (
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								py: 2,
							}}
						>
							<CircularProgress size={20} sx={{ mr: 1.5 }} />
							<Typography sx={{ fontWeight: 600, color: ink.soft }}>
								Loading…
							</Typography>
						</Box>
					)}

					{/* empty state */}
					{isEmpty && (
						<Box
							sx={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								textAlign: 'center',
								p: '30px 16px 22px',
							}}
						>
							<Box
								sx={{
									width: 64,
									height: 64,
									borderRadius: '18px',
									bgcolor: tint,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									mb: 2.25,
								}}
							>
								<Ms name={segIcon} sx={{ fontSize: 33, color: accent }} />
							</Box>
							<Typography variant="h6" sx={{ fontSize: 19 }}>
								{isRollout ? 'No rollouts yet' : 'No tests yet'}
							</Typography>
							<Typography
								sx={{
									fontWeight: 600,
									fontSize: 13,
									lineHeight: 1.6,
									color: '#8B8472',
									mt: 0.875,
									maxWidth: 340,
								}}
							>
								{isRollout
									? 'There are no rollouts to attach this flag to. Create one first — then come back and assign.'
									: 'There are no tests to attach this flag to. Create one first — then come back and assign.'}
							</Typography>
							<Button
								onClick={handleCreateNew}
								startIcon={<Ms name="add" sx={{ fontSize: 18 }} />}
								sx={{
									mt: 2.5,
									bgcolor: accent,
									color: '#fff',
									borderRadius: '12px',
									px: 2.5,
									py: 1.375,
									fontWeight: 700,
									boxShadow: 'none',
									'&:hover': { bgcolor: accent, opacity: 0.9, boxShadow: 'none' },
								}}
							>
								{isRollout ? 'Create a new rollout' : 'Create a new test'}
							</Button>
							<Typography
								sx={{ fontWeight: 600, fontSize: 11, color: ink.faint, mt: 1.5 }}
							>
								It’ll open with this flag pre-selected.
							</Typography>
						</Box>
					)}

					{/* list state */}
					{!dataLoading && !isEmpty && (
						<>
							{/* info banner */}
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1.25,
									bgcolor: '#E4F1EE',
									border: '1px solid #CFE5E0',
									borderRadius: '11px',
									p: '11px 13px',
								}}
							>
								<Ms name="info" sx={{ fontSize: 19, color: '#3E8E84' }} />
								<Typography
									sx={{
										fontWeight: 600,
										fontSize: 12,
										lineHeight: 1.5,
										color: '#46615C',
									}}
								>
									{isRollout
										? 'Pick a rollout, then choose the value its rolled-out users receive for this flag.'
										: 'Pick a test, then set the value each group serves for this flag.'}
								</Typography>
							</Box>

							{/* pick an entity */}
							<Box>
								<Label>{isRollout ? 'Rollout' : 'Test'}</Label>
								<Stack spacing={1} sx={{ mt: 1.25 }}>
									{options.map((o) => {
										const on = o.id === selectedId;
										return (
											<Box
												key={o.id}
												onClick={() => handleSelect(o)}
												sx={{
													display: 'flex',
													alignItems: 'center',
													gap: 1.5,
													border: `1.5px solid ${on ? ink.primary : surface.borderStrong}`,
													bgcolor: on ? '#FCFAF3' : '#fff',
													borderRadius: '11px',
													p: '11px 13px',
													cursor: 'pointer',
													transition:
														'border-color .12s ease, background .12s ease',
												}}
											>
												<Box
													sx={{
														width: 18,
														height: 18,
														borderRadius: '50%',
														border: on
															? `5px solid ${ink.primary}`
															: '1.5px solid #C7C0AE',
														flexShrink: 0,
													}}
												/>
												<Box
													sx={{
														width: 30,
														height: 30,
														borderRadius: '8px',
														bgcolor: tint,
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														flexShrink: 0,
													}}
												>
													<Ms name={segIcon} sx={{ fontSize: 17, color: accent }} />
												</Box>
												<Box sx={{ flex: 1, minWidth: 0 }}>
													<Typography
														sx={{
															fontWeight: 700,
															fontSize: 13,
															color: on ? ink.primary : '#3A352C',
														}}
													>
														{o.name}
													</Typography>
													<Typography
														sx={{
															fontFamily: monoFontFamily,
															fontSize: 10,
															color: ink.muted,
														}}
													>
														{o.key}
														{o.type === 'ROLLOUT'
															? ` · ${o.percentage ?? 0}%`
															: ` · ${Object.keys(o.variants || {}).length} groups`}
													</Typography>
												</Box>
												<Box
													sx={{
														fontFamily: monoFontFamily,
														fontWeight: 700,
														fontSize: 9,
														color: accent,
														bgcolor: tint,
														borderRadius: '6px',
														px: 1,
														py: 0.375,
													}}
												>
													{o.type}
												</Box>
											</Box>
										);
									})}

									{/* inline create row */}
									<Box
										onClick={handleCreateNew}
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1.375,
											border: '1.5px dashed #E2D9C6',
											borderRadius: '11px',
											p: '11px 13px',
											cursor: 'pointer',
											transition:
												'background .12s ease, border-color .12s ease',
											'&:hover': {
												bgcolor: '#FCFAF3',
												borderColor: '#D8CFB8',
											},
										}}
									>
										<Box
											sx={{
												width: 30,
												height: 30,
												borderRadius: '8px',
												bgcolor: '#F4ECDC',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												flexShrink: 0,
												ml: '30px',
											}}
										>
											<Ms name="add" sx={{ fontSize: 18, color: '#9A6F1C' }} />
										</Box>
										<Typography
											sx={{ fontWeight: 700, fontSize: 13, color: '#3A352C' }}
										>
											{isRollout ? 'Create a new rollout' : 'Create a new test'}
										</Typography>
										<Typography
											sx={{
												ml: 'auto',
												fontWeight: 600,
												fontSize: 10,
												color: ink.faint,
											}}
										>
											opens with this flag pre-selected
										</Typography>
									</Box>
								</Stack>
							</Box>

							{/* ROLLOUT: served value */}
							{selected?.type === 'ROLLOUT' && (
								<Box>
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1,
											mb: 1.125,
										}}
									>
										<Label>Serve to rolled-out users</Label>
										<Typography
											sx={{
												ml: 'auto',
												fontWeight: 600,
												fontSize: 11,
												color: ink.faint,
											}}
										>
											everyone else gets{' '}
											<Box
												component="span"
												sx={{ fontFamily: monoFontFamily, color: ink.soft }}
											>
												{defaultDisplay}
											</Box>
										</Typography>
									</Box>
									<FlagValueInput
										flagType={flagType as any}
										value={servedValue}
										onChange={setServedValue}
										fullWidth
									/>
								</Box>
							)}

							{/* TEST: value per group */}
							{selected?.type === 'TEST' && (
								<Box>
									<Box sx={{ mb: 1.125 }}>
										<Label>Value per group</Label>
									</Box>
									<Stack spacing={1}>
										{selectedGroups.map((g) => {
											const idx = Object.keys(selected?.variants || {}).indexOf(g);
											const color = isControl(g)
												? CONTROL_COLOR
												: PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
											return (
												<Box
													key={g}
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
															color: isControl(g) ? '#8B8472' : ink.primary,
														}}
													>
														{g}
													</Typography>
													<FlagValueInput
														flagType={flagType as any}
														value={groupValues[g]}
														onChange={(v) =>
															setGroupValues((prev) => ({ ...prev, [g]: v }))
														}
														fullWidth={false}
														size="small"
													/>
												</Box>
											);
										})}
									</Stack>
								</Box>
							)}
						</>
					)}
				</Stack>
			</DialogContent>

			<DialogActions
				sx={{
					p: '15px 22px',
					bgcolor: '#FCFAF3',
					borderTop: '1px solid #F1EBDD',
					mt: 1.75,
				}}
			>
				<Button variant="outlined" onClick={onClose}>
					Cancel
				</Button>
				<Button
					onClick={handleAdd}
					disabled={isEmpty || !canAdd}
					startIcon={
						saving ? (
							<CircularProgress size={18} sx={{ color: '#fff' }} />
						) : (
							<Ms name="add" sx={{ fontSize: 18 }} />
						)
					}
					sx={{
						bgcolor: accent,
						color: '#fff',
						borderRadius: '11px',
						px: 2.5,
						py: 1.25,
						fontWeight: 700,
						boxShadow: 'none',
						'&:hover': { bgcolor: accent, opacity: 0.9, boxShadow: 'none' },
						'&.Mui-disabled': { bgcolor: '#C2BAA8', color: '#fff', opacity: 0.55 },
					}}
				>
					{confirmLabel}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
