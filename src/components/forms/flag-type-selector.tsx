'use client';

import { Box, Button, Stack, Typography } from '@mui/material';
import type { FlagType } from '@/types';

interface FlagTypeSelectorProps {
	value: FlagType;
	onChange: (type: FlagType) => void;
	disabled?: boolean;
}

interface FlagTypeOption {
	value: FlagType;
	label: string;
	description: string;
	example: string;
}

const flagTypes: FlagTypeOption[] = [
	{
		value: 'bool',
		label: 'Boolean',
		description: 'True/false values',
		example: 'true',
	},
	{
		value: 'string',
		label: 'String',
		description: 'Text values',
		example: '"Welcome!"',
	},
	{
		value: 'int',
		label: 'Integer',
		description: 'Whole numbers',
		example: '42',
	},
	{
		value: 'double',
		label: 'Number',
		description: 'Decimal numbers',
		example: '3.14',
	},
	{
		value: 'date',
		label: 'Date',
		description: 'ISO8601 timestamps',
		example: '2025-09-11T15:30:00Z',
	},
	{
		value: 'json',
		label: 'JSON',
		description: 'Complex objects',
		example: '{"key": "value"}',
	},
];

export function FlagTypeSelector({
	value,
	onChange,
	disabled = false,
}: FlagTypeSelectorProps) {
	return (
		<Stack spacing={1.5}>
			<Typography variant="subtitle2">Flag Type</Typography>

			<Box
				sx={{
					display: 'grid',
					gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
					gap: 1.5,
				}}
			>
				{flagTypes.map((type) => (
					<Button
						key={type.value}
						variant={value === type.value ? 'contained' : 'outlined'}
						onClick={() => onChange(type.value)}
						disabled={disabled}
						sx={{
							height: 'auto',
							p: 2,
							flexDirection: 'column',
							alignItems: 'flex-start',
							gap: 1,
							textTransform: 'none',
						}}
					>
						<Typography sx={{ fontWeight: 600 }}>{type.label}</Typography>
						<Typography variant="caption" color="text.secondary">
							{type.description}
						</Typography>
						<Box
							component="code"
							sx={{
								px: 1,
								py: 0.5,
								borderRadius: 1,
								bgcolor: 'action.hover',
								fontFamily: 'monospace',
								fontSize: '0.75rem',
							}}
						>
							{type.example}
						</Box>
					</Button>
				))}
			</Box>

			<Typography variant="body2" color="text.secondary">
				Choose the data type for your flag values. This affects how values are
				validated and displayed.
			</Typography>
		</Stack>
	);
}
