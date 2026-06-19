'use client';

// RolloutForm — unified Create / Edit rollout screen (Rollout Form.dc.html).
// Owns the editable form state and derives key / live JSON / pending-changes; the page
// supplies initial values + the submit / complete / delete callbacks (preserving the
// existing createRollout / updateTestRollout / archiveTestRollout / deleteRollout logic).

import type { SxProps, Theme } from '@mui/material';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import type { ChangeEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
	conditionTemplates,
	operatorLabels,
} from '@/components/features/rules/rule-templates';
import { normalizeKey, validateKey } from '@/lib/utils';
import {
	codeSurface,
	ink,
	monoFontFamily,
	surface,
	technicalButtonSx,
} from '@/theme/designTokens';
import type { Condition, ConditionOperator, ConditionType } from '@/types';
import { CONDITION_OPERATORS } from '@/types/core';

export interface RolloutFormValues {
	name: string;
	key: string;
	percentage: number;
	description: string;
	/** Admin-only organizational group label; not published. */
	group: string;
	archived?: boolean;
	conditions: Condition[];
}

export interface RolloutFormSubmit {
	key: string;
	name: string;
	description: string;
	group: string;
	percentage: number;
	conditions: Condition[];
}

interface RolloutFormProps {
	mode: 'create' | 'edit';
	initial: RolloutFormValues;
	saving: boolean;
	saveError?: string | null;
	onSubmit: (payload: RolloutFormSubmit) => void;
	onComplete?: () => void;
	onDelete?: () => void;
	cancelHref?: string;
}

const TYPE_OPTIONS = conditionTemplates.map((t) => ({
	value: t.type,
	label: t.label,
}));

function Label({ children }: { children: ReactNode }) {
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

function Ms({
	name,
	sx,
	onClick,
}: {
	name: string;
	sx?: SxProps<Theme>;
	onClick?: () => void;
}) {
	return (
		<Box component="span" className="ms" sx={sx} onClick={onClick}>
			{name}
		</Box>
	);
}

function clampPct(n: number): number {
	if (Number.isNaN(n)) {
		return 0;
	}
	return Math.max(0, Math.min(100, n));
}

function audienceLabel(conditions: Condition[]): string {
	if (conditions.length === 0) {
		return 'Everyone';
	}
	return `${conditions.length} condition${conditions.length === 1 ? '' : 's'}`;
}

const selectSx = {
	appearance: 'none',
	WebkitAppearance: 'none',
	fontFamily: 'var(--font-nunito)',
	fontWeight: 600,
	fontSize: 12,
	color: ink.primary,
	bgcolor: '#fff',
	border: `1.5px solid ${surface.borderStrong}`,
	borderRadius: '9px',
	p: '8px 26px 8px 10px',
	cursor: 'pointer',
	outline: 'none',
	backgroundImage:
		"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23A79F8C' stroke-width='2.4' stroke-linecap='round'><path d='M6 9l6 6 6-6'/></svg>\")",
	backgroundRepeat: 'no-repeat',
	backgroundPosition: 'right 7px center',
	'&:focus': { borderColor: ink.primary },
} as const;

const valueInputSx = {
	flex: 1,
	minWidth: 80,
	border: `1.5px solid ${surface.borderStrong}`,
	borderRadius: '9px',
	bgcolor: '#fff',
	outline: 'none',
	fontFamily: monoFontFamily,
	fontWeight: 500,
	fontSize: 13,
	color: ink.primary,
	p: '8px 11px',
	'&::placeholder': { color: '#B4AC9A' },
	'&:focus': { borderColor: ink.primary },
} as const;

const fieldSx = {
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
} as const;

export default function RolloutForm({
	mode,
	initial,
	saving,
	saveError,
	onSubmit,
	onComplete,
	onDelete,
	cancelHref = '/dashboard/rollouts',
}: RolloutFormProps) {
	const isEdit = mode === 'edit';
	const [name, setName] = useState(initial.name);
	const [percentage, setPercentage] = useState(initial.percentage);
	const [description, setDescription] = useState(initial.description);
	const [group, setGroup] = useState(initial.group);
	const [conditions, setConditions] = useState<Condition[]>(initial.conditions);
	const [audienceOn, setAudienceOn] = useState(initial.conditions.length > 0);

	// Rollout keys are immutable after creation (the update API has no `key` field), so in
	// edit mode the key is fixed; only create derives it live from the name.
	const derivedKey = normalizeKey(name);
	const keyText = isEdit ? initial.key : derivedKey;
	const keyValidation = validateKey(keyText);
	const keyChanged = false;
	const keyAvailable = !isEdit && derivedKey.length > 0;

	const operatorsForType = (type: string): ConditionOperator[] =>
		CONDITION_OPERATORS[type as ConditionType] ?? ['equals'];

	const setAudience = (on: boolean) => {
		if (on) {
			setAudienceOn(true);
			if (conditions.length === 0) {
				setConditions([
					{
						type: 'app_version',
						operator: 'greater_than_or_equal',
						values: [],
					},
				]);
			}
		} else {
			setAudienceOn(false);
			setConditions([]);
		}
	};
	const addCondition = () => {
		setConditions((prev) => [
			...prev,
			{ type: 'platform', operator: 'in', values: [] },
		]);
	};
	const removeCondition = (index: number) => {
		setConditions((prev) => {
			const next = prev.filter((_, i) => i !== index);
			if (next.length === 0) {
				setAudienceOn(false);
			}
			return next;
		});
	};
	const setCondType = (index: number, type: string) => {
		setConditions((prev) =>
			prev.map((c, i) =>
				i === index
					? {
							...c,
							type: type as ConditionType,
							operator: operatorsForType(type)[0],
							values: [],
						}
					: c,
			),
		);
	};
	const setCondOperator = (index: number, operator: string) => {
		setConditions((prev) =>
			prev.map((c, i) =>
				i === index ? { ...c, operator: operator as ConditionOperator } : c,
			),
		);
	};
	const setCondValue = (index: number, val: string) => {
		setConditions((prev) =>
			prev.map((c, i) =>
				i === index ? { ...c, values: val === '' ? [] : [val] } : c,
			),
		);
	};

	const changes = useMemo(() => {
		if (!isEdit) {
			return [];
		}
		const out: Array<{ field: string; from: string; to: string }> = [];
		if (name !== initial.name) {
			out.push({
				field: 'NAME',
				from: initial.name ?? '∅',
				to: name ?? '∅',
			});
		}
		if (keyChanged) {
			out.push({ field: 'KEY', from: initial.key, to: keyText });
		}
		if (percentage !== initial.percentage) {
			out.push({
				field: 'PERCENTAGE',
				from: `${initial.percentage}%`,
				to: `${percentage}%`,
			});
		}
		if (audienceLabel(conditions) !== audienceLabel(initial.conditions)) {
			out.push({
				field: 'AUDIENCE',
				from: audienceLabel(initial.conditions),
				to: audienceLabel(conditions),
			});
		}
		if (description !== initial.description) {
			out.push({
				field: 'DESCRIPTION',
				from: initial.description ?? '∅',
				to: description ?? '∅',
			});
		}
		if (group !== initial.group) {
			out.push({
				field: 'GROUP',
				from: initial.group ?? '∅',
				to: group ?? '∅',
			});
		}
		return out;
	}, [
		isEdit,
		name,
		keyChanged,
		keyText,
		percentage,
		conditions,
		description,
		group,
		initial,
	]);

	const dirty = isEdit ? changes.length > 0 : keyText.length > 0;
	const canSubmit = dirty && !keyValidation.error && !saving;

	const jsonPreview = useMemo(() => {
		const audience =
			conditions.length === 0
				? 'all'
				: {
						match: 'all',
						conditions: conditions.map((c) => ({
							type: c.type,
							operator: c.operator,
							values: c.values,
						})),
					};
		return JSON.stringify(
			{
				key: keyText ?? 'new_rollout',
				percentage,
				audience,
			},
			null,
			2,
		);
	}, [keyText, percentage, conditions]);

	const handleSubmit = () => {
		if (!canSubmit) {
			return;
		}
		onSubmit({
			key: keyText,
			name,
			description,
			group: group.trim(),
			percentage,
			conditions,
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
							href="/dashboard/rollouts"
							style={{ color: 'inherit', textDecoration: 'none' }}
						>
							Rollouts
						</Link>
						<Ms name="chevron_right" sx={{ fontSize: 15 }} />
						<span>{isEdit ? `${initial.key} · Edit` : 'New rollout'}</span>
					</Box>
					<Typography variant="h4" sx={{ mt: 1 }}>
						{isEdit ? 'Edit rollout' : 'Create a rollout'}
					</Typography>
					<Typography
						sx={{
							fontWeight: 600,
							fontSize: 13,
							color: '#8B8472',
							mt: 0.5,
							maxWidth: 560,
						}}
					>
						{isEdit
							? 'Adjust the ramp or audience. Changes apply everywhere this rollout is used.'
							: 'Name it and pick a starting percentage. Attach it to a flag afterwards from the Flags page.'}
					</Typography>
				</Box>
				{isEdit && (
					<Stack direction="row" spacing={1}>
						<Button
							variant="outlined"
							size="small"
							startIcon={
								<Ms
									name="check_circle"
									sx={{ fontSize: 17, color: '#3F7A2D' }}
								/>
							}
							onClick={onComplete}
						>
							Complete (100%)
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

			<Box
				sx={{
					display: 'flex',
					gap: 2.75,
					alignItems: 'flex-start',
					mt: 2.75,
					flexWrap: 'wrap',
				}}
			>
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
					{/* name */}
					<Label>
						Rollout name{' '}
						<Box component="span" sx={{ color: '#C8503C' }}>
							*
						</Box>
					</Label>
					<Box
						component="input"
						value={name}
						onChange={(e: ChangeEvent<HTMLInputElement>) =>
							setName(e.target.value)
						}
						placeholder="e.g. New checkout flow"
						sx={{ ...fieldSx, mt: 1 }}
					/>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 0.875,
							mt: 1.125,
							flexWrap: 'wrap',
						}}
					>
						<Typography
							sx={{ fontWeight: 600, fontSize: 11, color: ink.muted }}
						>
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
							{keyText ?? '—'}
						</Box>
						{keyValidation.error ? (
							<Typography
								sx={{ fontWeight: 600, fontSize: 11, color: '#C8503C' }}
							>
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
							<Typography
								sx={{
									fontWeight: 600,
									fontSize: 12,
									color: '#5E4A18',
									lineHeight: 1.5,
								}}
							>
								Renaming changes the key from{' '}
								<Box
									component="span"
									sx={{
										fontFamily: monoFontFamily,
										fontSize: 11,
										color: '#9A6F1C',
									}}
								>
									{initial.key}
								</Box>{' '}
								to{' '}
								<Box
									component="span"
									sx={{
										fontFamily: monoFontFamily,
										fontSize: 11,
										color: '#9A6F1C',
									}}
								>
									{keyText}
								</Box>
								. Any flag using this rollout keeps the link, but code
								referencing the key must be updated.
							</Typography>
						</Box>
					)}

					{/* percentage */}
					<Box sx={{ mt: 3 }}>
						<Label>Rollout percentage</Label>
					</Box>
					<Box
						sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mt: 1.5 }}
					>
						<Box sx={{ flex: 1 }}>
							<Box
								sx={{
									position: 'relative',
									height: 22,
									display: 'flex',
									alignItems: 'center',
								}}
							>
								<Box
									sx={{
										position: 'absolute',
										left: 0,
										right: 0,
										height: 12,
										borderRadius: '7px',
										bgcolor: '#EFE8DA',
									}}
								/>
								<Box
									sx={{
										position: 'absolute',
										left: 0,
										height: 12,
										width: `${percentage}%`,
										bgcolor: ink.primary,
										borderRadius: '7px',
									}}
								/>
								<Box
									sx={{
										position: 'absolute',
										left: `${percentage}%`,
										top: '50%',
										transform: 'translate(-50%,-50%)',
										width: 22,
										height: 22,
										borderRadius: '50%',
										bgcolor: '#fff',
										border: `2.5px solid ${ink.primary}`,
										boxShadow: '0 2px 6px rgba(0,0,0,.18)',
										pointerEvents: 'none',
									}}
								/>
								<Box
									component="input"
									type="range"
									min={0}
									max={100}
									value={percentage}
									onChange={(e: ChangeEvent<HTMLInputElement>) =>
										setPercentage(clampPct(parseInt(e.target.value, 10)))
									}
									sx={{
										appearance: 'none',
										WebkitAppearance: 'none',
										background: 'transparent',
										height: 22,
										width: '100%',
										m: 0,
										cursor: 'pointer',
										position: 'relative',
										'&:focus': { outline: 'none' },
										'&::-webkit-slider-runnable-track': {
											height: 22,
											background: 'transparent',
										},
										'&::-webkit-slider-thumb': {
											WebkitAppearance: 'none',
											appearance: 'none',
											width: 22,
											height: 22,
											borderRadius: '50%',
											background: 'transparent',
											cursor: 'grab',
										},
										'&::-moz-range-track': {
											height: 22,
											background: 'transparent',
										},
										'&::-moz-range-thumb': {
											width: 22,
											height: 22,
											border: 'none',
											background: 'transparent',
											cursor: 'grab',
										},
									}}
								/>
							</Box>
							<Box
								sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}
							>
								<Typography
									sx={{
										fontFamily: monoFontFamily,
										fontWeight: 500,
										fontSize: 10,
										color: '#B4AC9A',
									}}
								>
									0%
								</Typography>
								<Typography
									sx={{
										fontFamily: monoFontFamily,
										fontWeight: 500,
										fontSize: 10,
										color: '#B4AC9A',
									}}
								>
									50%
								</Typography>
								<Typography
									sx={{
										fontFamily: monoFontFamily,
										fontWeight: 500,
										fontSize: 10,
										color: '#B4AC9A',
									}}
								>
									100%
								</Typography>
							</Box>
						</Box>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 0.5,
								border: `1.5px solid ${surface.borderStrong}`,
								borderRadius: '11px',
								bgcolor: '#fff',
								p: '8px 13px',
								alignSelf: 'flex-start',
							}}
						>
							<Box
								component="input"
								value={percentage}
								onChange={(e: ChangeEvent<HTMLInputElement>) =>
									setPercentage(
										clampPct(
											parseInt(
												e.target.value.replace(/[^0-9]/g, ''),
												10,
											),
										),
									)
								}
								inputMode="numeric"
								sx={{
									border: 'none',
									outline: 'none',
									background: 'transparent',
									width: 46,
									textAlign: 'right',
									font: "800 22px 'Baloo 2'",
									color: ink.primary,
								}}
							/>
							<Typography sx={{ font: "800 20px 'Baloo 2'", color: '#8B8472' }}>
								%
							</Typography>
						</Box>
					</Box>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 0.625,
							mt: 1.375,
							color: '#B4AC9A',
						}}
					>
						<Ms name="info" sx={{ fontSize: 14 }} />
						<Typography sx={{ fontWeight: 600, fontSize: 11 }}>
							Users are bucketed by a stable hash — ramping up never re-rolls
							those already in.
						</Typography>
					</Box>

					{/* audience */}
					<Box sx={{ mt: 3 }}>
						<Label>Audience</Label>
					</Box>
					<Box
						sx={{
							display: 'flex',
							gap: 0.875,
							bgcolor: '#F4F1E9',
							borderRadius: '11px',
							p: 0.5,
							width: 'max-content',
							mt: 1.25,
						}}
					>
						{[
							{ on: false, label: 'Everyone' },
							{ on: true, label: 'Only matching users' },
						].map((seg) => {
							const active = audienceOn === seg.on;
							return (
								<Box
									key={seg.label}
									onClick={() => setAudience(seg.on)}
									sx={{
										cursor: 'pointer',
										font: "700 13px 'Nunito'",
										borderRadius: '9px',
										px: 1.75,
										py: 1.125,
										bgcolor: active ? '#fff' : 'transparent',
										color: active ? ink.primary : '#8B8472',
										boxShadow: active ? '0 1px 3px rgba(40,33,20,.12)' : 'none',
									}}
								>
									{seg.label}
								</Box>
							);
						})}
					</Box>
					{audienceOn && (
						<Box
							sx={{
								border: `1.5px solid ${surface.border}`,
								borderRadius: '13px',
								p: 1.875,
								mt: 1.625,
								bgcolor: '#FCFAF3',
							}}
						>
							<Typography
								sx={{
									fontWeight: 600,
									fontSize: 11,
									color: '#8B8472',
									mb: 1.375,
								}}
							>
								User must match{' '}
								<Box
									component="span"
									sx={{ fontWeight: 800, color: '#3A352C' }}
								>
									all
								</Box>{' '}
								of these:
							</Typography>
							<Stack spacing={1.125}>
								{conditions.map((c, index) => (
									<Box
										key={index}
										sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
									>
										<Box
											component="select"
											value={c.type}
											onChange={(e: ChangeEvent<HTMLSelectElement>) =>
												setCondType(index, e.target.value)
											}
											sx={{ ...selectSx, flex: 1 }}
										>
											{TYPE_OPTIONS.map((t) => (
												<option key={t.value} value={t.value}>
													{t.label}
												</option>
											))}
										</Box>
										<Box
											component="select"
											value={c.operator}
											onChange={(e: any) =>
												setCondOperator(index, e.target.value)
											}
											sx={{ ...selectSx, width: 130 }}
										>
											{operatorsForType(c.type).map((op) => (
												<option key={op} value={op}>
													{operatorLabels[op] || op}
												</option>
											))}
										</Box>
										<Box
											component="input"
											value={c.values[0] ?? ''}
											onChange={(e: any) => setCondValue(index, e.target.value)}
											placeholder="value"
											sx={valueInputSx}
										/>
										<Ms
											name="close"
											onClick={() => removeCondition(index)}
											sx={{
												fontSize: 19,
												color: '#C8503C',
												p: 0.875,
												borderRadius: '8px',
												cursor: 'pointer',
											}}
										/>
									</Box>
								))}
							</Stack>
							<Box
								onClick={addCondition}
								sx={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: 0.75,
									font: "700 12px 'Nunito'",
									color: '#9A6F1C',
									bgcolor: '#fff',
									border: '1.5px dashed #E0D6C2',
									borderRadius: '9px',
									p: '8px 13px',
									mt: 1.375,
									cursor: 'pointer',
								}}
							>
								<Ms name="add" sx={{ fontSize: 17 }} />
								Add condition
							</Box>
						</Box>
					)}

					{/* description */}
					<Box sx={{ mt: 3, mb: 1.125 }}>
						<Label>
							Description{' '}
							<Box
								component="span"
								sx={{ fontWeight: 600, color: '#B4AC9A', letterSpacing: 0 }}
							>
								· optional
							</Box>
						</Label>
					</Box>
					<Box
						component="textarea"
						value={description}
						onChange={(e: any) => setDescription(e.target.value)}
						placeholder="What is this rollout gating?"
						sx={{
							...fieldSx,
							minHeight: 64,
							resize: 'vertical',
							lineHeight: 1.5,
						}}
					/>

					{/* group (admin-only organisation; not published) */}
					<Box sx={{ mt: 3, mb: 1.125 }}>
						<Label>
							Group{' '}
							<Box
								component="span"
								sx={{ fontWeight: 600, color: '#B4AC9A', letterSpacing: 0 }}
							>
								· optional · organises the rollouts list only
							</Box>
						</Label>
					</Box>
					<Box
						component="input"
						value={group}
						onChange={(e: any) => setGroup(e.target.value)}
						placeholder="e.g. Checkout & Billing"
						sx={fieldSx}
					/>

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
							startIcon={
								<Ms
									name={isEdit ? 'check' : 'rocket_launch'}
									sx={{ fontSize: 18 }}
								/>
							}
							sx={technicalButtonSx({ disabled: !canSubmit })}
						>
							{isEdit ? 'Save changes' : 'Create rollout'}
						</Button>
					</Box>
				</Box>

				{/* RIGHT: pending + json + note */}
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
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1,
									mb: 1.625,
								}}
							>
								<Ms
									name="pending_actions"
									sx={{ fontSize: 18, color: '#7E776A' }}
								/>
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
								<Typography
									sx={{
										fontWeight: 600,
										fontSize: 12,
										color: '#B4AC9A',
										textAlign: 'center',
										py: 1,
									}}
								>
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
											<Box
												sx={{
													display: 'flex',
													alignItems: 'center',
													gap: 0.75,
													mt: 0.375,
													flexWrap: 'wrap',
													fontFamily: monoFontFamily,
													fontWeight: 500,
													fontSize: 11,
												}}
											>
												<Box
													component="span"
													sx={{
														color: '#B4AC9A',
														textDecoration: 'line-through',
													}}
												>
													{c.from}
												</Box>
												<Ms
													name="arrow_forward"
													sx={{ fontSize: 14, color: '#C2BAA8' }}
												/>
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
						<Box
							sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.375 }}
						>
							<Ms name="data_object" sx={{ fontSize: 17, color: '#7E776A' }} />
							<Typography
								sx={{
									fontFamily: monoFontFamily,
									fontWeight: 700,
									fontSize: 11,
									letterSpacing: '.04em',
									color: ink.soft,
								}}
							>
								PREVIEW
							</Typography>
							<Box
								sx={{
									fontFamily: monoFontFamily,
									fontWeight: 600,
									fontSize: 10,
									color: '#3F7A2D',
									bgcolor: '#E9F4E0',
									borderRadius: '6px',
									px: 0.875,
									py: 0.25,
								}}
							>
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
					<Box
						sx={{
							bgcolor: '#fff',
							border: '1px solid #DCE6E3',
							borderRadius: '16px',
							p: '15px 17px',
							display: 'flex',
							alignItems: 'flex-start',
							gap: 1.25,
						}}
					>
						<Ms name="info" sx={{ fontSize: 19, color: '#3E8E84' }} />
						<Typography
							sx={{
								fontWeight: 500,
								fontSize: 12,
								lineHeight: 1.55,
								color: '#46615C',
							}}
						>
							The value users in this rollout actually receive is set per-flag
							when you attach it from the Flags page.
						</Typography>
					</Box>
				</Box>
			</Box>
		</Box>
	);
}
