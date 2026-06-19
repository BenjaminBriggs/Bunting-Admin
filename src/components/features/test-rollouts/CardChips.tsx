import type { SxProps, Theme } from '@mui/material';
import { Box } from '@mui/material';
import Link from 'next/link';
import { conditionLabel } from '@/components/features/rules/rule-templates';
import { typeColors } from '@/theme/designTokens';
import type { Condition } from '@/types/core';

function Ms({ name, sx }: { name: string; sx?: SxProps<Theme> }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

interface CardChipsProps {
	conditions: Condition[];
	flags: Array<{ id: string; name: string; href: string }>;
}

const chipBase = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 0.75,
	font: "600 12px 'Nunito'",
	borderRadius: '9px',
	p: '5px 10px',
	textDecoration: 'none',
	transition: 'background .12s ease, border-color .12s ease',
} as const;

/**
 * Bottom-of-card chip row for a test/rollout: compact targeting condition chips
 * (neutral tan) followed by affected-flag chips (flag type color). Renders nothing
 * when there are no conditions and no flags.
 */
export function CardChips({ conditions, flags }: CardChipsProps) {
	if (conditions.length === 0 && flags.length === 0) {
		return null;
	}
	return (
		<Box
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 1,
				flexWrap: 'wrap',
				mt: 2.25,
			}}
		>
			{conditions.map((c, i) => (
				<Box
					key={c.id ?? `${c.type}-${i}`}
					sx={{
						...chipBase,
						color: '#3A352C',
						bgcolor: '#FBF8F1',
						border: '1px solid #ECE5D6',
					}}
				>
					<Ms name="filter_alt" sx={{ fontSize: 14, color: '#B4AC9A' }} />
					{conditionLabel(c)}
				</Box>
			))}
			{flags.map((flag) => (
				<Box
					key={flag.id}
					component={Link}
					href={flag.href}
					sx={{
						...chipBase,
						color: typeColors.flag.text,
						bgcolor: typeColors.flag.bg,
						border: `1px solid ${typeColors.flag.border}`,
						'&:hover': { bgcolor: '#F9D9D3', borderColor: '#F0C5BD' },
					}}
				>
					<Ms name="flag" sx={{ fontSize: 14, color: typeColors.flag.solid }} />
					{flag.name}
				</Box>
			))}
		</Box>
	);
}
