'use client';

/**
 * Enhanced Condition Builder Component
 *
 * This component provides a comprehensive interface for building targeting conditions
 * used in cohorts, tests, and rollouts. It supports all condition types specified
 * in the Bunting SDK, including custom attributes.
 *
 * Key features:
 * - All SDK condition types (app_version, os_version, build_number, platform, device_model, region, locale, cohort, custom_attribute)
 * - Advanced operators including 'between' for range queries and 'custom' for app-defined evaluation
 * - Real-time validation with visual feedback
 * - Special handling for custom attributes with contextual help
 * - Type-aware input components (number, text, multi-select)
 *
 * @component
 */

import { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  IconButton,
  Typography,
  Autocomplete,
  Stack,
  Alert
} from '@mui/material';
import { Delete, Add } from '@mui/icons-material';
import { RuleCondition, RuleConditionType, RuleOperator } from '@/types/rules';
import { conditionTemplates, operatorLabels } from './rule-templates';
import { fetchCohorts, type Cohort } from '@/lib/api';

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
  /** Application ID for loading cohorts (required for cohort conditions) */
  appId?: string;
  /** Whether to show cohort condition types (default: true) */
  showCohortConditions?: boolean;
}

export function ConditionBuilder({ condition, onChange, onDelete, canDelete = true, appId, showCohortConditions = true }: ConditionBuilderProps) {
  const template = conditionTemplates.find(t => t.type === condition.type);
  const [valueInput, setValueInput] = useState('');
  const [cohorts, setCohorts] = useState<Cohort[]>([]);

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

    // Custom attributes require an attribute name
    if (condition.type === 'custom_attribute') {
      if (!condition.attribute || condition.attribute.trim() === '') {
        errors.push('Custom attribute name is required');
      }
    }

    // Most condition types require values (except custom attributes)
    if (condition.values.length === 0 && condition.type !== 'custom_attribute') {
      errors.push('At least one value is required');
    }

    return errors;
  };

  const validationErrors = validateCondition();

  useEffect(() => {
    if (appId && condition.type === 'cohort') {
      const loadCohorts = async () => {
        try {
          const cohortsData = await fetchCohorts(appId);
          setCohorts(cohortsData);
        } catch (error) {
          console.error('Failed to load cohorts:', error);
        }
      };
      loadCohorts();
    }
  }, [appId, condition.type]);

  const handleTypeChange = (newType: RuleConditionType) => {
    const newTemplate = conditionTemplates.find(t => t.type === newType);
    const defaultOperator = newTemplate?.operators[0] || 'equals';

    onChange({
      ...condition,
      type: newType,
      operator: defaultOperator,
      values: [],
      // Reset attribute for non-custom types
      attribute: newType === 'custom_attribute' ? condition.attribute || '' : undefined
    });
  };

  const handleOperatorChange = (operator: RuleOperator) => {
    onChange({
      ...condition,
      operator,
      values: operator === 'between' ? ['', ''] : [] // Pre-populate two values for between operator
    });
  };

  const handleAddValue = () => {
    if (valueInput.trim()) {
      const newValues = [...condition.values, valueInput.trim()];
      onChange({
        ...condition,
        values: newValues
      });
      setValueInput('');
    }
  };

  const handleRemoveValue = (index: number) => {
    const newValues = condition.values.filter((_, i) => i !== index);
    onChange({
      ...condition,
      values: newValues
    });
  };

  const handleValuesChange = (values: string[]) => {
    onChange({
      ...condition,
      values
    });
  };


  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddValue();
    }
  };

  if (!template) return null;

  return (
    <Box sx={{
      p: 2,
      border: '1px solid',
      borderColor: validationErrors.length > 0 ? 'warning.main' : 'divider',
      borderRadius: 1,
      backgroundColor: validationErrors.length > 0 ? 'warning.50' : 'background.paper'
    }}>
      <Stack spacing={2}>
        {/* Header Row with Controls */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          {/* Condition Type */}
          <FormControl sx={{ minWidth: 180 }} size="small">
            <InputLabel>Condition Type</InputLabel>
            <Select
              value={condition.type}
              label="Condition Type"
              onChange={(e) => handleTypeChange(e.target.value as RuleConditionType)}
            >
              {conditionTemplates
                .filter(template => showCohortConditions || template.type !== 'cohort')
                .map((template) => (
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
              onChange={(e) => handleOperatorChange(e.target.value as RuleOperator)}
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

        {/* Custom Attribute Name Input */}
        {condition.type === 'custom_attribute' && (
          <TextField
            label="Attribute Name"
            value={condition.attribute || ''}
            onChange={(e) => onChange({ ...condition, attribute: e.target.value })}
            placeholder="e.g., subscription_plan, user_tier"
            size="small"
            fullWidth
            helperText="Enter the name of the custom attribute your app will provide"
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

        {/* Custom Attribute Special Info */}
        {condition.type === 'custom_attribute' && (
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Custom Attribute:</strong> Your app must provide this attribute via the SDK's custom attributes callback.
              The SDK will evaluate this condition by calling your app's custom attribute resolver.
            </Typography>
          </Alert>
        )}

        {/* Value Input */}
        {condition.type === 'custom_attribute' ? (
          <Alert severity="info">
            <Typography variant="body2">
              Custom attributes are evaluated by your app at runtime. No values need to be specified here.
            </Typography>
          </Alert>
        ) : template.valueType === 'cohort' ? (
          <Autocomplete
            multiple
            options={cohorts.map(c => ({ value: c.key, label: c.name }))}
            value={cohorts.map(c => ({ value: c.key, label: c.name })).filter(cohort => condition.values.includes(cohort.value))}
            onChange={(_, newValue) => {
              handleValuesChange(newValue.map(item => item.value));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Cohorts"
                placeholder="Choose cohorts"
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
        ) : template.valueType === 'select' || template.valueType === 'multi-select' ? (
          template.options && template.options.length > 0 ? (
            <Autocomplete
              multiple
              options={template.options}
              value={template.options.filter(option => condition.values.includes(option.value))}
              onChange={(_, newValue) => {
                handleValuesChange(newValue.map(item => item.value));
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
                  type={template.valueType === 'number' ? 'number' : 'text'}
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={template.placeholder}
                  sx={{ flexGrow: 1 }}
                />
                <IconButton onClick={handleAddValue} disabled={!valueInput.trim()}>
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
                value={condition.values[0] || ''}
                onChange={(e) => onChange({
                  ...condition,
                  values: [e.target.value, condition.values[1] || '']
                })}
                size="small"
                sx={{ flexGrow: 1 }}
              />
              <Typography variant="body2" color="text.secondary">and</Typography>
              <TextField
                label="Maximum"
                type={template.valueType === 'number' ? 'number' : 'text'}
                value={condition.values[1] || ''}
                onChange={(e) => onChange({
                  ...condition,
                  values: [condition.values[0] || '', e.target.value]
                })}
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
              <IconButton onClick={handleAddValue} disabled={!valueInput.trim()}>
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