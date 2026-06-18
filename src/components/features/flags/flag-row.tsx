'use client';

import { Archive, Delete } from '@mui/icons-material';
import {
	Box,
	IconButton,
	Menu,
	MenuItem,
	Tooltip,
	Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
	archiveFlag,
	deleteFlag,
	fetchTestsAndRolloutsForFlag,
	updateFlag,
} from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { useChanges } from '@/lib/changes-context';
import { formatTimestamp } from '@/lib/utils';
import { envColors, ink, surface } from '@/theme/designTokens';
import type {
	ConditionalVariant,
	DBFlag,
	DBTestRollout,
	Environment,
} from '@/types';
import { VariantCreatorModal } from '../conditions';
import DefaultValueEditModal from './default-value-edit-modal';
import EnvironmentColumn from './environment-column';
import FlagAssignmentEditModal from './flag-assignment-edit-modal';
import { formatValueForDisplay } from './flag-value-input';
import TestRolloutAssignmentModal from './test-rollout-assignment-modal';

function Ms({ name, sx }: { name: string; sx?: any }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

const ENV_SUMMARY: Array<{ env: Environment; short: string }> = [
	{ env: 'production', short: 'PROD' },
	{ env: 'beta', short: 'BETA' },
	{ env: 'development', short: 'DEV' },
];

interface FlagRowProps {
	flag: DBFlag;
	archived?: boolean;
}

export default function FlagRow({ flag, archived = false }: FlagRowProps) {
	const { markChangesDetected } = useChanges();
	const { selectedApp } = useApp();
	const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [flagData, setFlagData] = useState<DBFlag>(flag);
	const [testsAndRollouts, setTestsAndRollouts] = useState<{
		tests: DBTestRollout[];
		rollouts: DBTestRollout[];
	}>({
		tests: [],
		rollouts: [],
	});

	// Modal states
	const [variantModalOpen, setVariantModalOpen] = useState(false);
	const [testRolloutModalOpen, setTestRolloutModalOpen] = useState(false);
	const [defaultValueModalOpen, setDefaultValueModalOpen] = useState(false);
	const [assignmentEditModalOpen, setAssignmentEditModalOpen] = useState(false);
	const [selectedEnvironment, setSelectedEnvironment] =
		useState<Environment>('development');
	const [editingVariant, setEditingVariant] =
		useState<ConditionalVariant | null>(null);
	const [editingItem, setEditingItem] = useState<{
		type: 'test' | 'rollout';
		id: string;
	} | null>(null);

	// Fetch tests and rollouts that include this flag
	useEffect(() => {
		const loadTestsAndRollouts = async () => {
			if (!selectedApp) {
				return;
			}

			try {
				const data = await fetchTestsAndRolloutsForFlag(
					selectedApp.id,
					flagData.id,
				);
				setTestsAndRollouts(data);
			} catch (error) {
				console.error('Failed to fetch tests and rollouts for flag:', error);
			}
		};

		loadTestsAndRollouts();
	}, [selectedApp, flagData.id]);

	const getActiveTests = (env: Environment) => {
		return testsAndRollouts.tests
			.filter((test) => {
				if (test.archived) {
					return false;
				}

				// Only include tests that have this flag AND have values for this environment
				if (!test.flagIds.includes(flagData.id)) {
					return false;
				}

				// Check if any variant has values for this environment and flag
				if (test.variants && typeof test.variants === 'object') {
					return Object.values(test.variants).some((variant: any) => {
						return variant.values?.[env]?.[flagData.id] !== undefined;
					});
				}

				return false;
			})
			.map((test) => ({
				id: test.id,
				name: test.name,
				variants: test.variants || {},
			}));
	};

	const getActiveRollouts = (env: Environment) => {
		return testsAndRollouts.rollouts
			.filter((rollout) => {
				if (rollout.archived) {
					return false;
				}

				// Only include rollouts that have this flag AND have values for this environment
				if (!rollout.flagIds.includes(flagData.id)) {
					return false;
				}

				// Check if rollout has values for this environment and flag
				return (
					rollout.rolloutValues &&
					(rollout.rolloutValues as any)[env]?.[flagData.id] !== undefined
				);
			})
			.map((rollout) => ({
				id: rollout.id,
				name: rollout.name,
				percentage: rollout.percentage || 0,
			}));
	};

	const getEnvironmentVariants = (env: Environment): ConditionalVariant[] => {
		return flagData.variants?.[env] || [];
	};

	const handleVariantAdd = (environment: Environment) => {
		setSelectedEnvironment(environment);
		setEditingVariant(null);
		setVariantModalOpen(true);
	};

	const handleVariantEdit = (
		variant: ConditionalVariant,
		environment: Environment,
	) => {
		setSelectedEnvironment(environment);
		setEditingVariant(variant);
		setVariantModalOpen(true);
	};

	const handleVariantDelete = async (
		variant: ConditionalVariant,
		environment: Environment,
	) => {
		const variantName = variant.name || formatVariantSummary(variant);

		if (
			!window.confirm(
				`Are you sure you want to delete the variant "${variantName}"? This action cannot be undone.`,
			)
		) {
			return;
		}

		const currentVariants = getEnvironmentVariants(environment);
		const updatedVariants = currentVariants.filter((v) => v.id !== variant.id);

		const updatedFlagVariants = {
			...flagData.variants,
			[environment]: updatedVariants,
		};

		try {
			// Update database
			await updateFlag(flagData.id, {
				variants: updatedFlagVariants,
			});

			// Update local state
			setFlagData((prev) => ({
				...prev,
				variants: updatedFlagVariants,
			}));

			// Trigger change detection
			markChangesDetected();
		} catch (error) {
			console.error('Failed to delete flag variant:', error);
			alert('Failed to delete variant. Please try again.');
		}
	};

	const formatVariantSummary = (variant: ConditionalVariant): string => {
		const conditions = variant.conditions || [];
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
				acc[condition.type] = (acc[condition.type] || 0) + 1;
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

	const formatSingleCondition = (condition: any): string => {
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
		return typeMap[type] || type;
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
		return operatorMap[operator] || operator;
	};

	const handleVariantSave = async (variant: ConditionalVariant) => {
		console.log('Received variant in handleVariantSave:', variant); // Debug log

		const currentVariants = getEnvironmentVariants(selectedEnvironment);
		let updatedVariants;

		if (editingVariant) {
			// Update existing variant
			updatedVariants = currentVariants.map((v) =>
				v.id === editingVariant.id ? variant : v,
			);
		} else {
			// Add new variant
			updatedVariants = [...currentVariants, variant];
		}

		// Sort by order
		updatedVariants.sort((a, b) => a.order - b.order);

		const updatedFlagVariants = {
			...flagData.variants,
			[selectedEnvironment]: updatedVariants,
		};

		console.log('About to save variants:', updatedFlagVariants); // Debug log

		try {
			// Update database
			await updateFlag(flagData.id, {
				variants: updatedFlagVariants,
			});

			// Update local state
			setFlagData((prev) => ({
				...prev,
				variants: updatedFlagVariants,
			}));

			// Trigger change detection
			markChangesDetected();
			setVariantModalOpen(false);
		} catch (error) {
			console.error('Failed to update flag variants:', error);
		}
	};

	const refreshTestsAndRollouts = async () => {
		if (!selectedApp) {
			return;
		}

		console.log('Refreshing tests and rollouts for flag:', flagData.id);

		try {
			const data = await fetchTestsAndRolloutsForFlag(
				selectedApp.id,
				flagData.id,
			);
			console.log('Refreshed data:', data);
			setTestsAndRollouts(data);
		} catch (error) {
			console.error('Failed to refresh tests and rollouts for flag:', error);
		}
	};

	const handleTestRolloutAdd = (environment: Environment) => {
		setSelectedEnvironment(environment);
		setTestRolloutModalOpen(true);
	};

	const handleTestRolloutAssignmentComplete = () => {
		// Refresh the test/rollout data after assignment
		refreshTestsAndRollouts();
		setTestRolloutModalOpen(false);
	};

	const handleTestRolloutEdit = (
		type: 'test' | 'rollout',
		id: string,
		environment: Environment,
	) => {
		setEditingItem({ type, id });
		setSelectedEnvironment(environment);
		setAssignmentEditModalOpen(true);
	};

	const handleAssignmentEditComplete = () => {
		// Refresh the test/rollout data after editing
		refreshTestsAndRollouts();
		setAssignmentEditModalOpen(false);
		setEditingItem(null);
	};

	const handleDefaultValueEdit = (environment: Environment) => {
		setSelectedEnvironment(environment);
		setDefaultValueModalOpen(true);
	};

	const handleDefaultValueSave = async (newValue: any) => {
		// Update local state
		setFlagData((prev) => ({
			...prev,
			defaultValues: {
				...prev.defaultValues,
				[selectedEnvironment]: newValue,
			},
		}));

		// Trigger change detection
		markChangesDetected();
	};

	const handleArchive = async () => {
		try {
			const updatedFlag = await archiveFlag(flagData.id, !archived);
			setFlagData(updatedFlag);
			markChangesDetected();
			setMenuAnchor(null);
		} catch (error) {
			console.error('Failed to archive/unarchive flag:', error);
		}
	};

	const handleDelete = async () => {
		if (
			!window.confirm(
				`Are you sure you want to permanently delete "${flagData.displayName}"? This action cannot be undone.`,
			)
		) {
			return;
		}

		try {
			await deleteFlag(flagData.id);
			markChangesDetected();
			// The flag will be removed from the list by the parent component's refresh
			window.location.reload(); // Quick solution - ideally parent should handle this
		} catch (error) {
			console.error('Failed to delete flag:', error);
			alert('Failed to delete flag. Please try again.');
		}
	};

	const formatValue = (value: any): string =>
		formatValueForDisplay(value, flagData.type);

	return (
		<Box
			sx={{
				bgcolor: archived ? '#FBF8F1' : '#fff',
				border: '1.5px solid',
				borderColor: expanded ? '#E9E0CF' : '#EAE2D2',
				borderRadius: expanded ? '18px' : '16px',
				boxShadow: expanded ? '0 8px 26px rgba(40,33,20,.07)' : 'none',
				overflow: 'hidden',
				opacity: archived ? 0.9 : 1,
				transition: 'box-shadow .15s ease, border-color .15s ease',
				'&:hover': { borderColor: expanded ? '#E9E0CF' : '#E4DBC8' },
			}}
		>
			{/* Flag header — click to expand/collapse */}
			<Box
				onClick={() => setExpanded((value) => !value)}
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: expanded ? 1.875 : 2,
					p: expanded ? '18px 20px' : '17px 20px',
					cursor: 'pointer',
					...(expanded && {
						borderBottom: '1px solid #F1EBDD',
					}),
				}}
			>
				<Ms
					name={expanded ? 'expand_more' : 'chevron_right'}
					sx={{ fontSize: 24, color: expanded ? '#F6A444' : '#C2BAA8' }}
				/>

				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
						<Typography
							sx={{
								font: `700 ${expanded ? 19 : 18}px 'Baloo 2'`,
								color: archived ? '#7E776A' : ink.primary,
							}}
						>
							{flagData.displayName}
						</Typography>
						<Box
							sx={{
								font: "600 11px 'JetBrains Mono'",
								color: ink.soft,
								bgcolor: surface.token,
								borderRadius: '7px',
								px: 1,
								py: 0.375,
							}}
						>
							{String(flagData.type).toUpperCase()}
						</Box>
						{archived && (
							<Box
								sx={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: 0.625,
									font: "700 10px 'JetBrains Mono'",
									color: '#9A6F1C',
									bgcolor: '#FCEFD2',
									borderRadius: '7px',
									px: 1,
									py: 0.375,
								}}
							>
								<Ms name="inventory_2" sx={{ fontSize: 13 }} />
								ARCHIVED
							</Box>
						)}
					</Box>
					<Typography
						sx={{
							font: "500 12px 'JetBrains Mono'",
							color: ink.muted,
							mt: 0.5,
						}}
					>
						{flagData.key}
						{expanded && ` · updated ${formatTimestamp(flagData.updatedAt)}`}
					</Typography>
				</Box>

				{/* Collapsed summary: per-environment value at a glance */}
				{!expanded && !archived && (
					<Box
						sx={{
							display: { xs: 'none', sm: 'flex' },
							alignItems: 'center',
							gap: 2.5,
							flexShrink: 0,
						}}
					>
						{ENV_SUMMARY.map(({ env, short }) => {
							const c = envColors[env];
							const rollout = getActiveRollouts(env)[0];
							const test = getActiveTests(env)[0];
							const variantCount = getEnvironmentVariants(env).length;

							// Env-tinted marker: icon (+ optional label), explained on hover.
							const marker = (
								key: string,
								icon: string,
								label: string,
								title: string,
							) => (
								<Tooltip key={key} title={title} arrow>
									<Box
										component="span"
										sx={{
											display: 'inline-flex',
											alignItems: 'center',
											gap: 0.375,
											bgcolor: c.headerBg,
											color: c.text,
											border: `1px solid ${c.border}`,
											borderRadius: '6px',
											px: 0.625,
											py: 0.25,
											font: "700 9px 'JetBrains Mono'",
											letterSpacing: '.02em',
											cursor: 'default',
										}}
									>
										<Ms name={icon} sx={{ fontSize: 12 }} />
										{label}
									</Box>
								</Tooltip>
							);

							return (
								<Box
									key={env}
									sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
								>
									<Box
										sx={{
											width: 9,
											height: 9,
											borderRadius: '50%',
											bgcolor: c.dot,
										}}
									/>
									<Typography
										sx={{ font: "700 10px 'JetBrains Mono'", color: '#8B8472' }}
									>
										{short}
									</Typography>
									{/* Baseline default value is always shown … */}
									<Typography
										sx={{ font: "600 13px 'JetBrains Mono'", color: ink.primary }}
									>
										{formatValue(flagData.defaultValues[env])}
									</Typography>
									{/* … with markers when the env is overridden. */}
									{variantCount > 0 &&
										marker(
											'v',
											'call_split',
											String(variantCount),
											`${variantCount} conditional variant${variantCount === 1 ? '' : 's'} override the default`,
										)}
									{rollout &&
										marker(
											'r',
											'rocket_launch',
											`${rollout.percentage}%`,
											`Rollout “${rollout.name}” serving to ${rollout.percentage}% of users`,
										)}
									{test &&
										marker('t', 'science', 'A/B', `In A/B test “${test.name}”`)}
								</Box>
							);
						})}
					</Box>
				)}

				<IconButton
					size="small"
					onClick={(e) => {
						e.stopPropagation();
						setMenuAnchor(e.currentTarget);
					}}
					sx={{ color: ink.muted }}
				>
					<Ms name="more_vert" sx={{ fontSize: 22 }} />
				</IconButton>
			</Box>

			{/* Environment Columns (expanded only) */}
			{expanded && (
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
						bgcolor: '#FCFAF3',
					}}
				>
					{(['production', 'beta', 'development'] as Environment[]).map(
						(env, index) => (
							<Box
								key={env}
								sx={
									index > 0
										? {
												borderTop: { xs: '1px solid #F1EBDD', md: 'none' },
												borderLeft: { xs: 'none', md: '1px solid #F1EBDD' },
											}
										: undefined
								}
							>
								<EnvironmentColumn
									environment={env}
									flagId={flagData.id}
									flagType={flagData.type}
									defaultValue={flagData.defaultValues[env]}
									variants={getEnvironmentVariants(env)}
									activeTests={getActiveTests(env) as any}
									activeRollouts={getActiveRollouts(env)}
									onVariantAdd={() => handleVariantAdd(env)}
									onVariantEdit={(variant) => handleVariantEdit(variant, env)}
									onVariantDelete={(variant) => handleVariantDelete(variant, env)}
									onTestRolloutAdd={() => handleTestRolloutAdd(env)}
									onTestRolloutEdit={(type, id) =>
										handleTestRolloutEdit(type, id, env)
									}
									onDefaultValueEdit={() => handleDefaultValueEdit(env)}
								/>
							</Box>
						),
					)}
				</Box>
			)}

			{/* Action Menu */}
			<Menu
				anchorEl={menuAnchor}
				open={Boolean(menuAnchor)}
				onClose={() => setMenuAnchor(null)}
			>
				<MenuItem onClick={handleArchive}>
					<Archive sx={{ mr: 1 }} />
					{archived ? 'Unarchive' : 'Archive'}
				</MenuItem>
				<MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
					<Delete sx={{ mr: 1 }} />
					Delete
				</MenuItem>
			</Menu>

			{/* Variant Creator Modal */}
			<VariantCreatorModal
				open={variantModalOpen}
				onClose={() => setVariantModalOpen(false)}
				onSave={handleVariantSave}
				environment={selectedEnvironment}
				flagType={flagData.type}
				flagId={flagData.id}
				appId={selectedApp?.id}
				existingVariant={editingVariant || undefined}
			/>

			{/* Test/Rollout Assignment Modal */}
			<TestRolloutAssignmentModal
				open={testRolloutModalOpen}
				onClose={() => setTestRolloutModalOpen(false)}
				environment={selectedEnvironment}
				flagId={flagData.id}
				flagName={flagData.displayName}
				flagType={flagData.type}
				onComplete={handleTestRolloutAssignmentComplete}
			/>

			{/* Default Value Edit Modal */}
			<DefaultValueEditModal
				open={defaultValueModalOpen}
				onClose={() => setDefaultValueModalOpen(false)}
				onSave={handleDefaultValueSave}
				environment={selectedEnvironment}
				flagId={flagData.id}
				flagType={flagData.type}
				currentValue={flagData.defaultValues[selectedEnvironment]}
				flagName={flagData.displayName}
				allDefaultValues={flagData.defaultValues}
			/>

			{/* Flag Assignment Edit Modal */}
			{editingItem && (
				<FlagAssignmentEditModal
					open={assignmentEditModalOpen}
					onClose={() => setAssignmentEditModalOpen(false)}
					onSave={handleAssignmentEditComplete}
					type={editingItem.type}
					itemId={editingItem.id}
					flagId={flagData.id}
					flagName={flagData.displayName}
					flagType={flagData.type}
					environment={selectedEnvironment}
				/>
			)}
		</Box>
	);
}
