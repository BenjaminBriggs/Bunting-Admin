'use client';

import {
	CheckCircle,
	ContentCopy,
	Error as ErrorIcon,
} from '@mui/icons-material';
import {
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormHelperText,
	TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
	codeSurface,
	ink,
	monoFontFamily,
	typeColors,
} from '@/theme/designTokens';
import type { FlagValue } from '@/types';

// Validates a JSON string the same way flag-value-input's validateValue does for
// the 'json' type. Defined locally to avoid an import cycle between the two files.
function validateJson(value: string): { isValid: boolean; error?: string } {
	try {
		if (value.trim()) {
			JSON.parse(value);
		}
		return { isValid: true };
	} catch {
		return { isValid: false, error: 'Invalid JSON format' };
	}
}

// Accepts either a JSON string or an already-parsed object/array.
function parseJson(value: unknown): { parsed: unknown; ok: boolean } {
	if (value === null || value === undefined) {
		return { parsed: undefined, ok: false };
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return { parsed: undefined, ok: false };
		}
		try {
			return { parsed: JSON.parse(trimmed), ok: true };
		} catch {
			return { parsed: undefined, ok: false };
		}
	}
	return { parsed: value, ok: true };
}

// `{}` when empty (null/undefined/{}/[]/blank/unparseable-empty), `{···}` otherwise.
export function isEmptyJson(value: unknown): boolean {
	const { parsed, ok } = parseJson(value);
	if (!ok) {
		// Unparseable or blank — treat a literal "{}" / "[]" string as empty too.
		const s = typeof value === 'string' ? value.trim() : '';
		return s === '' || s === '{}' || s === '[]';
	}
	if (parsed === null || parsed === undefined) {
		return true;
	}
	if (Array.isArray(parsed)) {
		return parsed.length === 0;
	}
	if (typeof parsed === 'object') {
		return Object.keys(parsed).length === 0;
	}
	// A primitive (number/string/bool) is "content".
	return false;
}

// Pretty-printed string for the view modal; falls back to the raw value if it
// doesn't parse so the user can still see (and fix) malformed JSON.
function prettyPrint(value: unknown): string {
	const { parsed, ok } = parseJson(value);
	if (ok && parsed !== undefined) {
		return JSON.stringify(parsed, null, 2);
	}
	if (typeof value === 'string') {
		return value;
	}
	if (value === null || value === undefined) {
		return '';
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return Object.prototype.toString.call(value);
}

interface JsonModalProps {
	open: boolean;
	onClose: () => void;
	value: FlagValue;
	editable?: boolean;
	onChange?: (jsonString: string) => void;
	title?: string;
}

export function JsonModal({
	open,
	onClose,
	value,
	editable = false,
	onChange,
	title,
}: JsonModalProps) {
	const [draft, setDraft] = useState('');
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (open) {
			// Initialize the editable draft from the incoming value when the modal opens.
			// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirrors an external (prop) value into a local editable buffer on open
			setDraft(prettyPrint(value));
			setCopied(false);
		}
	}, [open, value]);

	const validation = validateJson(draft);
	const isValid = validation.isValid;

	const handleCopy = () => {
		// navigator.clipboard is typed as always-present but is undefined in
		// insecure contexts / older browsers, so guard defensively.
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime: navigator.clipboard can be undefined despite its lib type
		void navigator.clipboard?.writeText(prettyPrint(value));
		setCopied(true);
	};

	const handleSave = () => {
		if (!isValid) {
			return;
		}
		onChange?.(draft);
		onClose();
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1,
					fontFamily: 'var(--font-baloo)',
					fontWeight: 800,
				}}
			>
				{title ?? (editable ? 'Edit JSON' : 'JSON value')}
				{editable && (
					<Box
						sx={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: 0.5,
							fontFamily: monoFontFamily,
							fontWeight: 700,
							fontSize: 10,
							color: isValid ? 'success.main' : 'error.main',
							ml: 'auto',
						}}
					>
						{isValid ? (
							<CheckCircle sx={{ fontSize: 14 }} />
						) : (
							<ErrorIcon sx={{ fontSize: 14 }} />
						)}
						{isValid ? 'valid' : 'invalid'}
					</Box>
				)}
			</DialogTitle>

			<DialogContent>
				{editable ? (
					<>
						<TextField
							multiline
							minRows={8}
							maxRows={24}
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							placeholder="{}"
							fullWidth
							autoFocus
							sx={{
								mt: 1,
								'& .MuiOutlinedInput-root': {
									backgroundColor: codeSurface.bg,
									borderRadius: '11px',
									p: 1.75,
								},
								'& .MuiOutlinedInput-notchedOutline': { border: 'none' },
								'& .MuiOutlinedInput-input': {
									fontFamily: monoFontFamily,
									fontSize: 12,
									lineHeight: 1.7,
									color: codeSurface.text,
								},
							}}
						/>
						{!isValid && (
							<FormHelperText error sx={{ mx: 0, mt: 0.75 }}>
								{validation.error ?? 'Invalid JSON'}
							</FormHelperText>
						)}
					</>
				) : (
					<Box
						component="pre"
						sx={{
							mt: 1,
							m: 0,
							backgroundColor: codeSurface.bg,
							color: codeSurface.text,
							fontFamily: monoFontFamily,
							fontSize: 12,
							lineHeight: 1.7,
							borderRadius: '11px',
							p: 1.75,
							maxHeight: '60vh',
							overflow: 'auto',
							whiteSpace: 'pre-wrap',
							wordBreak: 'break-word',
						}}
					>
						{prettyPrint(value)}
					</Box>
				)}
			</DialogContent>

			<DialogActions sx={{ px: 3, pb: 2 }}>
				{editable ? (
					<>
						<Button onClick={onClose} sx={{ color: ink.soft }}>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							variant="contained"
							disabled={!isValid}
						>
							Save
						</Button>
					</>
				) : (
					<>
						<Button
							onClick={handleCopy}
							startIcon={<ContentCopy sx={{ fontSize: 16 }} />}
							sx={{ color: ink.soft, mr: 'auto' }}
						>
							{copied ? 'Copied' : 'Copy'}
						</Button>
						<Button onClick={onClose} variant="contained">
							Close
						</Button>
					</>
				)}
			</DialogActions>
		</Dialog>
	);
}

interface JsonChipProps {
	value: FlagValue;
	editable?: boolean;
	onChange?: (jsonString: string) => void;
	disabled?: boolean;
	title?: string;
	// When provided, clicking the chip calls this instead of opening the built-in
	// modal — used where the chip sits inside an existing edit entry point.
	onClick?: () => void;
	size?: 'small' | 'medium';
}

export default function JsonChip({
	value,
	editable = false,
	onChange,
	disabled = false,
	title,
	onClick,
	size = 'medium',
}: JsonChipProps) {
	const [open, setOpen] = useState(false);
	const glyph = isEmptyJson(value) ? '{}' : '{···}';

	return (
		<>
			<Box
				component="span"
				onClick={(e) => {
					e.stopPropagation();
					if (disabled) {
						return;
					}
					if (onClick) {
						onClick();
					} else {
						setOpen(true);
					}
				}}
				sx={{
					display: 'inline-flex',
					alignItems: 'center',
					fontFamily: monoFontFamily,
					fontWeight: 700,
					fontSize: size === 'small' ? 11 : 12,
					color: typeColors.flag.text,
					bgcolor: typeColors.flag.bg,
					border: `1px solid ${typeColors.flag.border}`,
					borderRadius: '7px',
					px: size === 'small' ? 0.875 : 1,
					py: 0.375,
					cursor: disabled ? 'default' : 'pointer',
					userSelect: 'none',
					transition: 'background-color .12s ease',
					'&:hover': disabled ? undefined : { bgcolor: '#F8D7D0' },
				}}
			>
				{glyph}
			</Box>
			<JsonModal
				open={open}
				onClose={() => setOpen(false)}
				value={value}
				editable={editable}
				onChange={onChange}
				title={title}
			/>
		</>
	);
}
