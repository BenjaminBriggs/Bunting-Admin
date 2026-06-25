'use client';

import { Box, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import {
	generateDisplayName,
	normalizeToIdentifierKey,
	validateIdentifierKey,
} from '@/lib/validation';

interface FlagKeyInputProps {
	value: string;
	onChange: (value: string, normalizedKey: string, displayName: string) => void;
	placeholder?: string;
	disabled?: boolean;
}

const codeSx = {
	ml: 1,
	px: 1,
	py: 0.5,
	borderRadius: 1,
	bgcolor: 'background.paper',
	fontFamily: 'monospace',
	fontSize: '0.8125rem',
} as const;

export function FlagKeyInput({
	value,
	onChange,
	placeholder = 'e.g., Store: Use New Paywall Design',
	disabled = false,
}: FlagKeyInputProps) {
	const [inputValue, setInputValue] = useState(value);

	// Derived state — computed during render from inputValue.
	const { normalizedKey, displayName, validation, showPreview } =
		useMemo(() => {
			if (inputValue) {
				const normalized = normalizeToIdentifierKey(inputValue);
				return {
					normalizedKey: normalized,
					displayName: generateDisplayName(normalized),
					validation: validateIdentifierKey(normalized),
					showPreview: true,
				};
			}
			return {
				normalizedKey: '',
				displayName: '',
				validation: { valid: true },
				showPreview: false,
			};
		}, [inputValue]);

	// Notify the parent of the resolved key whenever the input (and thus the
	// derived values) change. This is the genuine effect: syncing to the parent.
	useEffect(() => {
		if (inputValue) {
			if (validation.valid) {
				onChange(inputValue, normalizedKey, displayName);
			}
		} else {
			onChange('', '', '');
		}
	}, [inputValue, normalizedKey, displayName, validation.valid, onChange]);

	const swiftAccessor = normalizedKey
		.replace(/\//g, '.')
		.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

	return (
		<Stack spacing={1.5}>
			<TextField
				label="Flag Name"
				value={inputValue}
				onChange={(e) => setInputValue(e.target.value)}
				placeholder={placeholder}
				disabled={disabled}
				error={!validation.valid}
				helperText={!validation.valid ? validation.error : undefined}
				fullWidth
			/>

			{showPreview && (
				<Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
					<Stack spacing={1}>
						<Typography variant="body2">
							<Typography component="span" color="text.secondary">
								Key:
							</Typography>
							<Box component="code" sx={codeSx}>
								{normalizedKey}
							</Box>
						</Typography>

						<Typography variant="body2">
							<Typography component="span" color="text.secondary">
								Display Name:
							</Typography>
							<Box component="span" sx={{ ml: 1, fontWeight: 600 }}>
								{displayName}
							</Box>
						</Typography>

						<Typography variant="body2">
							<Typography component="span" color="text.secondary">
								Swift Accessor:
							</Typography>
							<Box component="code" sx={codeSx}>
								Bunting.shared.{swiftAccessor}
							</Box>
						</Typography>
					</Stack>
				</Box>
			)}

			<Typography variant="body2" color="text.secondary">
				Enter a natural name - it will be converted to a JSON Spec compliant
				key. Keys must contain only lowercase letters and underscores, max 64
				characters.
			</Typography>
		</Stack>
	);
}
