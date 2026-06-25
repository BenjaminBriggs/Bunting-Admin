'use client';

import {
	CheckCircle,
	Error as ErrorIcon,
	ExpandLess,
	ExpandMore,
} from '@mui/icons-material';
import {
	Box,
	Collapse,
	FormControl,
	IconButton,
	InputLabel,
	MenuItem,
	Paper,
	Select,
	TextField,
	Typography,
} from '@mui/material';
import { type KeyboardEvent, useState } from 'react';
import type { FlagType, FlagValue } from '@/types';

interface ValueInputProps {
	type: FlagType;
	value: FlagValue;
	onChange: (value: FlagValue) => void;
	label?: string;
	size?: 'small' | 'medium';
	placeholder?: string;
	required?: boolean;
	error?: string;
	helperText?: string;
	fullWidth?: boolean;
	autoFocus?: boolean;
	onKeyDown?: (event: KeyboardEvent) => void;
}

export default function ValueInput({
	type,
	value,
	onChange,
	label = 'Value',
	size = 'small',
	placeholder,
	required = false,
	error,
	helperText,
	fullWidth = true,
	autoFocus = false,
	onKeyDown,
}: ValueInputProps) {
	const [jsonExpanded, setJsonExpanded] = useState(false);
	const [jsonError, setJsonError] = useState<string | null>(null);

	// Convert value to string representation for editing
	const deriveStringValue = (): string => {
		if (typeof value === 'object') {
			return JSON.stringify(value, null, type === 'json' ? 2 : undefined);
		}
		return String(value);
	};

	// Mirror the incoming value/type into editable string state. Track the last
	// derived value so we re-sync only when value/type change, while still
	// allowing local edits via handleStringChange/handleJSONChange.
	const [stringValue, setStringValue] = useState(deriveStringValue);
	const [lastDerived, setLastDerived] = useState(stringValue);
	const derived = deriveStringValue();
	if (derived !== lastDerived) {
		setLastDerived(derived);
		setStringValue(derived);
	}

	const getJSONSummary = (jsonString: string): string => {
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
	};

	const validateJSON = (jsonString: string): string | null => {
		try {
			JSON.parse(jsonString);
			return null;
		} catch (error) {
			return error instanceof Error ? error.message : 'Invalid JSON';
		}
	};

	const handleStringChange = (newStringValue: string) => {
		setStringValue(newStringValue);

		try {
			let processedValue: FlagValue;

			if (type === 'bool') {
				processedValue = newStringValue === 'true';
			} else if (type === 'int') {
				processedValue = parseInt(newStringValue) || 0;
			} else if (type === 'double') {
				processedValue = parseFloat(newStringValue) || 0.0;
			} else if (type === 'json') {
				const jsonErr = validateJSON(newStringValue);
				setJsonError(jsonErr);
				if (!jsonErr) {
					processedValue = JSON.parse(newStringValue) as FlagValue;
				} else {
					return; // Don't call onChange if JSON is invalid
				}
			} else {
				processedValue = newStringValue;
			}

			onChange(processedValue);
		} catch {
			// Handle parsing errors silently - user is still typing
		}
	};

	const handleJSONChange = (newValue: string) => {
		setStringValue(newValue);
		const jsonErr = validateJSON(newValue);
		setJsonError(jsonErr);

		if (!jsonErr) {
			try {
				const parsed = JSON.parse(newValue) as FlagValue;
				onChange(parsed);
			} catch {
				// Ignore parsing errors during typing
			}
		}
	};

	// Boolean input
	if (type === 'bool') {
		return (
			<FormControl size={size} fullWidth={fullWidth}>
				<InputLabel>{label}</InputLabel>
				<Select
					value={stringValue}
					label={label}
					onChange={(e) => handleStringChange(e.target.value)}
					error={Boolean(error)}
					autoFocus={autoFocus}
				>
					<MenuItem value="false">false</MenuItem>
					<MenuItem value="true">true</MenuItem>
				</Select>
				{(error ?? helperText) && (
					<Typography
						variant="caption"
						color={error ? 'error' : 'text.secondary'}
						sx={{ mt: 0.5 }}
					>
						{error ?? helperText}
					</Typography>
				)}
			</FormControl>
		);
	}

	// JSON input with expandable editor
	if (type === 'json') {
		return (
			<Box>
				<Paper
					variant="outlined"
					sx={{
						p: 1,
						cursor: 'pointer',
						'&:hover': { bgcolor: 'grey.50' },
						borderColor: error || jsonError ? 'error.main' : 'divider',
					}}
					onClick={() => setJsonExpanded(!jsonExpanded)}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
						}}
					>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 1,
								flexGrow: 1,
							}}
						>
							<Typography variant="body2" color="text.secondary">
								{label}:
							</Typography>
							<Typography
								variant="body2"
								sx={{
									fontFamily: 'monospace',
									flexGrow: 1,
									color: error || jsonError ? 'error.main' : 'text.primary',
								}}
							>
								{getJSONSummary(stringValue)}
							</Typography>
							{error || jsonError ? (
								<ErrorIcon color="error" sx={{ fontSize: 16 }} />
							) : (
								<CheckCircle color="success" sx={{ fontSize: 16 }} />
							)}
						</Box>
						<IconButton size="small">
							{jsonExpanded ? <ExpandLess /> : <ExpandMore />}
						</IconButton>
					</Box>
				</Paper>

				<Collapse in={jsonExpanded}>
					<Box sx={{ mt: 1 }}>
						<TextField
							multiline
							rows={6}
							value={stringValue}
							onChange={(e) => handleJSONChange(e.target.value)}
							placeholder={placeholder ?? '{\n  "key": "value"\n}'}
							fullWidth={fullWidth}
							size={size}
							error={Boolean(error ?? jsonError)}
							helperText={
								error ?? jsonError ?? helperText ?? 'Enter valid JSON'
							}
							autoFocus={autoFocus}
							onKeyDown={onKeyDown}
							InputProps={{
								sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
							}}
						/>
					</Box>
				</Collapse>
			</Box>
		);
	}

	// Standard text/number/date input
	return (
		<TextField
			label={label}
			value={stringValue}
			onChange={(e) => handleStringChange(e.target.value)}
			size={size}
			fullWidth={fullWidth}
			required={required}
			error={Boolean(error)}
			helperText={error ?? helperText}
			placeholder={placeholder}
			autoFocus={autoFocus}
			onKeyDown={onKeyDown}
			type={
				type === 'int' || type === 'double'
					? 'number'
					: type === 'date'
						? 'date'
						: 'text'
			}
			InputProps={{
				sx: {
					fontFamily: type === 'date' ? 'inherit' : 'monospace',
					fontSize: '0.875rem',
				},
			}}
		/>
	);
}
