'use client';

import { Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { FlagType, FlagValue } from '@/types';

interface DefaultValueEditorProps {
	type: FlagType;
	value: FlagValue;
	onChange: (value: FlagValue) => void;
	disabled?: boolean;
}

export function DefaultValueEditor({
	type,
	value,
	onChange,
	disabled = false,
}: DefaultValueEditorProps) {
	const [jsonError, setJsonError] = useState<string | null>(null);

	const handleBoolChange = (newValue: boolean) => {
		onChange(newValue);
	};

	const handleStringChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.value);
	};

	const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const inputValue = e.target.value;
		if (inputValue === '') {
			onChange((type as any) === 'int' ? 0 : 0.0);
			return;
		}

		const numValue =
			(type as any) === 'int'
				? parseInt(inputValue, 10)
				: parseFloat(inputValue);
		if (!isNaN(numValue)) {
			onChange(numValue);
		}
	};

	const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const inputValue = e.target.value;
		if (inputValue) {
			// Convert HTML datetime-local to ISO8601
			const isoValue = new Date(inputValue).toISOString();
			onChange(isoValue);
		}
	};

	const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const inputValue = e.target.value;
		setJsonError(null);

		if (!inputValue.trim()) {
			onChange({});
			return;
		}

		try {
			const parsed = JSON.parse(inputValue);
			onChange(parsed);
		} catch (error) {
			setJsonError('Invalid JSON syntax');
		}
	};

	const formatDateForInput = (isoString: string): string => {
		return isoString.slice(0, 16); // Remove seconds and timezone for datetime-local input
	};

	return (
		<Stack spacing={1.5}>
			<Typography variant="subtitle2">Default Value</Typography>

			{(type as any) === 'bool' && (
				<Stack direction="row" spacing={2}>
					<Button
						type="button"
						variant={value === true ? 'contained' : 'outlined'}
						onClick={() => handleBoolChange(true)}
						disabled={disabled}
					>
						True
					</Button>
					<Button
						type="button"
						variant={value === false ? 'contained' : 'outlined'}
						onClick={() => handleBoolChange(false)}
						disabled={disabled}
					>
						False
					</Button>
				</Stack>
			)}

			{(type as any) === 'string' && (
				<TextField
					type="text"
					value={value}
					onChange={handleStringChange}
					placeholder="Enter default string value"
					disabled={disabled}
					fullWidth
					size="small"
				/>
			)}

			{((type as any) === 'int' || (type as any) === 'double') && (
				<TextField
					type="number"
					value={value}
					onChange={handleNumberChange}
					placeholder={
						(type as any) === 'int'
							? 'Enter default integer'
							: 'Enter default number'
					}
					inputProps={{ step: (type as any) === 'double' ? 'any' : '1' }}
					disabled={disabled}
					fullWidth
					size="small"
				/>
			)}

			{(type as any) === 'date' && (
				<TextField
					type="datetime-local"
					value={typeof value === 'string' ? formatDateForInput(value) : ''}
					onChange={handleDateChange}
					disabled={disabled}
					fullWidth
					size="small"
				/>
			)}

			{(type as any) === 'json' && (
				<TextField
					multiline
					minRows={5}
					value={JSON.stringify(value, null, 2)}
					onChange={handleJsonChange}
					placeholder='{"key": "value"}'
					disabled={disabled}
					error={Boolean(jsonError)}
					helperText={jsonError ?? undefined}
					fullWidth
					size="small"
					InputProps={{
						sx: { fontFamily: 'monospace', fontSize: '0.8125rem' },
					}}
				/>
			)}

			<Typography variant="body2" color="text.secondary">
				This value will be returned when no rules match or when rules cannot be
				evaluated.
			</Typography>
		</Stack>
	);
}
