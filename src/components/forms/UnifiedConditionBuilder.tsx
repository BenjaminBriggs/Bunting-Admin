'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Typography,
  Autocomplete,
  Stack,
  Paper,
  Chip,
  Alert,
} from '@mui/material';
import { Delete, Add } from '@mui/icons-material';
import { RuleCondition, RuleConditionType, RuleOperator, ConditionTemplate } from '@/types/rules';
import { conditionTemplates, operatorLabels } from '@/components/features/rules/rule-templates';
import { fetchCohorts, type Cohort } from '@/lib/api';

interface UnifiedConditionBuilderProps {
  condition: RuleCondition;
  onChange: (condition: RuleCondition) => void;
  onDelete?: () => void;
  canDelete?: boolean;
  appId?: string;
  allowedTypes?: RuleConditionType[];
  showCohortConditions?: boolean;
  variant?: 'default' | 'compact' | 'modal';
  disabled?: boolean;
}

export function UnifiedConditionBuilder({
  condition,
  onChange,
  onDelete,
  canDelete = true,
  appId,
  allowedTypes,
  showCohortConditions = true,
  variant = 'default',
  disabled = false,
}: UnifiedConditionBuilderProps) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(false);
  const [valueInput, setValueInput] = useState('');

  // Load cohorts when condition type is 'cohort'
  useEffect(() => {
    if (condition.type === 'cohort' && appId) {
      setLoadingCohorts(true);
      fetchCohorts(appId)
        .then((cohortsData) => {
          setCohorts(cohortsData);
          setLoadingCohorts(false);
        })
        .catch((error) => {
          console.error('Failed to load cohorts:', error);
          setLoadingCohorts(false);
        });
    }
  }, [condition.type, appId]);

  const template = conditionTemplates.find((t) => t.type === condition.type);
  const availableTemplates = conditionTemplates.filter((template) => {
    if (!showCohortConditions && template.type === 'cohort') return false;
    if (allowedTypes && !allowedTypes.includes(template.type)) return false;
    return true;
  });

  const handleTypeChange = (newType: RuleConditionType) => {
    const newTemplate = conditionTemplates.find((t) => t.type === newType);
    const defaultOperator = newTemplate?.operators[0] || 'equals';

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
      values: [],
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

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddValue();
    }
  };

  const renderValueInput = () => {
    if (!template) return null;

    if (template.valueType === 'cohort') {
      return (
        <Autocomplete
          multiple
          options={cohorts.map((c) => ({ value: c.key, label: c.name }))}
          value={cohorts
            .map((c) => ({ value: c.key, label: c.name }))
            .filter((cohort) => condition.values.includes(cohort.value))}
          onChange={(_, newValue) => {
            handleValuesChange(newValue.map((item) => item.value));
          }}
          getOptionLabel={(option) => option.label}
          loading={loadingCohorts}
          disabled={disabled}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Cohorts"
              placeholder="Choose cohorts"
              size={variant === 'compact' ? 'small' : 'medium'}
            />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                variant="outlined"
                label={option.label}
                {...getTagProps({ index })}
                key={option.value}
                size={variant === 'compact' ? 'small' : 'medium'}
              />
            ))
          }
        />
      );
    }

    if (template.valueType === 'select') {
      return (
        <Autocomplete
          multiple
          options={template.options || []}
          value={(template.options || []).filter((option) =>
            condition.values.includes(option.value)
          )}
          onChange={(_, newValue) => {
            handleValuesChange(newValue.map((item) => item.value));
          }}
          getOptionLabel={(option) => option.label}
          disabled={disabled}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Values"
              placeholder="Choose values"
              size={variant === 'compact' ? 'small' : 'medium'}
            />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                variant="outlined"
                label={option.label}
                {...getTagProps({ index })}
                key={option.value}
                size={variant === 'compact' ? 'small' : 'medium'}
              />
            ))
          }
        />
      );
    }

    // Text input for version numbers, etc.
    return (
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            label="Value"
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={template.placeholder}
            size={variant === 'compact' ? 'small' : 'medium'}
            disabled={disabled}
            sx={{ flexGrow: 1 }}
          />
          <IconButton onClick={handleAddValue} disabled={!valueInput.trim() || disabled}>
            <Add />
          </IconButton>
        </Box>

        {condition.values.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {condition.values.map((value, index) => (
              <Chip
                key={index}
                label={value}
                onDelete={disabled ? undefined : () => handleRemoveValue(index)}
                variant="outlined"
                size={variant === 'compact' ? 'small' : 'medium'}
              />
            ))}
          </Box>
        )}
      </Stack>
    );
  };

  if (!template) return null;

  // Different layouts based on variant
  const containerProps = {
    default: {
      component: Paper,
      variant: 'outlined' as const,
      sx: { p: 2 },
    },
    compact: {
      component: Box,
      sx: { p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 },
    },
    modal: {
      component: Box,
      sx: {},
    },
  }[variant];

  const ConditionContainer = containerProps.component as any;

  return (
    <ConditionContainer {...containerProps}>
      <Stack spacing={variant === 'compact' ? 1 : 2}>
        {/* Header with type and operator selectors */}
        <Stack
          direction="row"
          spacing={2}
          alignItems="flex-start"
          sx={{ flexWrap: variant === 'compact' ? 'wrap' : 'nowrap' }}
        >
          {/* Condition Type */}
          <FormControl
            size={variant === 'compact' ? 'small' : 'medium'}
            sx={{ minWidth: 120 }}
          >
            <InputLabel>Condition</InputLabel>
            <Select
              value={condition.type}
              onChange={(e) => handleTypeChange(e.target.value as RuleConditionType)}
              label="Condition"
              disabled={disabled}
            >
              {availableTemplates.map((template) => (
                <MenuItem key={template.type} value={template.type}>
                  {template.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Operator */}
          <FormControl
            size={variant === 'compact' ? 'small' : 'medium'}
            sx={{ minWidth: 140 }}
          >
            <InputLabel>Operator</InputLabel>
            <Select
              value={condition.operator}
              onChange={(e) => handleOperatorChange(e.target.value as RuleOperator)}
              label="Operator"
              disabled={disabled}
            >
              {template.operators.map((op) => (
                <MenuItem key={op} value={op}>
                  {operatorLabels[op]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Delete Button */}
          {canDelete && onDelete && (
            <IconButton
              onClick={onDelete}
              color="error"
              size={variant === 'compact' ? 'small' : 'medium'}
              disabled={disabled}
              sx={{ mt: variant === 'compact' ? 0 : 0.5 }}
            >
              <Delete />
            </IconButton>
          )}
        </Stack>

        {/* Description */}
        {variant !== 'compact' && (
          <Typography variant="body2" color="text.secondary">
            {template.description}
          </Typography>
        )}

        {/* Validation warning */}
        {condition.values.length === 0 && variant !== 'compact' && (
          <Alert severity="warning" size="small">
            This condition needs values to be configured.
          </Alert>
        )}

        {/* Values Input */}
        <Box sx={{ flex: 1 }}>{renderValueInput()}</Box>
      </Stack>
    </ConditionContainer>
  );
}

// Legacy component exports for backward compatibility
export { UnifiedConditionBuilder as ConditionEditor };

// Utility function to create a new condition
export function createNewCondition(
  type: RuleConditionType = 'app_version',
  id?: string
): RuleCondition {
  const template = conditionTemplates.find((t) => t.type === type);
  const defaultOperator = template?.operators[0] || 'equals';

  return {
    id: id || `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    operator: defaultOperator,
    values: [],
  };
}

// Validation helper
export function validateCondition(
  condition: RuleCondition,
  cohorts: Cohort[] = []
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!condition.type) {
    errors.push('Condition type is required');
  }

  if (!condition.operator) {
    errors.push('Operator is required');
  }

  if (condition.values.length === 0) {
    errors.push('At least one value is required');
  }

  // Type-specific validation
  if (condition.type === 'cohort' && condition.values.length > 0) {
    const invalidCohorts = condition.values.filter(
      (value) => !cohorts.some((cohort) => cohort.key === value)
    );
    if (invalidCohorts.length > 0) {
      errors.push(`Invalid cohort(s): ${invalidCohorts.join(', ')}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}