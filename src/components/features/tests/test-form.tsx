'use client';

// TestForm — unified Create / Edit A/B-test screen (Test Form.dc.html).
// Mirrors FlagForm: owns editable state, derives key / live JSON / pending-changes;
// the page supplies initial values and the submit / complete / delete callbacks.

import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { validateKey } from '@/lib/utils';
import {
	conditionTemplates,
	operatorLabels,
} from '@/components/features/rules/rule-templates';
import {
	codeSurface,
	ink,
	monoFontFamily,
	surface,
	technicalButtonSx,
} from '@/theme/designTokens';
import type { Condition, ConditionOperator, ConditionType } from '@/types';
import { CONDITION_OPERATORS } from '@/types';

export interface TestGroupValue {
	name: string;
	weight: number;
}
export interface TestFormValues {
	name: string;
	key: string;
	groups: TestGroupValue[];
	adjustSplit: boolean;
	conditions: Condition[];
	description: string;
	/** Admin-only organizational group label (distinct from the A/B `groups`). */
	group: string;
	archived?: boolean;
}
export interface TestFormSubmit {
	key: string;
	name: string;
	description: string;
	group: string;
	conditions: Condition[];
	groups: TestGroupValue[];
}

interface TestFormProps {
	mode: 'create' | 'edit';
	initial: TestFormValues;
	saving: boolean;
	saveError?: string | null;
	onSubmit: (payload: TestFormSubmit) => void;
	onComplete?: () => void;
	onDelete?: () => void;
	cancelHref?: string;
}

const PALETTE = ['#F6A444', '#54C9C0', '#F47C5D', '#82C868', '#D8CFBC'];

// Audience field options ↔ real ConditionType. Derived from the shared condition
// templates so every supported type (incl. build_number, os_version, language,
// custom_attribute) is available and stays in sync with the SDK.
const FIELD_OPTS: Array<{ type: ConditionType; label: string }> =
	conditionTemplates.map((t) => ({ type: t.type, label: t.label }));

// Operators valid for a given condition type (matches SDK evaluation).
const operatorsForType = (type: ConditionType): ConditionOperator[] =>
	CONDITION_OPERATORS[type] ?? ['equals'];

function slug(s: string): string {
	return (s || '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function evenSplit(groups: TestGroupValue[]): TestGroupValue[] {
	const n = groups.length;
	const base = Math.floor(100 / n);
	const rem = 100 - base * n;
	return groups.map((g, i) => ({
		name: g.name,
		weight: base + (i < rem ? 1 : 0),
	}));
}

function Ms({
	name,
	sx,
	onClick,
}: {
	name: string;
	sx?: any;
	onClick?: () => void;
}) {
	return (
		<Box component="span" className="ms" sx={sx} onClick={onClick}>
			{name}
		</Box>
	);
}
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

function groupsLabel(groups: TestGroupValue[]): string {
	return groups.map((g) => `${g.name} ${g.weight}%`).join(' · ');
}
function audienceLabel(on: boolean, conditions: Condition[]): string {
	if (!on || conditions.length === 0) {
		return 'Everyone';
	}
	return `${conditions.length} condition${conditions.length === 1 ? '' : 's'}`;
}

export default function TestForm({
	mode,
	initial,
	saving,
	saveError,
	onSubmit,
	onComplete,
	onDelete,
	cancelHref = '/dashboard/tests',
}: TestFormProps) {
	const isEdit = mode === 'edit';
	const [name, setName] = useState(initial.name);
	const [groups, setGroups] = useState<TestGroupValue[]>(initial.groups);
	const [adjustSplit, setAdjustSplit] = useState(initial.adjustSplit);
	const [audienceOn, setAudienceOn] = useState(
		(initial.conditions?.length ?? 0) > 0,
	);
	const [conditions, setConditions] = useState<Condition[]>(initial.conditions);
	const [description, setDescription] = useState(initial.description);
	const [group, setGroup] = useState(initial.group);

	const keyText = slug(name) || (isEdit ? initial.key : '');
	const keyChanged = isEdit && keyText !== initial.key && keyText.length > 0;
	const keyValidation = validateKey(keyText);
	const keyAvailable =
		!keyValidation.error && (!isEdit ? keyText.length > 0 : keyChanged);

	const effGroups = adjustSplit ? groups : evenSplit(groups);
	const total = effGroups.reduce((n, g) => n + g.weight, 0);
	const valid = total === 100;
	const canRemove = groups.length > 2;
	const canAdd = groups.length < 5;

	// A group literally named "Control" sorts first in this authoring list (baseline on
	// top); on the Tests card it's pushed last. Renaming it away from "control" drops the
	// special treatment and it keeps its natural position.
	const isControl = (name: string) => name.trim().toLowerCase() === 'control';
	const displayOrder = groups
		.map((_, i) => i)
		.sort(
			(a, b) =>
				(isControl(groups[a].name) ? 0 : 1) -
				(isControl(groups[b].name) ? 0 : 1),
		);
	const orderedGroups = displayOrder.map((i) => ({ g: groups[i], i }));
	const orderedEff = displayOrder.map((i) => ({ g: effGroups[i], i }));

	// --- group handlers ---
	const addGroup = () => {
		if (groups.length >= 5) {
			return;
		}
		setGroups((prev) => [
			...prev,
			{ name: `Group ${prev.length + 1}`, weight: 0 },
		]);
	};
	const removeGroup = (i: number) => {
		if (groups.length <= 2) {
			return;
		}
		setGroups((prev) => prev.filter((_, j) => j !== i));
	};
	const setGroupName = (i: number, v: string) => {
		setGroups((prev) => prev.map((g, j) => (j === i ? { ...g, name: v } : g)));
	};
	const setGroupWeight = (i: number, v: string) => {
		const n =
			v === ''
				? 0
				: Math.max(
						0,
						Math.min(100, parseInt(v.replace(/[^0-9]/g, ''), 10) || 0),
					);
		setGroups((prev) =>
			prev.map((g, j) => (j === i ? { ...g, weight: n } : g)),
		);
	};
	const distribute = () => {
		setGroups((prev) => evenSplit(prev));
	};
	const toggleAdjust = () => {
		if (adjustSplit) {
			// snapshot the even split into the editable weights, then turn off
			setGroups((prev) => evenSplit(prev));
			setAdjustSplit(false);
		} else {
			setAdjustSplit(true);
		}
	};

	// --- audience handlers ---
	const setAudience = (on: boolean) => {
		setAudienceOn(on);
		if (on && conditions.length === 0) {
			setConditions([{ type: 'platform', operator: 'in', values: ['iOS'] }]);
		}
	};
	const addCondition = () => {
		setConditions((prev) => [
			...prev,
			{ type: 'app_version', operator: 'greater_than_or_equal', values: [] },
		]);
	};
	const removeCondition = (i: number) => {
		setConditions((prev) => {
			const next = prev.filter((_, j) => j !== i);
			if (next.length === 0) {
				setAudienceOn(false);
			}
			return next;
		});
	};
	const setCondType = (i: number, type: ConditionType) => {
		setConditions((prev) =>
			prev.map((c, j) =>
				j === i
					? { ...c, type, operator: operatorsForType(type)[0], values: [] }
					: c,
			),
		);
	};
	const setCondOp = (i: number, operator: ConditionOperator) => {
		setConditions((prev) =>
			prev.map((c, j) => (j === i ? { ...c, operator } : c)),
		);
	};
	const setCondValue = (i: number, raw: string) => {
		setConditions((prev) =>
			prev.map((c, j) => {
				if (j !== i) {
					return c;
				}
				const values =
					c.operator === 'in' || c.operator === 'not_in'
						? raw
								.split(',')
								.map((v) => v.trim())
								.filter(Boolean)
						: raw === ''
							? []
							: [raw];
				return { ...c, values };
			}),
		);
	};

	// --- pending changes (edit) ---
	const changes = useMemo(() => {
		if (!isEdit) {
			return [];
		}
		const out: Array<{ field: string; from: string; to: string }> = [];
		if (name !== initial.name) {
			out.push({ field: 'NAME', from: initial.name || '∅', to: name || '∅' });
		}
		if (keyChanged) {
			out.push({ field: 'KEY', from: initial.key, to: keyText });
		}
		const origEff = initial.adjustSplit
			? initial.groups
			: evenSplit(initial.groups);
		if (groupsLabel(effGroups) !== groupsLabel(origEff)) {
			out.push({
				field: 'GROUPS',
				from: groupsLabel(origEff),
				to: groupsLabel(effGroups),
			});
		}
		const origAud = audienceLabel(
			(initial.conditions?.length ?? 0) > 0,
			initial.conditions,
		);
		if (audienceLabel(audienceOn, conditions) !== origAud) {
			out.push({
				field: 'AUDIENCE',
				from: origAud,
				to: audienceLabel(audienceOn, conditions),
			});
		}
		if (description !== initial.description) {
			out.push({
				field: 'HYPOTHESIS',
				from: initial.description || '∅',
				to: description || '∅',
			});
		}
		if (group !== initial.group) {
			out.push({
				field: 'GROUP',
				from: initial.group || '∅',
				to: group || '∅',
			});
		}
		return out;
	}, [
		isEdit,
		name,
		keyChanged,
		keyText,
		effGroups,
		audienceOn,
		conditions,
		description,
		group,
		initial,
	]);

	const dirty = (isEdit ? changes.length > 0 : keyText.length > 0) && valid;
	const canSubmit = dirty && !keyValidation.error && !saving;

	const json = useMemo(() => {
		const audience =
			!audienceOn || conditions.length === 0
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
				key: keyText || 'new_test',
				groups: effGroups.map((g) => ({ name: g.name, weight: g.weight })),
				audience,
			},
			null,
			2,
		);
	}, [keyText, effGroups, audienceOn, conditions]);

	const handleSubmit = () => {
		if (!canSubmit) {
			return;
		}
		onSubmit({
			key: keyText,
			name,
			description,
			group: group.trim(),
			conditions: audienceOn ? conditions : [],
			groups: effGroups,
		});
	};

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
	const condSelSx = {
		appearance: 'none',
		WebkitAppearance: 'none',
		border: `1.5px solid ${surface.borderStrong}`,
		borderRadius: '9px',
		bgcolor: '#fff',
		p: '8px 10px',
		font: "600 12px 'Nunito'",
		color: ink.primary,
		outline: 'none',
		cursor: 'pointer',
		'&:focus': { borderColor: ink.primary },
	} as const;

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
							href="/dashboard/tests"
							style={{ color: 'inherit', textDecoration: 'none' }}
						>
							Tests
						</Link>
						<Ms name="chevron_right" sx={{ fontSize: 15 }} />
						<span>{isEdit ? `${initial.key} · Edit` : 'New test'}</span>
					</Box>
					<Typography variant="h4" sx={{ mt: 1 }}>
						{isEdit ? 'Edit test' : 'Create a test'}
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
							? 'Adjust groups, split or audience. Attach it to a flag from the Flags page to go live.'
							: 'Define the groups and how traffic splits. Map group values per-flag afterwards from the Flags page.'}
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
							Complete
						</Button>
						<Button
							variant="outlined"
							size="small"
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
						Test name{' '}
						<Box component="span" sx={{ color: '#C8503C' }}>
							*
						</Box>
					</Label>
					<Box
						component="input"
						value={name}
						onChange={(e: any) => setName(e.target.value)}
						placeholder="e.g. Paywall copy"
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
							{keyText || '—'}
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
								. Analytics already collected stay under the old key.
							</Typography>
						</Box>
					)}

					{/* groups */}
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 1.25,
							mt: 3.25,
							mb: 1.5,
						}}
					>
						<Label>Groups</Label>
						<Box
							onClick={toggleAdjust}
							sx={{
								ml: 'auto',
								display: 'inline-flex',
								alignItems: 'center',
								gap: 1.125,
								cursor: 'pointer',
								fontWeight: 700,
								fontSize: 11,
								color: adjustSplit ? ink.primary : '#8B8472',
							}}
						>
							Adjust split
							<Box
								sx={{
									width: 36,
									height: 20,
									borderRadius: '11px',
									bgcolor: adjustSplit ? ink.primary : '#D8D2C4',
									position: 'relative',
									transition: 'background .15s ease',
								}}
							>
								<Box
									sx={{
										position: 'absolute',
										top: '2px',
										left: adjustSplit ? '18px' : '2px',
										width: 16,
										height: 16,
										borderRadius: '50%',
										bgcolor: '#fff',
										boxShadow: '0 1px 2px rgba(0,0,0,.25)',
										transition: 'left .15s ease',
									}}
								/>
							</Box>
						</Box>
					</Box>

					{/* split bar */}
					<Box
						sx={{
							display: 'flex',
							height: 14,
							borderRadius: '7px',
							overflow: 'hidden',
							gap: '2px',
							mb: 1.75,
						}}
					>
						{orderedEff.map(({ g, i }) => (
							<Box
								key={i}
								sx={{
									width: `${total > 0 ? (g.weight / total) * 100 : 0}%`,
									bgcolor: PALETTE[i % PALETTE.length],
									transition: 'width .15s ease',
								}}
							/>
						))}
					</Box>

					<Stack spacing={1.125}>
						{orderedGroups.map(({ g, i }) => (
							<Box
								key={i}
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1.25,
									border: `1.5px solid ${surface.border}`,
									borderRadius: '12px',
									p: '10px 12px',
									bgcolor: '#FCFAF3',
								}}
							>
								<Box
									sx={{
										width: 12,
										height: 12,
										borderRadius: '4px',
										bgcolor: PALETTE[i % PALETTE.length],
										flexShrink: 0,
									}}
								/>
								<Box
									component="input"
									value={g.name}
									onChange={(e: any) => setGroupName(i, e.target.value)}
									placeholder="Group name"
									sx={{
										flex: 1,
										minWidth: 0,
										border: `1.5px solid ${surface.borderStrong}`,
										borderRadius: '9px',
										bgcolor: '#fff',
										p: '8px 11px',
										font: "700 13px 'Nunito'",
										color: ink.primary,
										outline: 'none',
										'&:focus': { borderColor: ink.primary },
									}}
								/>
								{adjustSplit ? (
									<Box
										sx={{ display: 'flex', alignItems: 'center', gap: 0.375 }}
									>
										<Box
											component="input"
											value={String(effGroups[i].weight)}
											onChange={(e: any) => setGroupWeight(i, e.target.value)}
											inputMode="numeric"
											sx={{
												width: 58,
												textAlign: 'right',
												border: `1.5px solid ${surface.borderStrong}`,
												borderRadius: '9px',
												bgcolor: '#fff',
												p: '8px 6px 8px 10px',
												font: '600 13px ' + monoFontFamily,
												color: ink.primary,
												outline: 'none',
												'&:focus': { borderColor: ink.primary },
											}}
										/>
										<Typography
											sx={{
												fontFamily: monoFontFamily,
												fontWeight: 700,
												fontSize: 13,
												color: '#8B8472',
											}}
										>
											%
										</Typography>
									</Box>
								) : (
									<Typography
										sx={{
											fontFamily: monoFontFamily,
											fontWeight: 700,
											fontSize: 14,
											color: '#8B8472',
											width: 50,
											textAlign: 'right',
										}}
									>
										{effGroups[i].weight}%
									</Typography>
								)}
								<Ms
									name="delete"
									onClick={() => removeGroup(i)}
									sx={{
										fontSize: 19,
										color: canRemove ? '#C8503C' : '#D8D2C4',
										opacity: canRemove ? 1 : 0.4,
										p: 0.75,
										borderRadius: '8px',
										cursor: canRemove ? 'pointer' : 'default',
									}}
								/>
							</Box>
						))}
					</Stack>

					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 1.5,
							mt: 1.625,
							flexWrap: 'wrap',
						}}
					>
						<Box
							onClick={addGroup}
							sx={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 0.75,
								fontWeight: 700,
								fontSize: 12,
								color: canAdd ? '#9A6F1C' : '#C2BAA8',
								bgcolor: '#fff',
								border: `1.5px dashed ${canAdd ? '#E0D6C2' : '#EAE2D2'}`,
								borderRadius: '9px',
								p: '9px 14px',
								cursor: canAdd ? 'pointer' : 'default',
								opacity: canAdd ? 1 : 0.5,
							}}
						>
							<Ms name="add" sx={{ fontSize: 17 }} />
							Add group
						</Box>
						<Typography
							sx={{ fontWeight: 600, fontSize: 11, color: '#B4AC9A' }}
						>
							{groups.length} of 5 · 2 minimum
						</Typography>
						{adjustSplit && (
							<Box
								sx={{
									ml: 'auto',
									display: 'inline-flex',
									alignItems: 'center',
									gap: 1.25,
								}}
							>
								<Box
									onClick={distribute}
									sx={{
										display: 'inline-flex',
										alignItems: 'center',
										gap: 0.625,
										cursor: 'pointer',
										fontWeight: 700,
										fontSize: 11,
										color: '#9A6F1C',
										bgcolor: '#FCEFD2',
										border: '1px solid #F3E2BD',
										borderRadius: '8px',
										p: '6px 11px',
									}}
								>
									<Ms name="balance" sx={{ fontSize: 15 }} />
									Even split
								</Box>
								<Box
									sx={{
										display: 'inline-flex',
										alignItems: 'center',
										gap: 0.75,
										fontFamily: monoFontFamily,
										fontWeight: 700,
										fontSize: 12,
										color: valid ? '#3F7A2D' : '#C8503C',
										bgcolor: valid ? '#E9F4E0' : '#FBEAE5',
										border: `1px solid ${valid ? '#CFE7BF' : '#F0CFC6'}`,
										borderRadius: '8px',
										p: '6px 11px',
									}}
								>
									<Ms
										name={valid ? 'check_circle' : 'error'}
										sx={{ fontSize: 15 }}
									/>
									Total {total}%
								</Box>
							</Box>
						)}
					</Box>

					{/* audience */}
					<Box sx={{ mt: 3.25, mb: 1.25 }}>
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
								Only enrol users matching{' '}
								<Box
									component="span"
									sx={{ fontWeight: 800, color: '#3A352C' }}
								>
									all
								</Box>{' '}
								of these:
							</Typography>
							<Stack spacing={1.125}>
								{conditions.map((c, i) => (
									<Box
										key={i}
										sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
									>
										<Box
											component="select"
											value={c.type}
											onChange={(e: any) => setCondType(i, e.target.value)}
											sx={{ ...condSelSx, flex: 1 }}
										>
											{FIELD_OPTS.map((f) => (
												<option key={f.type} value={f.type}>
													{f.label}
												</option>
											))}
										</Box>
										<Box
											component="select"
											value={c.operator}
											onChange={(e: any) => setCondOp(i, e.target.value)}
											sx={{ ...condSelSx, width: 84 }}
										>
											{operatorsForType(c.type).map((op) => (
												<option key={op} value={op}>
													{operatorLabels[op] || op}
												</option>
											))}
										</Box>
										<Box
											component="input"
											value={c.values.join(', ')}
											onChange={(e: any) => setCondValue(i, e.target.value)}
											placeholder="value"
											sx={{
												flex: 1,
												border: `1.5px solid ${surface.borderStrong}`,
												borderRadius: '9px',
												bgcolor: '#fff',
												p: '8px 11px',
												font: '500 13px ' + monoFontFamily,
												color: ink.primary,
												outline: 'none',
												'&:focus': { borderColor: ink.primary },
											}}
										/>
										<Ms
											name="close"
											onClick={() => removeCondition(i)}
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
									cursor: 'pointer',
									fontWeight: 700,
									fontSize: 12,
									color: '#9A6F1C',
									bgcolor: '#fff',
									border: '1.5px dashed #E0D6C2',
									borderRadius: '9px',
									p: '8px 13px',
									mt: 1.375,
								}}
							>
								<Ms name="add" sx={{ fontSize: 17 }} />
								Add condition
							</Box>
						</Box>
					)}

					{/* hypothesis */}
					<Box sx={{ mt: 3.25, mb: 1.125 }}>
						<Label>
							Hypothesis{' '}
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
						placeholder="What are you testing, and what do you expect to win?"
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
								· optional · organises the tests list only
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
								<Ms name={isEdit ? 'check' : 'science'} sx={{ fontSize: 18 }} />
							}
							sx={technicalButtonSx({ disabled: !canSubmit })}
						>
							{isEdit ? 'Save changes' : 'Create test'}
						</Button>
					</Box>
				</Box>

				{/* RIGHT rail */}
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
							{json}
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
							Each group serves its own flag value — you map those values
							per-flag when you attach the test from the Flags page.
						</Typography>
					</Box>
				</Box>
			</Box>
		</Box>
	);
}
