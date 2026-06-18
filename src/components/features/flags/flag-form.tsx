'use client';

// FlagForm — unified Create / Edit flag screen (Flag Form.dc.html).
// One component, `mode: 'create' | 'edit'`. Per-environment default values in both modes,
// env cards tinted to the Flags-list column palette. Owns the editable form state and
// derives key / live JSON / pending-changes; the page supplies initial values and the
// submit / archive / delete callbacks (which keep the existing API + validation logic).

import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import FlagValueInput, {
	getDefaultValueForType,
	processValueForType,
	validateValue,
} from '@/components/features/flags/flag-value-input';
import { normalizeKey, validateKey } from '@/lib/utils';
import {
	codeSurface,
	envColors,
	ink,
	monoFontFamily,
	surface,
	technicalButtonSx,
} from '@/theme/designTokens';

type EnvKey = 'development' | 'beta' | 'production';

export interface FlagFormValues {
	displayName: string;
	key: string;
	type: string;
	description: string;
	group: string;
	archived?: boolean;
	defaultValues: Record<EnvKey, any>;
}

export interface FlagFormSubmit {
	key: string;
	displayName: string;
	type: string;
	description: string;
	group: string;
	defaultValues: Record<EnvKey, any>;
}

interface FlagFormProps {
	mode: 'create' | 'edit';
	initial: FlagFormValues;
	saving: boolean;
	saveError?: string | null;
	/** Existing group names across the app, for the group autocomplete. */
	existingGroups?: string[];
	onSubmit: (payload: FlagFormSubmit) => void;
	onArchiveToggle?: () => void;
	onDelete?: () => void;
	cancelHref?: string;
}

const TYPES: Array<{ value: string; label: string; glyph: string }> = [
	{ value: 'bool', label: 'Boolean', glyph: 'toggle_on' },
	{ value: 'string', label: 'String', glyph: 'format_quote' },
	{ value: 'int', label: 'Integer', glyph: 'tag' },
	{ value: 'double', label: 'Double', glyph: 'pin' },
	{ value: 'date', label: 'Date', glyph: 'calendar_today' },
	{ value: 'json', label: 'JSON', glyph: 'data_object' },
];

const TYPE_TAG: Record<string, string> = {
	bool: 'BOOL',
	string: 'STRING',
	int: 'INTEGER',
	double: 'DOUBLE',
	date: 'DATE',
	json: 'JSON',
};

const ENV_ORDER: EnvKey[] = ['production', 'beta', 'development'];

// Field label (Nunito caps).
function Label({ children }: { children: React.ReactNode }) {
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
			}}
		>
			{children}
		</Typography>
	);
}

function Ms({ name, sx }: { name: string; sx?: any }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

// Format a stored value for display in the pending-changes diff.
function fmt(type: string, v: any): string {
	if (type === 'bool') {return String(v);}
	if (type === 'string') {return v === '' || v == null ? '""' : `"${v}"`;}
	if (type === 'int' || type === 'double') {return v === '' || v == null ? '0' : String(v);}
	if (type === 'date') {return v || '—';}
	if (type === 'json') {return v || '{}';}
	return String(v);
}

export default function FlagForm({
	mode,
	initial,
	saving,
	saveError,
	existingGroups = [],
	onSubmit,
	onArchiveToggle,
	onDelete,
	cancelHref = '/dashboard/flags',
}: FlagFormProps) {
	const isEdit = mode === 'edit';
	const [displayName, setDisplayName] = useState(initial.displayName);
	const [type, setType] = useState(initial.type);
	const [description, setDescription] = useState(initial.description);
	const [group, setGroup] = useState(initial.group);
	const [defaultValues, setDefaultValues] = useState<Record<EnvKey, any>>(
		initial.defaultValues,
	);

	// The key is immutable once a flag exists: editing the display name must not
	// rename it. In create mode the key is still derived from the display name.
	const keyText = isEdit ? initial.key : normalizeKey(displayName) || '';
	const keyValidation = validateKey(keyText);
	const keyChanged = isEdit && keyText !== initial.key && keyText.length > 0;
	const keyAvailable = !isEdit ? keyText.length > 0 : keyChanged;

	const setTypeAndReset = (t: string) => {
		setType(t);
		const d = getDefaultValueForType(t as any);
		setDefaultValues({ development: d, beta: d, production: d });
	};
	const setEnv = (env: EnvKey, v: any) =>
		setDefaultValues((prev) => ({ ...prev, [env]: v }));

	const valuesValid = ENV_ORDER.every(
		(env) => validateValue(defaultValues[env], type as any).isValid,
	);

	// Pending changes (edit only)
	const changes = useMemo(() => {
		if (!isEdit) {return [];}
		const out: Array<{ field: string; from: string; to: string }> = [];
		if (displayName !== initial.displayName)
			{out.push({ field: 'NAME', from: initial.displayName || '∅', to: displayName || '∅' });}
		if (keyChanged) {out.push({ field: 'KEY', from: initial.key, to: keyText });}
		if (type !== initial.type) {out.push({ field: 'TYPE', from: initial.type, to: type });}
		ENV_ORDER.forEach((env) => {
			if (String(defaultValues[env]) !== String(initial.defaultValues[env])) {
				out.push({
					field: `${env.toUpperCase()} DEFAULT`,
					from: fmt(initial.type, initial.defaultValues[env]),
					to: fmt(type, defaultValues[env]),
				});
			}
		});
		if (description !== initial.description)
			{out.push({ field: 'DESCRIPTION', from: initial.description || '∅', to: description || '∅' });}
		if (group !== initial.group)
			{out.push({ field: 'GROUP', from: initial.group || '∅', to: group || '∅' });}
		return out;
	}, [isEdit, displayName, keyChanged, keyText, type, defaultValues, description, group, initial]);

	const dirty = isEdit ? changes.length > 0 : keyText.length > 0;
	const canSubmit = dirty && !keyValidation.error && valuesValid && !saving;

	const jsonPreview = useMemo(() => {
		const processed: Record<string, any> = {};
		ENV_ORDER.forEach((env) => {
			processed[env] = processValueForType(defaultValues[env], type as any);
		});
		return JSON.stringify(
			{ key: keyText || 'new_flag', type, defaults: processed },
			null,
			2,
		);
	}, [keyText, type, defaultValues]);

	const handleSubmit = () => {
		if (!canSubmit) {return;}
		const processed: Record<EnvKey, any> = {
			development: processValueForType(defaultValues.development, type as any),
			beta: processValueForType(defaultValues.beta, type as any),
			production: processValueForType(defaultValues.production, type as any),
		};
		onSubmit({
			key: keyText,
			displayName,
			type,
			description,
			group: group.trim(),
			defaultValues: processed,
		});
	};

	return (
		<Box sx={{ maxWidth: 920, mx: 'auto' }}>
			{/* header */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'flex-start',
					justifyContent: 'space-between',
					gap: 1.5,
					flexWrap: 'wrap',
				}}
			>
				<Box>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 0.75,
							fontFamily: 'var(--font-nunito)',
							fontWeight: 600,
							fontSize: 12,
							color: ink.muted,
						}}
					>
						<Link
							href="/dashboard/flags"
							style={{ color: 'inherit', textDecoration: 'none' }}
						>
							Flags
						</Link>
						<Ms name="chevron_right" sx={{ fontSize: 15 }} />
						<span>{isEdit ? `${initial.key} · Edit` : 'New flag'}</span>
					</Box>
					<Typography variant="h4" sx={{ mt: 1 }}>
						{isEdit ? 'Edit flag' : 'Create a flag'}
					</Typography>
					<Typography
						sx={{ fontWeight: 600, fontSize: 13, color: '#8B8472', mt: 0.5 }}
					>
						{isEdit
							? 'Set defaults independently per environment, or change the flag’s metadata.'
							: 'Set a default value for each environment — they can differ from the start.'}
					</Typography>
				</Box>
				{isEdit && (
					<Stack direction="row" spacing={1}>
						<Button
							variant="outlined"
							size="small"
							startIcon={<Ms name="archive" sx={{ fontSize: 17 }} />}
							onClick={onArchiveToggle}
						>
							{initial.archived ? 'Unarchive' : 'Archive'}
						</Button>
						<Button
							variant="outlined"
							size="small"
							color="error"
							startIcon={<Ms name="delete" sx={{ fontSize: 17 }} />}
							onClick={onDelete}
							sx={{ borderColor: '#EAC7BF', color: '#C8503C' }}
						>
							Delete
						</Button>
					</Stack>
				)}
			</Box>

			{saveError && (
				<Alert severity="error" sx={{ mt: 2 }}>
					{saveError}
				</Alert>
			)}

			<Box sx={{ display: 'flex', gap: 2.75, alignItems: 'flex-start', mt: 2.75, flexWrap: 'wrap' }}>
				{/* LEFT: form */}
				<Box
					sx={{
						flex: 1,
						minWidth: 430,
						bgcolor: '#fff',
						border: `1px solid ${surface.border}`,
						borderRadius: '18px',
						p: 3.25,
						boxShadow: '0 1px 2px rgba(40,33,20,.03)',
					}}
				>
					{/* display name */}
					<Label>
						Display name <Box component="span" sx={{ color: '#C8503C' }}>*</Box>
					</Label>
					<Box
						component="input"
						value={displayName}
						onChange={(e: any) => setDisplayName(e.target.value)}
						placeholder="e.g. Metering enabled"
						sx={{
							mt: 1,
							width: '100%',
							border: `1.5px solid ${surface.borderStrong}`,
							borderRadius: '11px',
							bgcolor: '#fff',
							px: 1.5,
							py: 1.25,
							font: "600 14px 'Nunito'",
							color: ink.primary,
							outline: 'none',
							'&:focus': { borderColor: ink.primary },
						}}
					/>
					{/* key echo */}
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mt: 1.125, flexWrap: 'wrap' }}>
						<Typography sx={{ fontWeight: 600, fontSize: 11, color: ink.muted }}>
							key
						</Typography>
						<Ms name="arrow_forward" sx={{ fontSize: 15, color: '#C2BAA8' }} />
						<Box
							sx={{
								fontFamily: monoFontFamily,
								fontWeight: 500,
								fontSize: 13,
								color: '#9A6F1C',
								bgcolor: '#FCEFD2',
								borderRadius: '6px',
								px: 1.125,
								py: 0.375,
							}}
						>
							{keyText || '—'}
						</Box>
						{keyValidation.error ? (
							<Typography sx={{ fontWeight: 600, fontSize: 11, color: '#C8503C' }}>
								{keyValidation.error}
							</Typography>
						) : (
							keyAvailable && (
								<Box
									sx={{
										display: 'inline-flex',
										alignItems: 'center',
										gap: 0.5,
										fontWeight: 600,
										fontSize: 11,
										color: '#3F7A2D',
									}}
								>
									<Ms name="check_circle" sx={{ fontSize: 15 }} />
									available
								</Box>
							)
						)}
					</Box>
					{/* key change warning */}
					{keyChanged && (
						<Box
							sx={{
								display: 'flex',
								alignItems: 'flex-start',
								gap: 1.25,
								bgcolor: '#FCEFD2',
								border: '1px solid #F3E2BD',
								borderRadius: '11px',
								p: '11px 13px',
								mt: 1.5,
							}}
						>
							<Ms name="warning" sx={{ fontSize: 19, color: '#9A6F1C' }} />
							<Typography sx={{ fontWeight: 600, fontSize: 12, color: '#5E4A18', lineHeight: 1.5 }}>
								Renaming changes the key from{' '}
								<Box component="span" sx={{ fontFamily: monoFontFamily, fontSize: 11, color: '#9A6F1C' }}>
									{initial.key}
								</Box>{' '}
								to{' '}
								<Box component="span" sx={{ fontFamily: monoFontFamily, fontSize: 11, color: '#9A6F1C' }}>
									{keyText}
								</Box>
								. Any code referencing the old key must be updated.
							</Typography>
						</Box>
					)}

					{/* type */}
					<Box sx={{ mt: 3 }}>
						<Label>Type</Label>
					</Box>
					{isEdit ? (
						// Type is immutable once a flag exists — changing it would
						// invalidate stored values and any client codegen. Show it read-only.
						<>
							<Box
								sx={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: 1,
									border: `1.5px solid ${surface.borderStrong}`,
									bgcolor: surface.token,
									borderRadius: '11px',
									p: '11px 12px',
									mt: 1.125,
								}}
							>
								<Ms
									name={TYPES.find((t) => t.value === type)?.glyph ?? 'category'}
									sx={{ fontSize: 19, color: ink.soft }}
								/>
								<Typography sx={{ fontWeight: 700, fontSize: 13, color: ink.soft }}>
									{TYPES.find((t) => t.value === type)?.label ?? type}
								</Typography>
							</Box>
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mt: 1, color: '#B4AC9A' }}>
								<Ms name="lock" sx={{ fontSize: 14 }} />
								<Typography sx={{ fontWeight: 600, fontSize: 11 }}>
									Type can&rsquo;t be changed after a flag is created.
								</Typography>
							</Box>
						</>
					) : (
						<>
							<Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mt: 1.125 }}>
								{TYPES.map((t) => {
									const on = type === t.value;
									return (
										<Box
											key={t.value}
											onClick={() => setTypeAndReset(t.value)}
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 1,
												border: `1.5px solid ${on ? ink.primary : surface.borderStrong}`,
												bgcolor: on ? '#FBEDC6' : '#fff',
												borderRadius: '11px',
												p: '11px 12px',
												cursor: 'pointer',
												transition: 'all .12s ease',
											}}
										>
											<Ms name={t.glyph} sx={{ fontSize: 19, color: on ? ink.primary : ink.muted }} />
											<Typography sx={{ fontWeight: 700, fontSize: 13, color: on ? ink.primary : ink.soft }}>
												{t.label}
											</Typography>
										</Box>
									);
								})}
							</Box>
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mt: 1, color: '#B4AC9A' }}>
								<Ms name="info" sx={{ fontSize: 14 }} />
								<Typography sx={{ fontWeight: 600, fontSize: 11 }}>
									Changing type resets the default values.
								</Typography>
							</Box>
						</>
					)}

					{/* per-env defaults */}
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3, mb: 1.25 }}>
						<Label>Default value per environment</Label>
						<Box
							sx={{
								fontFamily: monoFontFamily,
								fontWeight: 600,
								fontSize: 9,
								color: ink.soft,
								bgcolor: surface.token,
								borderRadius: '5px',
								px: 0.875,
								py: 0.25,
							}}
						>
							{TYPE_TAG[type]}
						</Box>
					</Box>
					<Stack spacing={1.125}>
						{ENV_ORDER.map((env) => {
							const c = envColors[env];
							return (
								<Box
									key={env}
									sx={{
										display: 'flex',
										alignItems: 'center',
										gap: 1.5,
										border: `1.5px solid ${c.border}`,
										borderRadius: '12px',
										p: '12px 14px',
										bgcolor: c.bg,
									}}
								>
									<Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.dot, flexShrink: 0 }} />
									<Typography sx={{ fontWeight: 700, fontSize: 13, color: c.text, width: 104, flexShrink: 0 }}>
										{c.label}
									</Typography>
									<Box sx={{ ml: 'auto', minWidth: 0 }}>
										<FlagValueInput
											flagType={type as any}
											value={defaultValues[env]}
											onChange={(v) => setEnv(env, v)}
											fullWidth={false}
											size="small"
										/>
									</Box>
								</Box>
							);
						})}
					</Stack>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mt: 1.125, color: '#B4AC9A' }}>
						<Ms name="info" sx={{ fontSize: 14 }} />
						<Typography sx={{ fontWeight: 600, fontSize: 11 }}>
							Conditional variants are added per-environment from the flag row.
						</Typography>
					</Box>

					{/* description */}
					<Box sx={{ mt: 3, mb: 1.125 }}>
						<Label>
							Description{' '}
							<Box component="span" sx={{ fontWeight: 600, color: '#B4AC9A', letterSpacing: 0 }}>
								· optional
							</Box>
						</Label>
					</Box>
					<Box
						component="textarea"
						value={description}
						onChange={(e: any) => setDescription(e.target.value)}
						placeholder="What does this flag control?"
						sx={{
							width: '100%',
							minHeight: 70,
							resize: 'vertical',
							border: `1.5px solid ${surface.borderStrong}`,
							borderRadius: '11px',
							bgcolor: '#fff',
							px: 1.5,
							py: 1.25,
							font: "600 14px 'Nunito'",
							color: ink.primary,
							lineHeight: 1.5,
							outline: 'none',
							'&:focus': { borderColor: ink.primary },
						}}
					/>

					{/* group (admin-only organisation; not published) */}
					<Box sx={{ mt: 3, mb: 1.125 }}>
						<Label>
							Group{' '}
							<Box component="span" sx={{ fontWeight: 600, color: '#B4AC9A', letterSpacing: 0 }}>
								· optional · organises the flags list only
							</Box>
						</Label>
					</Box>
					<Box
						component="input"
						value={group}
						onChange={(e: any) => setGroup(e.target.value)}
						placeholder="e.g. Checkout & Billing"
						list="flag-group-options"
						sx={{
							width: '100%',
							border: `1.5px solid ${surface.borderStrong}`,
							borderRadius: '11px',
							bgcolor: '#fff',
							px: 1.5,
							py: 1.25,
							font: "600 14px 'Nunito'",
							color: ink.primary,
							outline: 'none',
							'&:focus': { borderColor: ink.primary },
						}}
					/>
					<Box component="datalist" id="flag-group-options">
						{existingGroups.map((g) => (
							<option key={g} value={g} />
						))}
					</Box>

					{/* footer */}
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'flex-end',
							gap: 1.25,
							mt: 3,
							pt: 2.25,
							borderTop: '1px solid #F1EBDD',
						}}
					>
						<Button variant="outlined" component={Link} href={cancelHref}>
							Cancel
						</Button>
						<Button
							onClick={handleSubmit}
							disabled={!canSubmit}
							startIcon={<Ms name={isEdit ? 'check' : 'add'} sx={{ fontSize: 18 }} />}
							sx={technicalButtonSx({ disabled: !canSubmit })}
						>
							{isEdit ? 'Save changes' : 'Create flag'}
						</Button>
					</Box>
				</Box>

				{/* RIGHT: pending changes (edit) + json */}
				<Box
					sx={{
						width: 300,
						flexShrink: 0,
						display: 'flex',
						flexDirection: 'column',
						gap: 1.75,
						position: { md: 'sticky' },
						top: 34,
					}}
				>
					{isEdit && (
						<Box
							sx={{
								bgcolor: '#fff',
								border: `1px solid ${surface.border}`,
								borderRadius: '16px',
								p: '18px 20px',
								boxShadow: '0 1px 2px rgba(40,33,20,.03)',
							}}
						>
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.625 }}>
								<Ms name="pending_actions" sx={{ fontSize: 18, color: '#7E776A' }} />
								<Typography variant="h6" sx={{ fontSize: 14 }}>
									Pending changes
								</Typography>
								<Box
									sx={{
										ml: 'auto',
										fontFamily: monoFontFamily,
										fontWeight: 700,
										fontSize: 11,
										color: '#9A9483',
										bgcolor: '#EFE8D9',
										borderRadius: '20px',
										px: 1,
										py: 0.25,
									}}
								>
									{changes.length}
								</Box>
							</Box>
							{changes.length === 0 ? (
								<Typography sx={{ fontWeight: 600, fontSize: 12, color: '#B4AC9A', textAlign: 'center', py: 1 }}>
									No changes yet.
								</Typography>
							) : (
								<Stack spacing={1.125}>
									{changes.map((c) => (
										<Box key={c.field}>
											<Box
												sx={{
													fontFamily: monoFontFamily,
													fontWeight: 700,
													fontSize: 9,
													color: '#9A6F1C',
													bgcolor: '#FCEFD2',
													borderRadius: '5px',
													px: 0.75,
													py: 0.25,
													display: 'inline-block',
												}}
											>
												{c.field}
											</Box>
											<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.375, flexWrap: 'wrap', fontFamily: monoFontFamily, fontWeight: 500, fontSize: 11 }}>
												<Box component="span" sx={{ color: '#B4AC9A', textDecoration: 'line-through' }}>
													{c.from}
												</Box>
												<Ms name="arrow_forward" sx={{ fontSize: 14, color: '#C2BAA8' }} />
												<Box component="span" sx={{ color: ink.primary }}>
													{c.to}
												</Box>
											</Box>
										</Box>
									))}
								</Stack>
							)}
						</Box>
					)}
					<Box
						sx={{
							bgcolor: '#fff',
							border: `1px solid ${surface.border}`,
							borderRadius: '16px',
							p: '18px 20px',
							boxShadow: '0 1px 2px rgba(40,33,20,.03)',
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.375 }}>
							<Ms name="data_object" sx={{ fontSize: 17, color: '#7E776A' }} />
							<Typography sx={{ fontFamily: monoFontFamily, fontWeight: 700, fontSize: 11, letterSpacing: '.04em', color: ink.soft }}>
								PREVIEW
							</Typography>
							<Box sx={{ fontFamily: monoFontFamily, fontWeight: 600, fontSize: 10, color: '#3F7A2D', bgcolor: '#E9F4E0', borderRadius: '6px', px: 0.875, py: 0.25 }}>
								live
							</Box>
						</Box>
						<Box
							component="pre"
							sx={{
								bgcolor: codeSurface.bg,
								borderRadius: '11px',
								p: '14px 15px',
								m: 0,
								fontFamily: monoFontFamily,
								fontWeight: 500,
								fontSize: 12,
								lineHeight: 1.7,
								color: codeSurface.text,
								whiteSpace: 'pre',
								overflow: 'auto',
							}}
						>
							{jsonPreview}
						</Box>
					</Box>
				</Box>
			</Box>
		</Box>
	);
}
