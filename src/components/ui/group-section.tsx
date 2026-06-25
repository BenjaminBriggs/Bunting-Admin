'use client';

// Shared admin-only grouping primitives for the Flags / Tests / Rollouts lists.
// Grouping is purely organizational — the `group` label never reaches the
// published config artifact.

import { Box, Typography } from '@mui/material';
import { ink, surface } from '@/theme/designTokens';

export const UNGROUPED = 'Ungrouped';

function Ms({ name, sx }: { name: string; sx?: any }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

/**
 * Bucket items by their admin `group` label. Named groups sort alphabetically;
 * items with no group fall into a trailing "Ungrouped" bucket.
 */
export function groupByGroup<T extends { group?: string | null }>(
	items: T[],
): Array<{ name: string; items: T[] }> {
	const buckets = new Map<string, T[]>();
	for (const item of items) {
		const key = item.group?.trim() || UNGROUPED;
		const list = buckets.get(key) ?? [];
		list.push(item);
		buckets.set(key, list);
	}
	const named = [...buckets.keys()]
		.filter((k) => k !== UNGROUPED)
		.sort((a, b) => a.localeCompare(b));
	const ordered = [...named, ...(buckets.has(UNGROUPED) ? [UNGROUPED] : [])];
	return ordered.map((name) => ({ name, items: buckets.get(name)! }));
}

/** True once at least one item carries a real group label. */
export function hasNamedGroups(groups: Array<{ name: string }>): boolean {
	return groups.some((g) => g.name !== UNGROUPED);
}

/** Collapsible group / section header (chevron · name · count · rule). */
export function GroupHeader({
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
				sx={{
					font: "800 17px 'Baloo 2'",
					color: muted ? '#9A9483' : ink.primary,
				}}
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
