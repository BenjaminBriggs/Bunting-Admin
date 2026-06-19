'use client';

/**
 * Enhanced Condition Builder Component
 *
 * This component provides a comprehensive interface for building targeting conditions
 * used in tests and rollouts. It supports all condition types specified
 * in the Bunting SDK, including custom attributes.
 *
 * Key features:
 * - All SDK condition types (app_version, os_version, build_number, platform, device_model, region, language, custom_attribute)
 * - Advanced operators including 'between' for range queries and 'custom' for app-defined evaluation
 * - Real-time validation with visual feedback
 * - Special handling for custom attributes with contextual help
 * - Type-aware input components (number, text, multi-select)
 *
 * @component
 */

import { Add, Delete } from '@mui/icons-material';
import {
	Alert,
	Autocomplete,
	Box,
	Chip,
	FormControl,
	IconButton,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
	Typography,
} from '@mui/material';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import type {
	RuleCondition,
	RuleConditionType,
	RuleOperator,
} from '@/types/rules';
import { conditionTemplates, operatorLabels } from './rule-templates';

/**
 * Props for the ConditionBuilder component
 */
interface ConditionBuilderProps {
	/** The condition object being edited */
	condition: RuleCondition;
	/** Callback fired when the condition is modified */
	onChange: (condition: RuleCondition) => void;
	/** Callback fired when the delete button is clicked */
	onDelete: () => void;
	/** Whether to show the delete button (default: true) */
	canDelete?: boolean;
	/** Application ID (accepted for API compatibility; currently unused) */
	appId?: string;
}

export function ConditionBuilder({
	condition,
	onChange,
	onDelete,
	canDelete = true,
}: ConditionBuilderProps) {
	const template = conditionTemplates.find((t) => t.type === condition.type);
	const [valueInput, setValueInput] = useState('');

	/**
	 * Validates the current condition configuration
	 *
	 * Performs real-time validation checking for:
	 * - Custom attributes must have a valid attribute name
	 * - Non-custom conditions must have at least one value
	 *
	 * @returns Array of validation error messages
	 */
	const validateCondition = () => {
		const errors: string[] = [];

		// Custom attributes: attribute name is stored in values[0]
		if (condition.type === 'custom_attribute') {
			if (!condition.values[0] || condition.values[0].trim() === '') {
				errors.push('Custom attribute name is required');
			}
		} else if (condition.values.length === 0) {
			errors.push('At least one value is required');
		}

		return errors;
	};

	const validationErrors = validateCondition();

	const handleTypeChange = (newType: RuleConditionType) => {
		const newTemplate = conditionTemplates.find((t) => t.type === newType);
		const defaultOperator = newTemplate?.operators[0] ?? 'equals';

		onChange({
			...condition,
			type: newType,
			operator: defaultOperator,
			values: [],
		});
	};

	const handleOperatorChange = (operator: RuleOperator) => {
		onChange({
			...condition,
			operator,
			values: operator === 'between' ? ['', ''] : [], // Pre-populate two values for between operator
		});
	};

	const handleAddValue = () => {
		if (valueInput.trim()) {
			const newValues = [...condition.values, valueInput.trim()];
			onChange({
				...condition,
				values: newValues,
			});
			setValueInput('');
		}
	};

	const handleRemoveValue = (index: number) => {
		const newValues = condition.values.filter((_, i) => i !== index);
		onChange({
			...condition,
			values: newValues,
		});
	};

	const handleValuesChange = (values: string[]) => {
		onChange({
			...condition,
			values,
		});
	};

	const handleKeyPress = (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleAddValue();
		}
	};

	if (!template) {
		return null;
	}

	return (
		<Box
			sx={{
				p: 2,
				border: '1px solid',
				borderColor: validationErrors.length > 0 ? 'warning.main' : 'divider',
				borderRadius: 1,
				backgroundColor:
					validationErrors.length > 0 ? 'warning.50' : 'background.paper',
			}}
		>
			<Stack spacing={2}>
				{/* Header Row with Controls */}
				<Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
					{/* Condition Type */}
					<FormControl sx={{ minWidth: 180 }} size="small">
						<InputLabel>Condition Type</InputLabel>
						<Select
							value={condition.type}
							label="Condition Type"
							onChange={(e) => handleTypeChange(e.target.value)}
						>
							{conditionTemplates.map((template) => (
								<MenuItem key={template.type} value={template.type}>
									{template.label}
								</MenuItem>
							))}
						</Select>
					</FormControl>

					{/* Operator */}
					<FormControl sx={{ minWidth: 150 }} size="small">
						<InputLabel>Operator</InputLabel>
						<Select
							value={condition.operator}
							label="Operator"
							onChange={(e) => handleOperatorChange(e.target.value)}
						>
							{template.operators.map((op) => (
								<MenuItem key={op} value={op}>
									{operatorLabels[op]}
								</MenuItem>
							))}
						</Select>
					</FormControl>

					{/* Spacer and Delete Button */}
					<Box sx={{ flexGrow: 1 }} />
					{canDelete && (
						<IconButton onClick={onDelete} color="error" size="small">
							<Delete />
						</IconButton>
					)}
				</Box>

				{/* Description */}
				<Typography variant="body2" color="text.secondary">
					{template.description}
				</Typography>

				{/* Custom Attribute Name Input — stored in values[0] so the SDK can read it */}
				{condition.type === 'custom_attribute' && (
					<TextField
						label="Attribute Name"
						value={condition.values[0] || ''}
						onChange={(e) =>
							onChange({ ...condition, values: [e.target.value] })
						}
						placeholder="e.g., subscription_plan, user_tier"
						size="small"
						fullWidth
						helperText="The attribute name your app's custom attribute resolver will receive"
					/>
				)}

				{/* Validation Errors */}
				{validationErrors.length > 0 && (
					<Alert severity="warning">
						{validationErrors.map((error, index) => (
							<Typography key={index} variant="body2">
								• {error}
							</Typography>
						))}
					</Alert>
				)}

				{/* Custom Attribute Info */}
				{condition.type === 'custom_attribute' && (
					<Alert severity="info">
						<Typography variant="body2">
							<strong>Custom Attribute:</strong> Your app provides a resolver
							callback to the SDK. The attribute name above is passed to that
							callback at evaluation time.
						</Typography>
					</Alert>
				)}

				{/* Value Input — hidden for custom_attribute since name field above is the value */}
				{condition.type === 'custom_attribute' ? null : template.valueType ===
						'select' || template.valueType === 'multi-select' ? (
					template.options && template.options.length > 0 ? (
						<Autocomplete
							multiple
							options={template.options}
							value={template.options.filter((option) =>
								condition.values.includes(option.value),
							)}
							onChange={(_, newValue) => {
								handleValuesChange(newValue.map((item) => item.value));
							}}
							renderInput={(params) => (
								<TextField
									{...params}
									label="Select Values"
									placeholder="Choose values"
								/>
							)}
							renderTags={(value, getTagProps) =>
								value.map((option, index) => (
									<Chip
										variant="outlined"
										label={option.label}
										{...getTagProps({ index })}
										key={option.value}
									/>
								))
							}
						/>
					) : (
						// Fall back to free-form input for multi-select without predefined options
						<Stack spacing={2}>
							<Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
								<TextField
									label="Value"
									type="text"
									value={valueInput}
									onChange={(e) => setValueInput(e.target.value)}
									onKeyPress={handleKeyPress}
									placeholder={template.placeholder}
									sx={{ flexGrow: 1 }}
								/>
								<IconButton
									onClick={handleAddValue}
									disabled={!valueInput.trim()}
								>
									<Add />
								</IconButton>
							</Box>

							{condition.values.length > 0 && (
								<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
									{condition.values.map((value, index) => (
										<Chip
											key={index}
											label={value}
											onDelete={() => handleRemoveValue(index)}
											variant="outlined"
										/>
									))}
								</Box>
							)}
						</Stack>
					)
				) : condition.operator === 'between' ? (
					// Special handling for between operator
					<Stack spacing={2}>
						<Typography variant="body2" color="text.secondary">
							Enter the minimum and maximum values for the range:
						</Typography>
						<Stack direction="row" spacing={1} alignItems="center">
							<TextField
								label="Minimum"
								type={template.valueType === 'number' ? 'number' : 'text'}
								value={condition.values[0] ?? ''}
								onChange={(e) =>
									onChange({
										...condition,
										values: [e.target.value, condition.values[1] ?? ''],
									})
								}
								size="small"
								sx={{ flexGrow: 1 }}
							/>
							<Typography variant="body2" color="text.secondary">
								and
							</Typography>
							<TextField
								label="Maximum"
								type={template.valueType === 'number' ? 'number' : 'text'}
								value={condition.values[1] ?? ''}
								onChange={(e) =>
									onChange({
										...condition,
										values: [condition.values[0] ?? '', e.target.value],
									})
								}
								size="small"
								sx={{ flexGrow: 1 }}
							/>
						</Stack>
					</Stack>
				) : (
					<Stack spacing={2}>
						<Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
							<TextField
								label="Value"
								type={template.valueType === 'number' ? 'number' : 'text'}
								value={valueInput}
								onChange={(e) => setValueInput(e.target.value)}
								onKeyPress={handleKeyPress}
								placeholder={template.placeholder}
								sx={{ flexGrow: 1 }}
							/>
							<IconButton
								onClick={handleAddValue}
								disabled={!valueInput.trim()}
							>
								<Add />
							</IconButton>
						</Box>

						{condition.values.length > 0 && (
							<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
								{condition.values.map((value, index) => (
									<Chip
										key={index}
										label={value}
										onDelete={() => handleRemoveValue(index)}
										variant="outlined"
									/>
								))}
							</Box>
						)}
					</Stack>
				)}
			</Stack>
		</Box>
	);
}
