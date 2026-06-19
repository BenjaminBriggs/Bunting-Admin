'use client';

import { Button, Stack, TextField, Typography } from '@mui/material';
import { type ChangeEvent, useState } from 'react';
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

	const handleStringChange = (e: ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.value);
	};

	const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
		const inputValue = e.target.value;
		if (inputValue === '') {
			onChange(type === 'int' ? 0 : 0.0);
			return;
		}

		const numValue =
			type === 'int' ? parseInt(inputValue, 10) : parseFloat(inputValue);
		if (!isNaN(numValue)) {
			onChange(numValue);
		}
	};

	const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
		const inputValue = e.target.value;
		if (inputValue) {
			// Convert HTML datetime-local to ISO8601
			const isoValue = new Date(inputValue).toISOString();
			onChange(isoValue);
		}
	};

	const handleJsonChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
		const inputValue = e.target.value;
		setJsonError(null);

		if (!inputValue.trim()) {
			onChange({});
			return;
		}

		try {
			const parsed = JSON.parse(inputValue) as FlagValue;
			onChange(parsed);
		} catch {
			setJsonError('Invalid JSON syntax');
		}
	};

	const formatDateForInput = (isoString: string): string => {
		return isoString.slice(0, 16); // Remove seconds and timezone for datetime-local input
	};

	return (
		<Stack spacing={1.5}>
			<Typography variant="subtitle2">Default Value</Typography>

			{type === 'bool' && (
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

			{type === 'string' && (
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

			{(type === 'int' || type === 'double') && (
				<TextField
					type="number"
					value={value}
					onChange={handleNumberChange}
					placeholder={
						type === 'int'
							? 'Enter default integer'
							: 'Enter default number'
					}
					inputProps={{ step: type === 'double' ? 'any' : '1' }}
					disabled={disabled}
					fullWidth
					size="small"
				/>
			)}

			{type === 'date' && (
				<TextField
					type="datetime-local"
					value={typeof value === 'string' ? formatDateForInput(value) : ''}
					onChange={handleDateChange}
					disabled={disabled}
					fullWidth
					size="small"
				/>
			)}

			{type === 'json' && (
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
