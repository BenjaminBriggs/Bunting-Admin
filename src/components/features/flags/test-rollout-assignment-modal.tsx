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

	const allOptions = useMemo(
		() => [...rollouts, ...tests],
		[rollouts, tests],
	);
	const selected = allOptions.find((o) => o.id === selectedId) || null;
	const selectedIsTest = selected?.type === 'TEST';
	const selectedIsRollout = selected?.type === 'ROLLOUT';

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

	const handleCreateNew = (type: 'test' | 'rollout') => {
		const path =
			type === 'test' ? '/dashboard/tests/new' : '/dashboard/rollouts/new';
		onClose();
		router.push(`${path}?flagId=${flagId}`);
	};

	const valuesValid = (() => {
		if (selectedIsRollout) {
			return validateValue(servedValue, flagType as any).isValid;
		}
		if (selectedIsTest) {
			return selectedGroups.every(
				(g) => validateValue(groupValues[g], flagType as any).isValid,
			);
		}
		return false;
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
					throw new Error(`Failed to update rollout ${selected.name}`);
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

	const confirmLabel = selectedIsRollout
		? 'Add rollout'
		: selectedIsTest
			? 'Add test'
			: 'Add to flag';
	const headerIcon = selectedIsTest ? 'science' : 'rocket_launch';
	const defaultDisplay =
		flagType === 'json'
			? '{ … }'
			: String(getDefaultValueForType(flagType as any));

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
						{selectedIsRollout
							? 'Add to a rollout'
							: selectedIsTest
								? 'Add to a test'
								: 'Add to a test or rollout'}
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
					{error && <Alert severity="error">{error}</Alert>}

					{dataLoading && (
						<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
							<CircularProgress size={20} sx={{ mr: 1.5 }} />
							<Typography sx={{ fontWeight: 600, color: ink.soft }}>
								Loading…
							</Typography>
						</Box>
					)}

					{/* pick an entity */}
					{!dataLoading && (
						<Box>
							<Label>Select a test or rollout</Label>
							{allOptions.length === 0 ? (
								<Typography sx={{ fontWeight: 600, fontSize: 12, color: ink.muted, mt: 1 }}>
									No active tests or rollouts yet — create one below.
								</Typography>
							) : (
								<Stack spacing={1} sx={{ mt: 1 }}>
									{allOptions.map((o) => {
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
													transition: 'border-color .12s ease, background .12s ease',
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
												<Ms
													name={o.type === 'TEST' ? 'science' : 'rocket_launch'}
													sx={{ fontSize: 19, color: '#B4AC9A' }}
												/>
												<Box sx={{ flex: 1, minWidth: 0 }}>
													<Typography
														sx={{ fontWeight: 700, fontSize: 13, color: on ? ink.primary : '#3A352C' }}
													>
														{o.name}
													</Typography>
													<Typography
														sx={{ fontFamily: monoFontFamily, fontSize: 10, color: ink.muted }}
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
														color: ink.soft,
														bgcolor: surface.token,
														borderRadius: '5px',
														px: 0.875,
														py: 0.375,
													}}
												>
													{o.type}
												</Box>
											</Box>
										);
									})}
								</Stack>
							)}
						</Box>
					)}

					{/* ROLLOUT: served value */}
					{selectedIsRollout && (
						<Box>
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.125 }}>
								<Label>Serve to rolled-out users</Label>
								<Typography sx={{ ml: 'auto', fontWeight: 600, fontSize: 11, color: '#B4AC9A' }}>
									everyone else gets{' '}
									<Box component="span" sx={{ fontFamily: monoFontFamily, color: ink.soft }}>
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
					{selectedIsTest && (
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
											<Box sx={{ width: 9, height: 9, borderRadius: '3px', bgcolor: color, flexShrink: 0 }} />
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

					<Box sx={{ height: '1px', bgcolor: '#F1EBDD' }} />

					{/* Create new */}
					<Box>
						<Label>Or create new</Label>
						<Stack direction="row" spacing={2} sx={{ mt: 1 }}>
							<Button
								onClick={() => handleCreateNew('test')}
								startIcon={<Ms name="science" sx={{ fontSize: 19 }} />}
								sx={{
									flex: 1,
									bgcolor: '#fff',
									border: '1.5px solid #E2D9C6',
									color: '#3A352C',
									borderRadius: '11px',
									py: 1.25,
									fontWeight: 700,
									'&:hover': { borderColor: '#D8CFBC', bgcolor: surface.hover },
								}}
							>
								Create A/B Test
							</Button>
							<Button
								onClick={() => handleCreateNew('rollout')}
								startIcon={<Ms name="rocket_launch" sx={{ fontSize: 19 }} />}
								sx={{
									flex: 1,
									bgcolor: '#fff',
									border: '1.5px solid #E2D9C6',
									color: '#3A352C',
									borderRadius: '11px',
									py: 1.25,
									fontWeight: 700,
									'&:hover': { borderColor: '#D8CFBC', bgcolor: surface.hover },
								}}
							>
								Create Rollout
							</Button>
						</Stack>
					</Box>
				</Stack>
			</DialogContent>

			<DialogActions
				sx={{ p: '15px 22px', bgcolor: '#FCFAF3', borderTop: '1px solid #F1EBDD' }}
			>
				<Button variant="outlined" onClick={onClose}>
					Cancel
				</Button>
				<Button
					onClick={handleAdd}
					disabled={!canAdd}
					startIcon={
						saving ? (
							<CircularProgress size={18} sx={{ color: '#fff' }} />
						) : (
							<Ms name="add" sx={{ fontSize: 18 }} />
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
						'&.Mui-disabled': { bgcolor: '#C2BAA8', color: '#fff', opacity: 0.55 },
					}}
				>
					{confirmLabel}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
