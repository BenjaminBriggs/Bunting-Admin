'use client';

import {
	Alert,
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	IconButton,
	Stack,
	Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import {
	conditionTemplates,
	operatorLabels,
} from '@/components/features/rules/rule-templates';
import { generateId } from '@/lib/utils';
import {
	codeSurface,
	envColors,
	ink,
	monoFontFamily,
	surface,
	technicalButtonSx,
} from '@/theme/designTokens';
import type {
	ConditionalVariant,
	Environment,
	FlagType,
	FlagValue,
} from '@/types';
import type { RuleCondition } from '@/types/rules';
import FlagValueInput from '../flags/flag-value-input';

interface VariantCreatorModalProps {
	open: boolean;
	onClose: () => void;
	onSave: (variant: ConditionalVariant) => void;
	environment: Environment;
	flagType: FlagType;
	flagId: string;
	appId?: string;
	existingVariant?: ConditionalVariant;
}

// Operator symbol for the live summary sentence.
const OP_WORDS: Record<string, string> = {
	equals: 'is',
	does_not_equals: 'is not',
	between: 'is between',
	greater_than_or_equal: 'is at least',
	greater_than: 'is greater than',
	less_than: 'is less than',
	less_than_or_equal: 'is at most',
	in: 'is any of',
	not_in: 'is none of',
	custom: 'matches',
};

function typeLabel(type: string): string {
	return conditionTemplates.find((t) => t.type === type)?.label ?? type;
}
function operatorsForType(type: string): string[] {
	return (
		conditionTemplates.find((t) => t.type === type)?.operators ?? ['equals']
	);
}
function placeholderForType(type: string): string {
	const t = conditionTemplates.find((c) => c.type === type);
	if (t?.placeholder) {
		return t.placeholder.split(',')[0]?.trim() || 'value';
	}
	return 'value';
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

export function VariantCreatorModal({
	open,
	onClose,
	onSave,
	environment,
	flagType,
	existingVariant,
}: VariantCreatorModalProps) {
	const [variantValue, setVariantValue] = useState<FlagValue>('');
	const [conditions, setConditions] = useState<RuleCondition[]>([]);
	const [order, setOrder] = useState(1);
	const [errors, setErrors] = useState<string[]>([]);

	const env = envColors[environment] ?? envColors.production;

	const getDefaultValue = useCallback((): FlagValue => {
		switch (flagType as any) {
			case 'bool':
				return false;
			case 'string':
				return '';
			case 'int':
			case 'double':
				return 0;
			case 'date':
				return new Date().toISOString().split('T')[0];
			case 'json':
				return {};
			default:
				return '';
		}
	}, [flagType]);

	const resetForm = useCallback(() => {
		setVariantValue(getDefaultValue());
		setConditions([]);
		setOrder(1);
		setErrors([]);
	}, [getDefaultValue]);

	useEffect(() => {
		if (existingVariant) {
			setVariantValue(existingVariant.value);
			setConditions(existingVariant.conditions);
			setOrder(existingVariant.order);
		} else {
			resetForm();
		}
	}, [existingVariant, open, resetForm]);

	const generateVariantName = (conds: RuleCondition[]): string => {
		if (conds.length === 0) {
			return 'Variant';
		}
		return conds
			.map((condition) => {
				if (condition.type === 'app_version') {
					return `v${condition.values.join('/')}`;
				}
				if (condition.type === 'platform') {
					return condition.values.join('/');
				}
				return `${condition.type}:${condition.values.join('/')}`;
			})
			.join(' + ');
	};

	const clearErrors = () => {
		if (errors.length > 0) {
			setErrors([]);
		}
	};

	// --- Inline condition editing (matches the Variant Editor design) ---
	const addCondition = () => {
		const type = 'app_version';
		const next: RuleCondition = {
			type,
			operator: operatorsForType(type)[0],
			values: [],
		} as RuleCondition;
		setConditions((prev) => [...prev, next]);
		clearErrors();
	};
	const removeCondition = (index: number) => {
		setConditions((prev) => prev.filter((_, i) => i !== index));
		clearErrors();
	};
	const setConditionType = (index: number, type: string) => {
		setConditions((prev) =>
			prev.map((c, i) =>
				i === index
					? ({
							...c,
							type,
							operator: operatorsForType(type)[0],
							values: [],
						} as RuleCondition)
					: c,
			),
		);
		clearErrors();
	};
	const setConditionOperator = (index: number, operator: string) => {
		setConditions((prev) =>
			prev.map((c, i) =>
				i === index ? ({ ...c, operator } as RuleCondition) : c,
			),
		);
		clearErrors();
	};
	const addValue = (index: number, raw: string) => {
		const val = (raw || '').trim();
		if (!val) {
			return;
		}
		setConditions((prev) =>
			prev.map((c, i) =>
				i === index && !c.values.includes(val)
					? { ...c, values: [...c.values, val] }
					: c,
			),
		);
		clearErrors();
	};
	const removeValue = (index: number, idx: number) => {
		setConditions((prev) =>
			prev.map((c, i) =>
				i === index
					? { ...c, values: c.values.filter((_, vi) => vi !== idx) }
					: c,
			),
		);
		clearErrors();
	};
	// Single-value operators (equals, greater_than, …) bind the input straight to
	// values[0] so typing commits live — no Enter needed.
	const setSingleValue = (index: number, val: string) => {
		setConditions((prev) =>
			prev.map((c, i) =>
				i === index ? { ...c, values: val === '' ? [] : [val] } : c,
			),
		);
		clearErrors();
	};
	// `between` keeps two positional inputs (min, max).
	const setBetweenValue = (index: number, idx: 0 | 1, val: string) => {
		setConditions((prev) =>
			prev.map((c, i) => {
				if (i !== index) {
					return c;
				}
				const vals = [c.values[0] ?? '', c.values[1] ?? ''];
				vals[idx] = val;
				return { ...c, values: vals[0] === '' && vals[1] === '' ? [] : vals };
			}),
		);
		clearErrors();
	};

	const valueMode = (operator: string): 'single' | 'between' | 'multi' => {
		if (operator === 'between') {
			return 'between';
		}
		if (operator === 'in' || operator === 'not_in') {
			return 'multi';
		}
		return 'single';
	};

	const handleVariantValueChange = (value: FlagValue) => {
		setVariantValue(value);
		clearErrors();
	};

	const validateForm = (): boolean => {
		const newErrors: string[] = [];
		if (flagType === 'string' && !String(variantValue).trim()) {
			newErrors.push('Variant value is required for string flags');
		}
		if (flagType === 'json') {
			try {
				JSON.parse(
					typeof variantValue === 'string'
						? variantValue
						: JSON.stringify(variantValue),
				);
			} catch {
				newErrors.push('Variant value must be valid JSON');
			}
		}
		if (conditions.length === 0) {
			newErrors.push(
				'At least one condition is required for conditional variants',
			);
		}
		if (conditions.some((c) => c.values.length === 0)) {
			newErrors.push('Every condition needs at least one value');
		}
		setErrors(newErrors);
		return newErrors.length === 0;
	};

	const handleSave = () => {
		if (!validateForm()) {
			return;
		}
		onSave({
			id: existingVariant?.id || generateId(),
			name: generateVariantName(conditions),
			type: 'conditional',
			conditions,
			value: variantValue,
			order,
		});
		onClose();
	};

	const handleClose = () => {
		resetForm();
		onClose();
	};

	// Plain-language summary + live JSON
	const summary =
		conditions.filter((c) => c.values.length).length === 0
			? 'the conditions match'
			: conditions
					.filter((c) => c.values.length)
					.map(
						(c) =>
							`${typeLabel(c.type)} ${OP_WORDS[c.operator] || c.operator} ${c.values.join(', ')}`,
					)
					.join(' and ');
	const serveDisplay =
		flagType === 'json'
			? typeof variantValue === 'string'
				? variantValue
				: JSON.stringify(variantValue)
			: String(variantValue);
	const variantJson = JSON.stringify(
		{
			value: variantValue,
			conditions: conditions.map((c) => ({
				type: c.type,
				values: c.values,
				operator: c.operator,
			})),
		},
		null,
		2,
	);

	const labelSx = {
		fontFamily: 'var(--font-nunito)',
		fontWeight: 700,
		fontSize: 11,
		letterSpacing: '.04em',
		textTransform: 'uppercase',
		color: ink.soft,
	} as const;

	const selectSx = {
		appearance: 'none',
		WebkitAppearance: 'none',
		fontFamily: 'var(--font-nunito)',
		fontWeight: 700,
		fontSize: 13,
		color: ink.primary,
		bgcolor: '#fff',
		border: `1.5px solid ${surface.borderStrong}`,
		borderRadius: '9px',
		p: '9px 28px 9px 12px',
		cursor: 'pointer',
		outline: 'none',
		backgroundImage:
			"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23A79F8C' stroke-width='2.4' stroke-linecap='round'><path d='M6 9l6 6 6-6'/></svg>\")",
		backgroundRepeat: 'no-repeat',
		backgroundPosition: 'right 7px center',
		'&:focus': { borderColor: ink.primary },
	} as const;

	// Plain bound value input (single-value + between operators).
	const valueInputSx = {
		flex: 1,
		minWidth: 90,
		border: `1.5px solid ${surface.borderStrong}`,
		borderRadius: '9px',
		bgcolor: '#fff',
		outline: 'none',
		fontFamily: monoFontFamily,
		fontWeight: 500,
		fontSize: 12,
		color: ink.primary,
		p: '8px 10px',
		'&::placeholder': { color: '#B4AC9A' },
		'&:focus': { borderColor: ink.primary },
	} as const;

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
			{/* header */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1.5,
					p: '20px 24px',
					borderBottom: '1px solid #F1EBDD',
				}}
			>
				<Box
					sx={{
						width: 36,
						height: 36,
						borderRadius: '10px',
						bgcolor: env.headerBg,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<Ms name="call_split" sx={{ fontSize: 21, color: env.text }} />
				</Box>
				<Box sx={{ flex: 1 }}>
					<Typography variant="h6" sx={{ fontSize: 17 }}>
						{existingVariant
							? 'Edit conditional variant'
							: 'Add conditional variant'}
					</Typography>
					<Typography sx={{ fontWeight: 600, fontSize: 11, color: ink.muted }}>
						flag variant ·{' '}
						<Box component="span" sx={{ color: env.text }}>
							{env.label}
						</Box>
					</Typography>
				</Box>
				<IconButton onClick={handleClose} size="small">
					<Ms name="close" sx={{ fontSize: 22, color: '#8B8472' }} />
				</IconButton>
			</Box>

			<DialogContent sx={{ p: '20px 24px' }}>
				<Stack spacing={2.5}>
					{errors.length > 0 && (
						<Alert severity="error">
							<ul style={{ margin: 0, paddingLeft: 16 }}>
								{errors.map((error, index) => (
									<li key={index}>{error}</li>
								))}
							</ul>
						</Alert>
					)}

					{/* serve value */}
					<Box>
						<Typography sx={{ ...labelSx, mb: 1.125 }}>
							Serve this value{' '}
							<Box
								component="span"
								sx={{
									fontWeight: 600,
									color: '#B4AC9A',
									textTransform: 'none',
									letterSpacing: 0,
								}}
							>
								· when the rule matches
							</Box>
						</Typography>
						<FlagValueInput
							flagType={flagType}
							value={variantValue}
							onChange={handleVariantValueChange}
							fullWidth
						/>
					</Box>

					{/* targeting rule — inline condition rows */}
					<Box>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'baseline',
								gap: 1.125,
								mb: 1.5,
							}}
						>
							<Typography sx={labelSx}>Targeting rule</Typography>
							<Box
								sx={{
									fontFamily: monoFontFamily,
									fontWeight: 700,
									fontSize: 11,
									color: '#9A9483',
									bgcolor: '#EFE8D9',
									borderRadius: '20px',
									px: 1.125,
									py: 0.25,
								}}
							>
								{conditions.length}
							</Box>
							<Typography
								sx={{
									ml: 'auto',
									fontWeight: 600,
									fontSize: 11,
									color: ink.muted,
								}}
							>
								all must match
							</Typography>
						</Box>

						<Stack>
							{conditions.map((condition, index) => (
								<Box key={index}>
									{index !== 0 && (
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 1,
												my: 0.5,
												ml: '4px',
											}}
										>
											<Box
												sx={{
													fontFamily: monoFontFamily,
													fontWeight: 800,
													fontSize: 10,
													letterSpacing: '.08em',
													color: '#9A6F1C',
													bgcolor: '#FCEFD2',
													borderRadius: '6px',
													px: 1.125,
													py: 0.375,
												}}
											>
												AND
											</Box>
											<Box
												sx={{ flex: 1, height: '1px', bgcolor: '#F1EBDD' }}
											/>
										</Box>
									)}
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1,
											bgcolor: '#FCFAF3',
											border: `1px solid ${surface.border}`,
											borderRadius: '12px',
											p: '9px 10px',
											flexWrap: 'wrap',
										}}
									>
										<Box
											component="select"
											value={condition.type}
											onChange={(e: any) =>
												setConditionType(index, e.target.value)
											}
											sx={selectSx}
										>
											{conditionTemplates.map((t) => (
												<option key={t.type} value={t.type}>
													{t.label}
												</option>
											))}
										</Box>
										<Box
											component="select"
											value={condition.operator}
											onChange={(e: any) =>
												setConditionOperator(index, e.target.value)
											}
											sx={{ ...selectSx, fontWeight: 600, color: ink.soft }}
										>
											{operatorsForType(condition.type).map((op) => (
												<option key={op} value={op}>
													{operatorLabels[op] || op}
												</option>
											))}
										</Box>
										{valueMode(condition.operator) === 'single' && (
											<Box
												component="input"
												value={condition.values[0] ?? ''}
												onChange={(e: any) =>
													setSingleValue(index, e.target.value)
												}
												placeholder={placeholderForType(condition.type)}
												sx={valueInputSx}
											/>
										)}
										{valueMode(condition.operator) === 'between' && (
											<Box
												sx={{
													flex: 1,
													minWidth: 160,
													display: 'flex',
													alignItems: 'center',
													gap: 0.75,
												}}
											>
												<Box
													component="input"
													value={condition.values[0] ?? ''}
													onChange={(e: any) =>
														setBetweenValue(index, 0, e.target.value)
													}
													placeholder="min"
													sx={{ ...valueInputSx, minWidth: 60 }}
												/>
												<Typography
													sx={{
														fontSize: 11,
														fontWeight: 600,
														color: ink.muted,
													}}
												>
													and
												</Typography>
												<Box
													component="input"
													value={condition.values[1] ?? ''}
													onChange={(e: any) =>
														setBetweenValue(index, 1, e.target.value)
													}
													placeholder="max"
													sx={{ ...valueInputSx, minWidth: 60 }}
												/>
											</Box>
										)}
										{valueMode(condition.operator) === 'multi' && (
											<Box
												sx={{
													flex: 1,
													minWidth: 120,
													display: 'flex',
													alignItems: 'center',
													gap: 0.75,
													flexWrap: 'wrap',
													bgcolor: '#fff',
													border: `1.5px solid ${surface.borderStrong}`,
													borderRadius: '9px',
													p: '5px 8px',
												}}
											>
												{condition.values.map((v, i) => (
													<Box
														key={i}
														sx={{
															display: 'inline-flex',
															alignItems: 'center',
															gap: 0.5,
															fontFamily: monoFontFamily,
															fontWeight: 500,
															fontSize: 12,
															color: '#3A352C',
															bgcolor: surface.token,
															borderRadius: '6px',
															pl: 1,
															pr: 0.5,
															py: 0.375,
														}}
													>
														{v}
														<Ms
															name="close"
															onClick={() => removeValue(index, i)}
															sx={{
																fontSize: 15,
																color: '#9A9483',
																cursor: 'pointer',
																borderRadius: '5px',
															}}
														/>
													</Box>
												))}
												<Box
													component="input"
													placeholder={
														condition.values.length === 0
															? `${placeholderForType(condition.type)} — Enter to add`
															: 'add…'
													}
													onKeyDown={(e: any) => {
														if (e.key === 'Enter') {
															e.preventDefault();
															addValue(index, e.currentTarget.value);
															e.currentTarget.value = '';
														}
													}}
													onBlur={(e: any) => {
														addValue(index, e.currentTarget.value);
														e.currentTarget.value = '';
													}}
													sx={{
														flex: 1,
														minWidth: 90,
														border: 'none',
														outline: 'none',
														bgcolor: 'transparent',
														fontFamily: monoFontFamily,
														fontWeight: 500,
														fontSize: 12,
														color: ink.primary,
														p: '4px 2px',
														'&::placeholder': { color: '#B4AC9A' },
													}}
												/>
											</Box>
										)}
										<IconButton
											size="small"
											onClick={() => removeCondition(index)}
										>
											<Ms
												name="delete"
												sx={{ fontSize: 18, color: '#B4AC9A' }}
											/>
										</IconButton>
									</Box>
								</Box>
							))}
						</Stack>

						<Box
							onClick={addCondition}
							sx={{
								mt: conditions.length > 0 ? 1.375 : 0,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: 0.875,
								border: '1.5px dashed #EAD8AE',
								borderRadius: '8px',
								p: 1.25,
								cursor: 'pointer',
								fontFamily: monoFontFamily,
								fontWeight: 600,
								fontSize: 13,
								color: '#9A6F1C',
								bgcolor: '#FCFAF3',
								'&:hover': { bgcolor: '#FBF3DF', borderColor: '#E0C98A' },
							}}
						>
							<Ms name="add" sx={{ fontSize: 18 }} />
							Add condition
						</Box>
					</Box>

					{/* summary sentence */}
					<Box
						sx={{
							bgcolor: '#FCFAF3',
							border: '1px solid #EFE8DA',
							borderRadius: '11px',
							p: '13px 15px',
							fontFamily: 'var(--font-nunito)',
							fontWeight: 600,
							fontSize: 13,
							color: '#3A352C',
							lineHeight: 1.55,
						}}
					>
						<Ms
							name="bolt"
							sx={{
								fontSize: 16,
								color: '#9A6F1C',
								verticalAlign: '-3px',
								mr: 0.625,
							}}
						/>
						Serve{' '}
						<Box
							component="span"
							sx={{ fontFamily: monoFontFamily, fontWeight: 700 }}
						>
							{serveDisplay}
						</Box>{' '}
						when {summary}.
					</Box>

					{/* live JSON */}
					<Box>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
							<Ms name="data_object" sx={{ fontSize: 16, color: '#7E776A' }} />
							<Typography
								sx={{
									fontFamily: monoFontFamily,
									fontWeight: 700,
									fontSize: 11,
									letterSpacing: '.04em',
									color: ink.soft,
								}}
							>
								VARIANT · JSON
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
								lineHeight: 1.65,
								color: codeSurface.text,
								whiteSpace: 'pre',
								overflow: 'auto',
							}}
						>
							{variantJson}
						</Box>
					</Box>
				</Stack>
			</DialogContent>

			<DialogActions sx={{ p: '16px 24px', borderTop: '1px solid #F1EBDD' }}>
				<Button variant="outlined" onClick={handleClose}>
					Cancel
				</Button>
				<Button
					onClick={handleSave}
					startIcon={<Ms name="check" sx={{ fontSize: 18 }} />}
					sx={technicalButtonSx()}
				>
					{existingVariant ? 'Save variant' : 'Add variant'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
