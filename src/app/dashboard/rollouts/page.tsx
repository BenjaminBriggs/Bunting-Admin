'use client';

import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Menu,
	MenuItem,
	Slider,
	Typography,
} from '@mui/material';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
	archiveTestRollout,
	fetchRollouts,
	type TestRollout,
	updateRolloutPercentage,
} from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { danger, ink, monoFontFamily, surface } from '@/theme/designTokens';
import {
	groupByGroup,
	GroupHeader,
	hasNamedGroups,
} from '@/components/ui/group-section';

// Material Symbols glyph.
function Ms({ name, sx }: { name: string; sx?: any }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

export default function RolloutsPage() {
	const { selectedApp } = useApp();
	const [rollouts, setRollouts] = useState<TestRollout[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [updatingRollouts, setUpdatingRollouts] = useState<Set<string>>(
		new Set(),
	);
	const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
	const [menuRolloutId, setMenuRolloutId] = useState<string | null>(null);
	const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
		{},
	);

	useEffect(() => {
		const loadRollouts = async () => {
			if (!selectedApp) {
				return;
			}
			try {
				setLoading(true);
				const rolloutsData = await fetchRollouts(selectedApp.id);
				setRollouts(rolloutsData);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : 'Failed to load rollouts',
				);
			} finally {
				setLoading(false);
			}
		};

		loadRollouts();
	}, [selectedApp]);

	const filteredRollouts = rollouts.filter(
		(rollout) =>
			rollout.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			rollout.key.toLowerCase().includes(searchTerm.toLowerCase()),
	);
	const activeRollouts = filteredRollouts.filter((r) => !r.archived);
	const archivedRollouts = filteredRollouts.filter((r) => r.archived);
	const activeGroups = groupByGroup(activeRollouts);
	const grouped = hasNamedGroups(activeGroups);
	const toggleGroup = (name: string) =>
		setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));

	const handlePercentageChange = async (
		rolloutId: string,
		newPercentage: number,
	) => {
		setUpdatingRollouts((prev) => new Set(prev).add(rolloutId));
		try {
			const updated = await updateRolloutPercentage(rolloutId, newPercentage);
			setRollouts((prev) =>
				prev.map((r) => (r.id === rolloutId ? updated : r)),
			);
		} catch (err) {
			console.error('Failed to update rollout percentage:', err);
		} finally {
			setUpdatingRollouts((prev) => {
				const newSet = new Set(prev);
				newSet.delete(rolloutId);
				return newSet;
			});
		}
	};

	const handleArchive = async (
		rolloutId: string,
		type: 'cancel' | 'complete',
	) => {
		closeMenu();
		try {
			const updated = await archiveTestRollout(rolloutId, type);
			setRollouts((prev) =>
				prev.map((r) => (r.id === rolloutId ? updated : r)),
			);
		} catch (err) {
			console.error('Failed to archive rollout:', err);
		}
	};

	const openMenu = (e: React.MouseEvent<HTMLElement>, id: string) => {
		setMenuAnchor(e.currentTarget);
		setMenuRolloutId(id);
	};
	const closeMenu = () => {
		setMenuAnchor(null);
		setMenuRolloutId(null);
	};

	if (loading && rollouts.length === 0) {
		return (
			<Box
				display="flex"
				justifyContent="center"
				alignItems="center"
				minHeight="400px"
			>
				<CircularProgress />
			</Box>
		);
	}

	if (error) {
		return (
			<Alert severity="error" sx={{ mb: 3 }}>
				{error}
			</Alert>
		);
	}

	const countPillSx = {
		font: "800 14px 'Baloo 2'",
		color: '#9A9483',
		bgcolor: '#EFE8D9',
		borderRadius: '20px',
		px: 1.5,
		py: 0.375,
	} as const;

	const renderRolloutCard = (rollout: TestRollout) => {
		const pct = rollout.percentage || 0;
		const busy = updatingRollouts.has(rollout.id);
		return (
			<Box
				key={rollout.id}
				sx={{
					bgcolor: '#fff',
					border: `1.5px solid ${surface.border}`,
					borderRadius: '18px',
					p: '20px 22px',
					mb: 1.75,
					boxShadow: '0 1px 2px rgba(40,33,20,.03)',
					transition: 'box-shadow .15s ease, border-color .15s ease',
					'&:hover': {
						borderColor: '#E4DBC8',
						boxShadow: '0 6px 20px rgba(40,33,20,.07)',
					},
				}}
			>
				<Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75 }}>
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Typography sx={{ font: "700 19px 'Baloo 2'" }}>
							{rollout.name}
						</Typography>
						<Typography sx={{ font: `500 12px ${monoFontFamily}`, color: '#A79F8C', mt: 0.625 }}>
							{rollout.key}
						</Typography>
					</Box>
					<Box
						component="span"
						className="ms"
						onClick={(e: React.MouseEvent<HTMLElement>) => openMenu(e, rollout.id)}
						sx={{
							fontSize: 22,
							color: '#A79F8C',
							p: 0.75,
							borderRadius: '9px',
							cursor: 'pointer',
							'&:hover': { bgcolor: surface.hover },
						}}
					>
						more_vert
					</Box>
				</Box>

				{/* affected flags */}
				{rollout.flagIds.length > 0 && (
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1.875 }}>
						{rollout.flagIds.map((flagId) => (
							<Box
								key={flagId}
								component={Link}
								href="/dashboard/flags"
								sx={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: 0.75,
									font: "600 12px 'Nunito'",
									color: '#3A352C',
									bgcolor: '#FBF8F1',
									border: '1px solid #ECE5D6',
									borderRadius: '9px',
									px: 1.25,
									py: 0.625,
									textDecoration: 'none',
									transition: 'background .12s ease, border-color .12s ease',
									'&:hover': { bgcolor: '#F4ECDC', borderColor: '#E0D6C2' },
								}}
							>
								<Ms name="flag" sx={{ fontSize: 14, color: '#B4AC9A' }} />
								{flagId}
							</Box>
						))}
					</Box>
				)}

				{/* percent control */}
				<Box sx={{ mt: 2.25 }}>
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'baseline',
							mb: 1,
						}}
					>
						<Typography sx={{ font: "600 12px 'Nunito'", color: '#8B8472' }}>
							Rollout percentage
						</Typography>
						<Typography sx={{ font: `700 22px ${monoFontFamily}`, color: ink.primary }}>
							{pct}%
						</Typography>
					</Box>
					<Box sx={{ px: 0.5 }}>
						<Slider
							value={pct}
							onChange={(_, value) => {
								setRollouts((prev) =>
									prev.map((r) =>
										r.id === rollout.id
											? { ...r, percentage: value }
											: r,
									),
								);
							}}
							onChangeCommitted={(_, value) => {
								handlePercentageChange(rollout.id, value);
							}}
							disabled={busy}
							min={0}
							max={100}
							step={5}
							marks={[
								{ value: 0, label: '0%' },
								{ value: 50, label: '50%' },
								{ value: 100, label: '100%' },
							]}
							sx={{
								color: ink.primary,
								height: 10,
								'& .MuiSlider-rail': {
									backgroundColor: '#EFE8DA',
									opacity: 1,
									borderRadius: 6,
								},
								'& .MuiSlider-track': {
									border: 'none',
									backgroundColor: ink.primary,
									borderRadius: 6,
								},
								'& .MuiSlider-thumb': {
									width: 22,
									height: 22,
									backgroundColor: '#fff',
									border: `2.5px solid ${ink.primary}`,
									boxShadow: '0 2px 6px rgba(0,0,0,.18)',
									'&:hover, &.Mui-focusVisible': {
										boxShadow: '0 2px 8px rgba(0,0,0,.22)',
									},
								},
								'& .MuiSlider-markLabel': {
									fontFamily: monoFontFamily,
									fontSize: 10,
									color: '#B4AC9A',
								},
								'& .MuiSlider-mark': { display: 'none' },
							}}
						/>
					</Box>
				</Box>
			</Box>
		);
	};

	return (
		<Box sx={{ maxWidth: 920, mx: 'auto', px: 1, pb: 6 }}>
			{/* search */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1.375,
					bgcolor: '#fff',
					border: `1px solid ${surface.border}`,
					borderRadius: '15px',
					p: '13px 18px',
					boxShadow: '0 1px 2px rgba(40,33,20,.03)',
				}}
			>
				<Ms name="search" sx={{ fontSize: 22, color: '#B4AC9A' }} />
				<Box
					component="input"
					value={searchTerm}
					onChange={(e: any) => setSearchTerm(e.target.value)}
					placeholder="Search rollouts by name or key…"
					sx={{
						border: 'none',
						outline: 'none',
						bgcolor: 'transparent',
						font: "600 15px 'Nunito'",
						color: ink.primary,
						width: '100%',
					}}
				/>
			</Box>

			{/* section header */}
			<Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, m: '30px 2px 18px' }}>
				<Typography sx={{ font: "800 25px 'Baloo 2'", color: ink.primary }}>
					Active Rollouts
				</Typography>
				<Box sx={countPillSx}>{activeRollouts.length}</Box>
				<Typography sx={{ ml: 'auto', font: "600 12px 'Nunito'", color: '#A79F8C' }}>
					drag a slider to ramp · saves live
				</Typography>
			</Box>

			{activeRollouts.length === 0 ? (
				<Box
					sx={{
						bgcolor: '#fff',
						border: `1.5px solid ${surface.border}`,
						borderRadius: '18px',
						p: 6,
						textAlign: 'center',
					}}
				>
					<Ms name="rocket_launch" sx={{ fontSize: 44, color: '#C2BAA8' }} />
					<Typography sx={{ font: "700 18px 'Baloo 2'", mt: 1 }}>
						{searchTerm ? 'No rollouts match your search' : 'No rollouts yet'}
					</Typography>
					<Typography sx={{ font: "600 13px 'Nunito'", color: '#8B8472', mt: 0.5, mb: 2 }}>
						{searchTerm
							? 'Try adjusting your search terms'
							: 'Create your first rollout to start a gradual release'}
					</Typography>
					{!searchTerm && selectedApp && (
						<Button
							variant="contained"
							component={Link}
							href="/dashboard/rollouts/new"
							startIcon={<Ms name="add" sx={{ fontSize: 18 }} />}
						>
							Create rollout
						</Button>
					)}
				</Box>
			) : grouped ? (
				activeGroups.map((group) => {
					const open = !collapsedGroups[group.name];
					return (
						<Box key={group.name} sx={{ mt: 2.25 }}>
							<GroupHeader
								name={group.name}
								count={group.items.length}
								open={open}
								muted={group.name === 'Ungrouped'}
								onToggle={() => toggleGroup(group.name)}
							/>
							{open && group.items.map((rollout) => renderRolloutCard(rollout))}
						</Box>
					);
				})
			) : (
				activeRollouts.map((rollout) => renderRolloutCard(rollout))
			)}

			{/* archived */}
			{archivedRollouts.length > 0 && (
				<>
					<Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, m: '30px 2px 16px' }}>
						<Typography sx={{ font: "800 21px 'Baloo 2'", color: '#9A9483' }}>
							Archived
						</Typography>
						<Box sx={{ ...countPillSx, font: "800 13px 'Baloo 2'", color: '#A79F8C' }}>
							{archivedRollouts.length}
						</Box>
					</Box>
					{archivedRollouts.map((rollout) => {
						const pct = rollout.percentage || 0;
						const complete = pct >= 100;
						return (
							<Box
								key={rollout.id}
								sx={{
									bgcolor: '#FBF8F1',
									border: `1.5px solid ${surface.border}`,
									borderRadius: '18px',
									p: '18px 22px',
									mb: 1.5,
									opacity: 0.92,
									display: 'flex',
									alignItems: 'center',
									gap: 1.75,
								}}
							>
								<Box sx={{ flex: 1, minWidth: 0 }}>
									<Typography sx={{ font: "700 18px 'Baloo 2'", color: '#7E776A' }}>
										{rollout.name}
									</Typography>
									<Typography sx={{ font: `500 12px ${monoFontFamily}`, color: '#B4AC9A', mt: 0.5 }}>
										{rollout.key} · shipped at {pct}%
									</Typography>
								</Box>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.125, width: 170 }}>
									<Box
										sx={{
											flex: 1,
											height: 8,
											borderRadius: '5px',
											bgcolor: complete ? '#DEF3F0' : '#EFE8DA',
											position: 'relative',
										}}
									>
										<Box
											sx={{
												position: 'absolute',
												inset: 0,
												width: `${pct}%`,
												bgcolor: complete ? '#54C9C0' : ink.primary,
												borderRadius: '5px',
											}}
										/>
									</Box>
									<Typography
										sx={{
											font: `700 13px ${monoFontFamily}`,
											color: complete ? '#1E7B72' : ink.soft,
										}}
									>
										{pct}%
									</Typography>
								</Box>
							</Box>
						);
					})}
				</>
			)}

			{/* overflow menu */}
			<Menu
				anchorEl={menuAnchor}
				open={Boolean(menuAnchor)}
				onClose={closeMenu}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
				transformOrigin={{ vertical: 'top', horizontal: 'right' }}
				slotProps={{ paper: { sx: { minWidth: 196, borderRadius: '13px', p: 0.75 } } }}
			>
				<MenuItem
					component={Link}
					href={
						menuRolloutId
							? `/dashboard/rollouts/${menuRolloutId}/edit`
							: '/dashboard/rollouts'
					}
					onClick={closeMenu}
					sx={{ borderRadius: '9px', gap: 1.375 }}
				>
					<Ms name="edit" sx={{ fontSize: 19, color: ink.soft }} />
					<Typography sx={{ font: "700 13px 'Nunito'" }}>Edit rollout</Typography>
				</MenuItem>
				<Box sx={{ height: '1px', bgcolor: '#F1EBDD', m: '5px 4px' }} />
				<MenuItem
					onClick={() => menuRolloutId && handleArchive(menuRolloutId, 'cancel')}
					sx={{ borderRadius: '9px', gap: 1.375 }}
				>
					<Ms name="stop_circle" sx={{ fontSize: 19, color: '#8B8472' }} />
					<Typography sx={{ font: `600 13px ${monoFontFamily}`, color: '#3A352C' }}>
						Cancel (0%)
					</Typography>
				</MenuItem>
				<MenuItem
					onClick={() => menuRolloutId && handleArchive(menuRolloutId, 'complete')}
					sx={{ borderRadius: '9px', gap: 1.375 }}
				>
					<Ms name="check_circle" sx={{ fontSize: 19, color: '#3F7A2D' }} />
					<Typography sx={{ font: `600 13px ${monoFontFamily}`, color: '#3F7A2D' }}>
						Complete (100%)
					</Typography>
				</MenuItem>
			</Menu>
		</Box>
	);
}
