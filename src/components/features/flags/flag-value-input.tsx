'use client';

import { Box, FormHelperText, TextField, Typography } from '@mui/material';
import type { KeyboardEvent } from 'react';
import { useEffect, useState } from 'react';
import { ink, monoFontFamily, surface } from '@/theme/designTokens';
import type { FlagValue } from '@/types';
import JsonChip from './json-chip';

export type FlagType =
	| 'bool'
	| 'string'
	| 'int'
	| 'double'
	| 'date'
	| 'json'
	| 'BOOL'
	| 'STRING'
	| 'INT'
	| 'DOUBLE'
	| 'DATE'
	| 'JSON';

interface FlagValueInputProps {
	flagType: FlagType;
	value: FlagValue;
	onChange: (value: FlagValue) => void;
	label?: string;
	placeholder?: string;
	error?: boolean;
	helperText?: string;
	disabled?: boolean;
	required?: boolean;
	size?: 'small' | 'medium';
	fullWidth?: boolean;
	autoFocus?: boolean;
	onKeyDown?: (event: KeyboardEvent) => void;
}

// Mirrors String(value)'s coercion while keeping the type checker happy:
// objects fall back to Object's default ("[object Object]"), matching prior behavior.
function stringifyPrimitive(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return Object.prototype.toString.call(value);
}

export function getDefaultValueForType(flagType: FlagType): FlagValue {
	const normalizedType = flagType.toLowerCase() as FlagType;
	switch (normalizedType) {
		case 'bool':
			return false;
		case 'string':
			return '';
		case 'int':
			return 0;
		case 'double':
			return 0.0;
		case 'date':
			return new Date().toISOString().split('T')[0];
		case 'json':
			return '{}';
		default:
			return '';
	}
}

export function processValueForType(
	value: unknown,
	flagType: FlagType,
): FlagValue {
	const normalizedType = flagType.toLowerCase() as FlagType;
	switch (normalizedType) {
		case 'bool':
			return value === 'true' || value === true;
		case 'int':
			return parseInt(String(value)) || 0;
		case 'double':
			return parseFloat(String(value)) || 0.0;
		case 'json':
			// Store JSON as escaped strings for SDK compatibility
			try {
				if (typeof value === 'object' && value !== null) {
					return JSON.stringify(value);
				}
				if (typeof value === 'string') {
					// Validate it's proper JSON, then return as string
					JSON.parse(value);
					return value;
				}
				return '{}';
			} catch {
				return '{}';
			}
		case 'string':
		case 'date':
		default:
			// Non-JSON values pass through; coerce to a FlagValue-safe form.
			return value as FlagValue;
	}
}

export function formatValueForDisplay(
	value: unknown,
	flagType: FlagType,
): string {
	if (value === null || value === undefined) {
		return 'undefined';
	}

	const normalizedType = flagType.toLowerCase() as FlagType;
	switch (normalizedType) {
		case 'bool':
			return String(Boolean(value));
		case 'json':
			// Handle both object and string formats for display
			try {
				if (typeof value === 'string') {
					// Validate and pretty-print if it's a JSON string
					const parsed: unknown = JSON.parse(value);
					return JSON.stringify(parsed);
				}
				return typeof value === 'object'
					? JSON.stringify(value)
					: stringifyPrimitive(value);
			} catch {
				return stringifyPrimitive(value);
			}
		case 'string':
		case 'date':
			return stringifyPrimitive(value);
		case 'int':
		case 'double':
			return String(Number(value));
		default:
			return stringifyPrimitive(value);
	}
}

export function getJSONSummary(jsonString: string): string {
	try {
		const parsed: unknown = JSON.parse(jsonString);
		if (typeof parsed === 'object' && parsed !== null) {
			const keys = Object.keys(parsed);
			if (keys.length === 0) {
				return '{}';
			}
			if (keys.length === 1) {
				return `{ ${keys[0]}: ... }`;
			}
			return `{ ${keys[0]}, ${keys[1]}${keys.length > 2 ? ', ...' : ''} }`;
		}
		return jsonString.length > 30
			? jsonString.substring(0, 30) + '...'
			: jsonString;
	} catch {
		return jsonString.length > 30
			? jsonString.substring(0, 30) + '...'
			: jsonString;
	}
}

export function validateValue(
	value: unknown,
	flagType: FlagType,
): { isValid: boolean; error?: string } {
	const normalizedType = flagType.toLowerCase() as FlagType;
	switch (normalizedType) {
		case 'json':
			try {
				if (typeof value === 'string' && value.trim()) {
					JSON.parse(value);
				}
				return { isValid: true };
			} catch {
				return { isValid: false, error: 'Invalid JSON format' };
			}
		case 'int': {
			if (value === '' || value === null || value === undefined) {
				return { isValid: true };
			}
			const intValue = parseInt(stringifyPrimitive(value));
			if (isNaN(intValue)) {
				return { isValid: false, error: 'Must be a valid integer' };
			}
			return { isValid: true };
		}
		case 'double': {
			if (value === '' || value === null || value === undefined) {
				return { isValid: true };
			}
			const floatValue = parseFloat(stringifyPrimitive(value));
			if (isNaN(floatValue)) {
				return { isValid: false, error: 'Must be a valid number' };
			}
			return { isValid: true };
		}
		default:
			return { isValid: true };
	}
}

// Shared label above non-MUI-framed controls (segmented bool / JSON block).
function FieldLabel({ label }: { label?: string }) {
	if (!label) {return null;}
	return (
		<Typography
			component="div"
			sx={{
				fontFamily: 'var(--font-nunito)',
				fontWeight: 700,
				fontSize: 11,
				letterSpacing: '.04em',
				textTransform: 'uppercase',
				color: ink.soft,
				mb: 1,
			}}
		>
			{label}
		</Typography>
	);
}

// Coerces a flag value into a string for a controlled MUI input. Empty/absent
// values render as an empty field; objects coerce the same way String() would.
function toInputValue(value: FlagValue): string {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return Object.prototype.toString.call(value);
}

// Mono-styled input shared by string / number / date (the "technical voice").
const monoInputSx = {
	'& .MuiOutlinedInput-root': { borderRadius: '9px' },
	'& .MuiOutlinedInput-input': {
		fontFamily: monoFontFamily,
		fontWeight: 500,
		fontSize: 13,
	},
} as const;

export default function FlagValueInput({
	flagType,
	value,
	onChange,
	label,
	placeholder,
	error,
	helperText,
	disabled = false,
	required = false,
	size = 'small',
	fullWidth = true,
	autoFocus = false,
	onKeyDown,
}: FlagValueInputProps) {
	const [stringValue, setStringValue] = useState('');
	const [jsonError, setJsonError] = useState<string | null>(null);

	useEffect(() => {
		// Sync the editable string buffer with the incoming value prop.
		const next =
			flagType.toLowerCase() === 'json' && typeof value === 'object'
				? JSON.stringify(value, null, 2)
				: stringifyPrimitive(value);
		// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirrors an external (prop) value into a local editable buffer
		setStringValue(next);
	}, [value, flagType]);

	const validation = validateValue(value, flagType);
	const isError = Boolean(error) || !validation.isValid;
	const displayHelperText = helperText ?? validation.error;

	// Normalize flag type to lowercase for consistency
	const normalizedFlagType = flagType.toLowerCase() as FlagType;

	// Boolean input — segmented true / false (selected = ink fill).
	if (normalizedFlagType === 'bool') {
		const selected = value === true || value === 'true';
		const seg = (on: boolean) => ({
			cursor: disabled ? 'default' : 'pointer',
			fontFamily: monoFontFamily,
			fontWeight: 600,
			fontSize: 13,
			borderRadius: '8px',
			px: 2.5,
			py: 1,
			border: '1.5px solid',
			borderColor: on ? ink.primary : surface.borderStrong,
			backgroundColor: on ? ink.primary : '#fff',
			color: on ? '#fff' : ink.muted,
			userSelect: 'none' as const,
			transition: 'all .12s ease',
			opacity: disabled ? 0.6 : 1,
		});
		return (
			<Box sx={fullWidth ? { width: '100%' } : undefined}>
				<FieldLabel label={label} />
				<Box sx={{ display: 'flex', gap: 0.75 }}>
					<Box
						component="span"
						onClick={() => !disabled && onChange(true)}
						sx={seg(selected)}
					>
						true
					</Box>
					<Box
						component="span"
						onClick={() => !disabled && onChange(false)}
						sx={seg(!selected)}
					>
						false
					</Box>
				</Box>
				{displayHelperText && (
					<FormHelperText error={isError} sx={{ mx: 0, mt: 0.75 }}>
						{displayHelperText}
					</FormHelperText>
				)}
			</Box>
		);
	}

	// JSON input — dark code-surface editor with live valid/invalid feedback.
	if (normalizedFlagType === 'json') {
		const handleJSONChange = (newValue: string) => {
			setStringValue(newValue);
			const jsonErr = validateValue(newValue, 'json');
			setJsonError(jsonErr.isValid ? null : (jsonErr.error ?? 'Invalid JSON'));
			if (jsonErr.isValid) {
				try {
					JSON.parse(newValue);
					onChange(newValue);
				} catch {
					// Ignore parsing errors mid-typing
				}
			}
		};

		return (
			<Box sx={fullWidth ? { width: '100%' } : undefined}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
					<FieldLabel label={label ?? 'JSON value'} />
				</Box>
				<JsonChip
					value={stringValue}
					editable
					onChange={handleJSONChange}
					disabled={disabled}
				/>
				{(jsonError ?? displayHelperText) && (
					<FormHelperText error={Boolean(jsonError)} sx={{ mx: 0, mt: 0.75 }}>
						{jsonError ?? displayHelperText}
					</FormHelperText>
				)}
			</Box>
		);
	}

	// Number inputs (mono)
	if (normalizedFlagType === 'int' || normalizedFlagType === 'double') {
		return (
			<TextField
				label={label}
				type="number"
				value={toInputValue(value)}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				fullWidth={fullWidth}
				size={size}
				error={isError}
				helperText={displayHelperText}
				disabled={disabled}
				required={required}
				autoFocus={autoFocus}
				onKeyDown={onKeyDown}
				sx={monoInputSx}
				inputProps={{ step: normalizedFlagType === 'double' ? 'any' : 1 }}
			/>
		);
	}

	// Date input (mono)
	if (normalizedFlagType === 'date') {
		return (
			<TextField
				label={label}
				type="date"
				value={toInputValue(value)}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				fullWidth={fullWidth}
				size={size}
				error={isError}
				helperText={displayHelperText}
				disabled={disabled}
				required={required}
				autoFocus={autoFocus}
				onKeyDown={onKeyDown}
				sx={monoInputSx}
				InputLabelProps={{ shrink: true }}
			/>
		);
	}

	// String input (default, mono)
	return (
		<TextField
			label={label}
			value={toInputValue(value)}
			onChange={(e) => onChange(e.target.value)}
			placeholder={placeholder}
			fullWidth={fullWidth}
			size={size}
			error={isError}
			helperText={displayHelperText}
			disabled={disabled}
			required={required}
			autoFocus={autoFocus}
			onKeyDown={onKeyDown}
			sx={monoInputSx}
		/>
	);
}
