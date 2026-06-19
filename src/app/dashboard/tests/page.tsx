'use client';

import { Box, CircularProgress, Menu, MenuItem, Typography } from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
	archiveTestRollout,
	deleteTest,
	fetchFlags,
	fetchTests,
	type Flag,
	type TestRollout,
} from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { useChanges } from '@/lib/changes-context';
import { ink, monoFontFamily, surface, typeColors } from '@/theme/designTokens';
import { CardChips } from '@/components/features/test-rollouts/CardChips';
import {
	groupByGroup,
	GroupHeader,
	hasNamedGroups,
} from '@/components/ui/group-section';

// Vibrant treatment colors (Control is rendered soft + last).
const TREATMENT_COLORS = ['#F6A444', '#54C9C0', '#F47C5D', '#82C868'];
const CONTROL_COLOR = '#D8CFBC';

interface SplitGroup {
	name: string;
	pct: number;
	color: string;
	isControl: boolean;
}

function Ms({ name, sx }: { name: string; sx?: any }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

export default function TestsPage() {
	const { selectedApp } = useApp();
	const { markChangesDetected } = useChanges();
	const router = useRouter();
	const [tests, setTests] = useState<TestRollout[]>([]);
	const [flagsById, setFlagsById] = useState<Record<string, Flag>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
	const [menuTest, setMenuTest] = useState<TestRollout | null>(null);
	const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
		{},
	);

	const loadTests = useCallback(async () => {
		if (!selectedApp) {
			return;
		}
		try {
			setLoading(true);
			const [testsData, flagsData] = await Promise.all([
				fetchTests(selectedApp.id),
				fetchFlags(selectedApp.id),
			]);
			setTests(testsData);
			const map: Record<string, Flag> = {};
			flagsData.forEach((f) => {
				map[f.id] = f;
			});
			setFlagsById(map);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load tests');
		} finally {
			setLoading(false);
		}
	}, [selectedApp]);

	useEffect(() => {
		loadTests();
	}, [loadTests]);

	const openMenu = (e: React.MouseEvent<HTMLElement>, test: TestRollout) => {
		setMenuAnchor(e.currentTarget);
		setMenuTest(test);
	};
	const closeMenu = () => {
		setMenuAnchor(null);
		setMenuTest(null);
	};

	const handleArchive = async (type: 'cancel' | 'complete') => {
		if (!menuTest) {
			return;
		}
		const id = menuTest.id;
		closeMenu();
		try {
			await archiveTestRollout(id, type);
			markChangesDetected();
			await loadTests();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to update test');
		}
	};

	const handleDelete = async () => {
		if (!menuTest) {
			return;
		}
		const id = menuTest.id;
		closeMenu();
		if (!confirm('Delete this test? This cannot be undone.')) {
			return;
		}
		try {
			await deleteTest(id);
			markChangesDetected();
			await loadTests();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to delete test');
		}
	};

	const buildSplit = (test: TestRollout): SplitGroup[] => {
		if (!test.variants) {
			return [];
		}
		const entries = Object.entries(test.variants);
		const treatments: SplitGroup[] = [];
		const controls: SplitGroup[] = [];
		let ti = 0;
		entries.forEach(([name, variant]) => {
			const isControl = name.toLowerCase() === 'control';
			const group: SplitGroup = {
				name,
				pct: (variant as any)?.percentage ?? 0,
				color: isControl
					? CONTROL_COLOR
					: TREATMENT_COLORS[ti++ % TREATMENT_COLORS.length],
				isControl,
			};
			(isControl ? controls : treatments).push(group);
		});
		return [...treatments, ...controls];
	};

	const filtered = tests.filter(
		(test) =>
			test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			test.key.toLowerCase().includes(searchTerm.toLowerCase()),
	);
	const active = filtered.filter((t) => !t.archived);
	const archived = filtered.filter((t) => t.archived);
	const activeGroups = groupByGroup(active);
	const grouped = hasNamedGroups(activeGroups);
	const toggleGroup = (name: string) =>
		setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));

	if (loading && tests.length === 0) {
		return (
			<Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
				<CircularProgress />
			</Box>
		);
	}

	const renderCard = (test: TestRollout, isArchived: boolean) => {
		const split = buildSplit(test);
		const flagChips = (test.flagIds || []).map((id) => ({
			id,
			name: flagsById[id]?.displayName || flagsById[id]?.key || id,
		}));
		return (
			<Box
				key={test.id}
				sx={{
					bgcolor: isArchived ? '#FBF8F1' : '#fff',
					border: `1.5px solid ${surface.border}`,
					borderRadius: '18px',
					p: isArchived ? '18px 22px' : '20px 22px',
					mb: 1.75,
					boxShadow: '0 1px 2px rgba(40,33,20,.03)',
					opacity: isArchived ? 0.92 : 1,
					transition: 'box-shadow .15s ease, border-color .15s ease',
					'&:hover': isArchived
						? undefined
						: { borderColor: '#E4DBC8', boxShadow: '0 6px 20px rgba(40,33,20,.07)' },
				}}
			>
				<Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75 }}>
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Typography
							sx={{
								font: "700 19px 'Baloo 2'",
								color: isArchived ? '#7E776A' : ink.primary,
							}}
						>
							{test.name}
						</Typography>
						<Typography
							sx={{
								fontFamily: monoFontFamily,
								fontWeight: 500,
								fontSize: 12,
								color: isArchived ? '#B4AC9A' : '#A79F8C',
								mt: 0.625,
							}}
						>
							{isArchived ? `${test.key} · completed` : test.key}
						</Typography>
					</Box>
					<Box
						component="button"
						onClick={(e: React.MouseEvent<HTMLElement>) => openMenu(e, test)}
						aria-label="Test actions"
						sx={{
							border: 'none',
							background: 'transparent',
							cursor: 'pointer',
							p: 0.75,
							borderRadius: '9px',
							color: '#A79F8C',
							'&:hover': { background: surface.hover },
						}}
					>
						<Ms name="more_vert" sx={{ fontSize: 22 }} />
					</Box>
				</Box>

				{split.length > 0 && (
					<Box sx={{ mt: 2.25 }}>
						<Typography sx={{ font: "600 12px 'Nunito'", color: '#8B8472', mb: 1.125 }}>
							Traffic split
						</Typography>
						<Box sx={{ display: 'flex', height: 13, borderRadius: '7px', overflow: 'hidden', gap: '2px' }}>
							{split.map((g) => (
								<Box key={g.name} sx={{ width: `${g.pct}%`, bgcolor: g.color }} />
							))}
						</Box>
						<Box sx={{ display: 'flex', gap: 2.25, mt: 1.375, flexWrap: 'wrap' }}>
							{split.map((g) => (
								<Box key={g.name} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875 }}>
									<Box sx={{ width: 9, height: 9, borderRadius: '3px', bgcolor: g.color }} />
									<Typography sx={{ font: "600 13px 'Nunito'", color: g.isControl ? '#8B8472' : '#3A352C' }}>
										{g.name}
									</Typography>
									<Typography
										sx={{
											fontFamily: monoFontFamily,
											fontWeight: 700,
											fontSize: 13,
											color: g.isControl ? '#6B6452' : ink.primary,
										}}
									>
										{g.pct}%
									</Typography>
								</Box>
							))}
						</Box>
					</Box>
				)}

				<CardChips
					conditions={test.conditions ?? []}
					flags={flagChips.map((c) => ({
						...c,
						href: `/dashboard/flags/${c.id}/edit`,
					}))}
				/>
			</Box>
		);
	};

	return (
		<Box sx={{ maxWidth: 920, mx: 'auto' }}>
			{error && (
				<Box
					sx={{
						mb: 2,
						p: '11px 14px',
						borderRadius: '11px',
						border: '1px solid #EAC7BF',
						bgcolor: '#FBEAE5',
						color: '#C8503C',
						font: "600 13px 'Nunito'",
					}}
				>
					{error}
				</Box>
			)}

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
					placeholder="Search tests by name or key…"
					sx={{
						border: 'none',
						outline: 'none',
						background: 'transparent',
						font: "600 15px 'Nunito'",
						color: ink.primary,
						width: '100%',
					}}
				/>
			</Box>

			{/* active */}
			<Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, m: '30px 2px 18px' }}>
				<Typography sx={{ font: "800 25px 'Baloo 2'", color: ink.primary }}>
					Active Tests
				</Typography>
				<Box
					sx={{
						font: "800 14px 'Baloo 2'",
						color: '#9A9483',
						bgcolor: '#EFE8D9',
						borderRadius: '20px',
						px: 1.5,
						py: 0.375,
					}}
				>
					{active.length}
				</Box>
				<Typography sx={{ ml: 'auto', font: "600 12px 'Nunito'", color: '#A79F8C' }}>
					traffic splits evenly across groups
				</Typography>
			</Box>

			{active.length === 0 ? (
				<Box
					sx={{
						bgcolor: '#fff',
						border: `1px solid ${surface.border}`,
						borderRadius: '18px',
						p: 6,
						textAlign: 'center',
					}}
				>
					<Box
						sx={{
							width: 54,
							height: 54,
							borderRadius: '15px',
							bgcolor: typeColors.test.bg,
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							mb: 1.5,
						}}
					>
						<Ms name="science" sx={{ fontSize: 28, color: typeColors.test.solid }} />
					</Box>
					<Typography sx={{ font: "700 16px 'Baloo 2'", mb: 0.5 }}>
						{searchTerm ? 'No tests match your search' : 'No tests yet'}
					</Typography>
					<Typography sx={{ font: "600 12px 'Nunito'", color: '#8B8472', mb: 2.5 }}>
						{searchTerm
							? 'Try adjusting your search terms'
							: 'Create your first A/B test to start experimenting'}
					</Typography>
					{!searchTerm && selectedApp && (
						<Box
							component={Link}
							href="/dashboard/tests/new"
							sx={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 0.75,
								textDecoration: 'none',
								fontFamily: monoFontFamily,
								fontWeight: 500,
								fontSize: 13,
								color: '#fff',
								bgcolor: ink.primary,
								borderRadius: '5px',
								p: '10px 16px',
							}}
						>
							+ Create test
						</Box>
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
							{open && group.items.map((test) => renderCard(test, false))}
						</Box>
					);
				})
			) : (
				active.map((test) => renderCard(test, false))
			)}

			{/* archived */}
			{archived.length > 0 && (
				<>
					<Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, m: '30px 2px 16px' }}>
						<Typography sx={{ font: "800 21px 'Baloo 2'", color: '#9A9483' }}>
							Archived
						</Typography>
						<Box
							sx={{
								font: "800 13px 'Baloo 2'",
								color: '#A79F8C',
								bgcolor: '#EFE8D9',
								borderRadius: '20px',
								px: 1.375,
								py: 0.25,
							}}
						>
							{archived.length}
						</Box>
					</Box>
					{archived.map((test) => renderCard(test, true))}
				</>
			)}

			{/* overflow menu */}
			<Menu
				anchorEl={menuAnchor}
				open={Boolean(menuAnchor)}
				onClose={closeMenu}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
				transformOrigin={{ vertical: 'top', horizontal: 'right' }}
				PaperProps={{ sx: { minWidth: 200, borderRadius: '13px', p: 0.75 } }}
			>
				<MenuItem
					component={Link}
					href={menuTest ? `/dashboard/tests/${menuTest.id}/edit` : '#'}
					onClick={closeMenu}
					sx={{ borderRadius: '9px', gap: 1.375 }}
				>
					<Ms name="edit" sx={{ fontSize: 19, color: '#6B6452' }} />
					<Typography sx={{ font: "700 13px 'Nunito'", color: ink.primary }}>Edit test</Typography>
				</MenuItem>
				<MenuItem onClick={() => handleArchive('cancel')} sx={{ borderRadius: '9px', gap: 1.375 }}>
					<Ms name="stop_circle" sx={{ fontSize: 19, color: '#8B8472' }} />
					<Typography sx={{ fontFamily: monoFontFamily, fontWeight: 600, fontSize: 13, color: '#3A352C' }}>
						Cancel (0%)
					</Typography>
				</MenuItem>
				<MenuItem onClick={() => handleArchive('complete')} sx={{ borderRadius: '9px', gap: 1.375 }}>
					<Ms name="check_circle" sx={{ fontSize: 19, color: '#3F7A2D' }} />
					<Typography sx={{ fontFamily: monoFontFamily, fontWeight: 600, fontSize: 13, color: '#3F7A2D' }}>
						Complete (100%)
					</Typography>
				</MenuItem>
				<MenuItem onClick={handleDelete} sx={{ borderRadius: '9px', gap: 1.375 }}>
					<Ms name="delete" sx={{ fontSize: 19, color: '#C8503C' }} />
					<Typography sx={{ font: "700 13px 'Nunito'", color: '#C8503C' }}>Delete</Typography>
				</MenuItem>
			</Menu>
		</Box>
	);
}
