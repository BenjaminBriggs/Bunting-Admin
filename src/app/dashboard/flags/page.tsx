'use client';

import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FlagRow } from '@/components';
import { fetchFlags, type Flag as FlagType } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { ink, surface, technicalButtonSx } from '@/theme/designTokens';

// Flags with no group land in this bucket, always shown last.
const UNGROUPED = 'Ungrouped';

function Ms({ name, sx }: { name: string; sx?: any }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

function SectionHeader({
	title,
	count,
	hint,
}: {
	title: string;
	count: number;
	hint?: string;
}) {
	return (
		<Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.75 }}>
			<Typography sx={{ font: "800 25px 'Baloo 2'", color: ink.primary }}>
				{title}
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
				{count}
			</Box>
			{hint && (
				<Typography sx={{ ml: 'auto', font: "600 12px 'Nunito'", color: ink.muted }}>
					{hint}
				</Typography>
			)}
		</Box>
	);
}

// Collapsible group header (chevron · name · count · divider rule).
function GroupHeader({
	name,
	count,
	open,
	muted,
	onToggle,
}: {
	name: string;
	count: number;
	open: boolean;
	muted?: boolean;
	onToggle: () => void;
}) {
	return (
		<Box
			onClick={onToggle}
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 1.25,
				p: '9px 10px',
				mb: 1,
				borderRadius: '11px',
				cursor: 'pointer',
				'&:hover': { bgcolor: surface.hover },
			}}
		>
			<Ms
				name={open ? 'expand_more' : 'chevron_right'}
				sx={{ fontSize: 22, color: muted ? '#9A9483' : '#6B6452' }}
			/>
			<Typography
				sx={{ font: "800 17px 'Baloo 2'", color: muted ? '#9A9483' : ink.primary }}
			>
				{name}
			</Typography>
			<Box
				sx={{
					font: "700 12px 'Baloo 2'",
					color: '#9A9483',
					bgcolor: '#EFE8D9',
					borderRadius: '20px',
					px: 1.25,
					py: 0.25,
				}}
			>
				{count}
			</Box>
			<Box sx={{ flex: 1, height: '1px', bgcolor: surface.border, ml: 0.75 }} />
		</Box>
	);
}

export default function FlagsPage() {
	const { selectedApp } = useApp();
	const [flags, setFlags] = useState<FlagType[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [archivedOpen, setArchivedOpen] = useState(false);
	const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
		{},
	);

	useEffect(() => {
		const loadFlags = async () => {
			if (!selectedApp) {
				return;
			}

			try {
				setLoading(true);
				const flagsData = await fetchFlags(selectedApp.id);
				setFlags(flagsData);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load flags');
			} finally {
				setLoading(false);
			}
		};

		loadFlags();
	}, [selectedApp]);

	const matchesSearch = (flag: FlagType) => {
		const q = searchTerm.toLowerCase();
		return (
			flag.displayName.toLowerCase().includes(q) ||
			flag.key.toLowerCase().includes(q)
		);
	};

	const activeFlags = flags.filter((flag) => matchesSearch(flag) && !flag.archived);
	const archivedFlags = flags.filter((flag) => matchesSearch(flag) && flag.archived);

	// Bucket active flags by their admin-only `group` label. Named groups sort
	// alphabetically; ungrouped flags always trail in an "Ungrouped" bucket.
	const groupedActive = useMemo(() => {
		const buckets = new Map<string, FlagType[]>();
		for (const flag of activeFlags) {
			const key = flag.group?.trim() || UNGROUPED;
			const list = buckets.get(key) ?? [];
			list.push(flag);
			buckets.set(key, list);
		}
		const named = [...buckets.keys()]
			.filter((k) => k !== UNGROUPED)
			.sort((a, b) => a.localeCompare(b));
		const ordered = [...named, ...(buckets.has(UNGROUPED) ? [UNGROUPED] : [])];
		return ordered.map((name) => ({ name, flags: buckets.get(name)! }));
	}, [activeFlags]);

	// Only show group chrome once at least one flag is actually grouped — a single
	// "Ungrouped" wrapper around everything would be noise.
	const hasNamedGroups = groupedActive.some((g) => g.name !== UNGROUPED);

	const toggleGroup = (name: string) =>
		setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));

	if (loading && flags.length === 0) {
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

	return (
		<Box sx={{ maxWidth: 1000, mx: 'auto' }}>
			{/* Search */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1.375,
					bgcolor: '#fff',
					border: `1px solid ${surface.border}`,
					borderRadius: '15px',
					px: 2.25,
					py: 1.625,
					boxShadow: '0 1px 2px rgba(40,33,20,.03)',
				}}
			>
				<Ms name="search" sx={{ fontSize: 22, color: '#B4AC9A' }} />
				<Box
					component="input"
					value={searchTerm}
					onChange={(e: any) => setSearchTerm(e.target.value)}
					placeholder="Search flags by name or key…"
					sx={{
						flex: 1,
						border: 'none',
						outline: 'none',
						bgcolor: 'transparent',
						font: "600 15px 'Nunito'",
						color: ink.primary,
						'&::placeholder': { color: '#B4AC9A' },
					}}
				/>
			</Box>

			{/* Empty state */}
			{activeFlags.length === 0 && archivedFlags.length === 0 ? (
				<Box
					sx={{
						bgcolor: '#fff',
						border: `1px solid ${surface.border}`,
						borderRadius: '16px',
						textAlign: 'center',
						py: 8,
						px: 3,
						mt: 4,
					}}
				>
					<Box
						sx={{
							width: 54,
							height: 54,
							borderRadius: '15px',
							bgcolor: '#FBEDC6',
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							mb: 1.5,
						}}
					>
						<Ms name="flag" sx={{ fontSize: 28, color: '#9A6F1C' }} />
					</Box>
					<Typography sx={{ font: "700 16px 'Baloo 2'", mb: 0.5 }}>
						{searchTerm ? 'No flags match your search' : 'No flags yet'}
					</Typography>
					<Typography sx={{ font: "600 12px 'Nunito'", color: '#8B8472', mb: 3 }}>
						{searchTerm
							? 'Try adjusting your search terms'
							: 'Create your first flag to start gating features.'}
					</Typography>
					{!searchTerm && selectedApp && (
						<Button
							component={Link}
							href="/dashboard/flags/new"
							startIcon={<Ms name="add" sx={{ fontSize: 18 }} />}
							sx={technicalButtonSx()}
						>
							Create Flag
						</Button>
					)}
				</Box>
			) : (
				<Box>
					{/* Active Flags */}
					{activeFlags.length > 0 && (
						<Box sx={{ mt: 3.75 }}>
							<SectionHeader
								title="Active Flags"
								count={activeFlags.length}
								hint={
									hasNamedGroups
										? 'grouped · click a group or flag to collapse'
										: 'click a flag to expand'
								}
							/>

							{hasNamedGroups ? (
								<Box sx={{ mt: 1.5 }}>
									{groupedActive.map((group) => {
										const open = !collapsedGroups[group.name];
										return (
											<Box key={group.name} sx={{ mt: 2.25 }}>
												<GroupHeader
													name={group.name}
													count={group.flags.length}
													open={open}
													muted={group.name === UNGROUPED}
													onToggle={() => toggleGroup(group.name)}
												/>
												{open && (
													<Stack spacing={1.375}>
														{group.flags.map((flag) => (
															<FlagRow key={flag.id} flag={flag} />
														))}
													</Stack>
												)}
											</Box>
										);
									})}
								</Box>
							) : (
								<Stack spacing={1.375} sx={{ mt: 2 }}>
									{activeFlags.map((flag) => (
										<FlagRow key={flag.id} flag={flag} />
									))}
								</Stack>
							)}
						</Box>
					)}

					{/* Archived Flags — collapsible group */}
					{archivedFlags.length > 0 && (
						<Box sx={{ mt: 3.25 }}>
							<GroupHeader
								name="Archived"
								count={archivedFlags.length}
								open={archivedOpen}
								muted
								onToggle={() => setArchivedOpen((v) => !v)}
							/>
							{archivedOpen && (
								<Stack spacing={1.375} sx={{ mt: 1 }}>
									{archivedFlags.map((flag) => (
										<FlagRow key={flag.id} flag={flag} archived />
									))}
								</Stack>
							)}
						</Box>
					)}
				</Box>
			)}
		</Box>
	);
}
