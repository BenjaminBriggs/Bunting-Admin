'use client';

import { Add, Delete } from '@mui/icons-material';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import {
	envColors,
	ink,
	monoFontFamily,
	surface,
	typeColors,
} from '@/theme/designTokens';
import type {
	Condition,
	ConditionalVariant,
	Environment,
	FlagType,
	FlagValue,
} from '@/types';
import { formatValueForDisplay } from './flag-value-input';
import JsonChip from './json-chip';

// The UI carries an "environment" pseudo condition type that is not part of the
// shared ConditionType union; model it locally for condition formatting.
type UICondition = Omit<Condition, 'type'> & {
	type: Condition['type'] | 'environment';
};

// A test as rendered in this column. Each test variant exposes per-environment,
// per-flag values keyed by environment then flag id.
interface ActiveTest {
	id: string;
	name: string;
	variants: Record<
		string,
		{
			percentage: number;
			value?: FlagValue;
			values?: Record<string, Record<string, FlagValue>>;
		}
	>;
}

interface EnvironmentColumnProps {
	environment: Environment;
	flagId: string;
	flagType: string;
	defaultValue: FlagValue;
	variants: ConditionalVariant[];
	activeTests: ActiveTest[];
	activeRollouts: Array<{
		id: string;
		name: string;
		percentage: number;
	}>;
	onVariantAdd: () => void;
	onVariantEdit: (variant: ConditionalVariant) => void;
	onVariantDelete: (variant: ConditionalVariant) => void;
	onTestRolloutAdd: () => void;
	onTestRolloutEdit: (type: 'test' | 'rollout', id: string) => void;
	onDefaultValueEdit: () => void;
}

export default function EnvironmentColumn({
	environment,
	flagId,
	flagType,
	defaultValue,
	variants,
	activeTests,
	activeRollouts,
	onVariantAdd,
	onVariantEdit,
	onVariantDelete,
	onTestRolloutAdd,
	onTestRolloutEdit,
	onDefaultValueEdit,
}: EnvironmentColumnProps) {
	const isJson = flagType.toLowerCase() === 'json';

	const formatValue = (value: FlagValue): string => {
		return formatValueForDisplay(value, flagType as FlagType);
	};

	// Raw per-variant values for this environment/flag (used to render JSON chips).
	const getTestVariantRawValues = (
		test: ActiveTest,
	): Array<FlagValue | undefined> => {
		const values: Array<FlagValue | undefined> = [];

		Object.values(test.variants).forEach((variant) => {
			values.push(variant.values?.[environment]?.[flagId]);
		});

		return values;
	};

	const getTestVariantValues = (test: ActiveTest): string => {
		return getTestVariantRawValues(test)
			.map((v) => (v === undefined ? 'undefined' : formatValue(v)))
			.join('/');
	};

	const formatVariantSummary = (variant: ConditionalVariant): string => {
		const conditions = variant.conditions;
		if (conditions.length === 0) {
			return 'No conditions';
		}

		// Generate intelligent summaries for common patterns
		if (conditions.length === 1) {
			return formatSingleCondition(conditions[0]);
		}

		// For multiple conditions, show abbreviated summary
		if (conditions.length <= 3) {
			return conditions.map(formatSingleCondition).join(', ');
		}

		// For many conditions, group by type
		const grouped = conditions.reduce<Record<string, number>>(
			(acc, condition) => {
				acc[condition.type] = (acc[condition.type] ?? 0) + 1;
				return acc;
			},
			{},
		);

		const parts = Object.entries(grouped).map(([type, count]) => {
			const typeName = formatConditionType(type);
			return count === 1 ? typeName : `${count} ${typeName}`;
		});

		return parts.join(', ');
	};

	const formatSingleCondition = (condition: UICondition): string => {
		const { type, operator, values } = condition;

		switch (type) {
			case 'environment':
				return `${formatOperator(operator)} ${values.join(', ')}`;

			case 'app_version':
				if (operator === 'greater_than_or_equal') {
					return `v${values[0]}+`;
				}
				if (operator === 'less_than') {
					return `< v${values[0]}`;
				}
				return `${formatOperator(operator)} v${values.join(', ')}`;

			case 'platform':
				return formatOperator(operator) === 'equals'
					? values.join(', ')
					: `${formatOperator(operator)} ${values.join(', ')}`;

			case 'region':
				return `${formatOperator(operator)} ${values.join(', ')}`;

			default:
				return `${formatConditionType(type)} ${formatOperator(operator)} ${values.join(', ')}`;
		}
	};

	const formatConditionType = (type: string): string => {
		const typeMap: Record<string, string> = {
			environment: 'env',
			app_version: 'version',
			os_version: 'OS',
			platform: 'platform',
			region: 'region',
		};
		return typeMap[type] ?? type;
	};

	const formatOperator = (operator: string): string => {
		const operatorMap: Record<string, string> = {
			equals: 'is',
			does_not_equals: 'is not',
			greater_than: '>',
			less_than: '<',
			greater_than_or_equal: '>=',
			less_than_or_equal: '<=',
			between: 'between',
			in: 'in',
			not_in: 'not in',
			custom: 'has',
		};
		return operatorMap[operator] ?? operator;
	};

	const c = envColors[environment];

	// Small square "+" affordance (amber token) used by both section headers.
	const addButtonSx = {
		width: 24,
		height: 24,
		borderRadius: '8px',
		bgcolor: '#F4ECDC',
		color: '#9A6F1C',
		'&:hover': { bgcolor: '#EFE2C8' },
	} as const;

	const sectionLabelSx = {
		fontFamily: 'var(--font-nunito)',
		fontWeight: 600,
		fontSize: 12,
		color: '#8B8472',
	} as const;

	return (
		<Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
			{/* Colored environment header band */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1,
					px: 2.25,
					py: 1.375,
					bgcolor: c.headerBg,
					borderBottom: '1px solid',
					borderColor: c.border,
				}}
			>
				<Box
					sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.dot }}
				/>
				<Typography
					sx={{
						fontFamily: 'var(--font-baloo)',
						fontWeight: 800,
						fontSize: 12,
						letterSpacing: '0.04em',
						color: c.text,
					}}
				>
					{c.label.toUpperCase()}
				</Typography>
			</Box>

			{/* Content */}
			<Box
				sx={{ p: 2.25, flexGrow: 1, display: 'flex', flexDirection: 'column' }}
			>
				{/* Rollouts & Tests Section */}
				<Box sx={{ mb: 1.75 }}>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
						}}
					>
						<Typography sx={sectionLabelSx}>Tests &amp; Rollouts</Typography>
						{activeRollouts.length === 0 && activeTests.length === 0 && (
							<IconButton
								size="small"
								onClick={onTestRolloutAdd}
								sx={addButtonSx}
							>
								<Add sx={{ fontSize: 17 }} />
							</IconButton>
						)}
					</Box>
					<Stack spacing={1} sx={{ mt: 1 }}>
						{activeRollouts.map((rollout) => (
							<Box
								key={rollout.id}
								onClick={() => onTestRolloutEdit('rollout', rollout.id)}
								sx={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: 0.875,
									alignSelf: 'flex-start',
									fontFamily: monoFontFamily,
									fontWeight: 700,
									fontSize: 10,
									color: typeColors.rollout.text,
									bgcolor: typeColors.rollout.bg,
									borderRadius: '7px',
									px: 1.125,
									py: 0.5,
									cursor: 'pointer',
								}}
							>
								<Box
									sx={{
										width: 6,
										height: 6,
										borderRadius: '50%',
										bgcolor: typeColors.rollout.solid,
									}}
								/>
								Rollout {rollout.percentage}%
							</Box>
						))}
						{activeTests.map((test) => (
							<Box
								key={test.id}
								onClick={() => onTestRolloutEdit('test', test.id)}
								sx={{
									fontFamily: monoFontFamily,
									fontWeight: 500,
									fontSize: 11,
									color: ink.soft,
									bgcolor: '#fff',
									border: `1px solid ${surface.borderSidebar}`,
									borderRadius: '9px',
									p: '8px 10px',
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									flexWrap: 'wrap',
									gap: 0.5,
								}}
							>
								{test.name}:
								{isJson ? (
									getTestVariantRawValues(test).map((v, i) => (
										<JsonChip
											key={i}
											// JsonChip treats undefined and '' identically (both
											// render as empty), preserving previous behavior.
											value={v ?? ''}
											size="small"
											onClick={() => onTestRolloutEdit('test', test.id)}
										/>
									))
								) : (
									<span>{getTestVariantValues(test)}</span>
								)}
							</Box>
						))}
					</Stack>
				</Box>

				{/* Variants Section */}
				<Box sx={{ mb: 1.75, flexGrow: 1 }}>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
							<Typography
								sx={{ ...sectionLabelSx, fontWeight: 700, color: '#3A352C' }}
							>
								Variants
							</Typography>
							{variants.length > 0 && (
								<Box
									sx={{
										fontFamily: monoFontFamily,
										fontWeight: 700,
										fontSize: 10,
										color: ink.soft,
										bgcolor: surface.token,
										borderRadius: '6px',
										px: 1,
										py: 0.375,
									}}
								>
									{variants.length}
								</Box>
							)}
						</Box>
						<IconButton size="small" onClick={onVariantAdd} sx={addButtonSx}>
							<Add sx={{ fontSize: 17 }} />
						</IconButton>
					</Box>

					<Stack spacing={1} sx={{ mt: 1 }}>
						{variants.map((variant, index) => (
							<Box
								key={variant.id !== '' ? variant.id : index}
								sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
							>
								<Box
									onClick={() => onVariantEdit(variant)}
									sx={{
										flexGrow: 1,
										minWidth: 0,
										fontFamily: monoFontFamily,
										fontWeight: 500,
										fontSize: 11,
										color: ink.soft,
										bgcolor: '#fff',
										border: `1px solid ${surface.borderSidebar}`,
										borderRadius: '9px',
										p: '8px 10px',
										cursor: 'pointer',
										'&:hover': { borderColor: surface.borderStrong },
									}}
								>
									if {formatVariantSummary(variant)} →{' '}
									{isJson ? (
										<JsonChip
											value={variant.value}
											size="small"
											onClick={() => onVariantEdit(variant)}
										/>
									) : (
										<Box component="span" sx={{ color: ink.primary }}>
											{formatValue(variant.value)}
										</Box>
									)}
								</Box>
								<IconButton
									size="small"
									onClick={() => onVariantDelete(variant)}
									sx={{
										color: '#B4AC9A',
										flexShrink: 0,
										'&:hover': { color: '#C8503C' },
									}}
								>
									<Delete sx={{ fontSize: 16 }} />
								</IconButton>
							</Box>
						))}
					</Stack>
				</Box>

				{/* Default Section */}
				<Box
					sx={{
						mt: 'auto',
						pt: 2,
						borderTop: '1px solid',
						borderColor: '#F1EBDD',
					}}
				>
					<Typography
						sx={{
							fontFamily: 'var(--font-nunito)',
							fontWeight: 600,
							fontSize: 11,
							color: ink.muted,
							display: 'block',
							mb: 0.5,
						}}
					>
						Default
					</Typography>
					{isJson ? (
						<Box sx={{ display: 'inline-block' }}>
							<JsonChip value={defaultValue} onClick={onDefaultValueEdit} />
						</Box>
					) : (
						<Box
							onClick={onDefaultValueEdit}
							sx={{
								fontFamily: monoFontFamily,
								fontWeight: 600,
								fontSize: 17,
								color: ink.primary,
								cursor: 'pointer',
								display: 'inline-block',
								'&:hover': { opacity: 0.7 },
							}}
						>
							{formatValue(defaultValue)}
						</Box>
					)}
				</Box>
			</Box>
		</Box>
	);
}
