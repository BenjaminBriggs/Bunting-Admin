'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Stack,
  Alert,
  Autocomplete
} from '@mui/material';
import { Delete, Add } from '@mui/icons-material';
import { Condition, ConditionType, ConditionOperator } from '@/types';
import { conditionTemplates, operatorLabels } from '@/components/features/rules/rule-templates';

interface ConditionEditorProps {
  condition: Condition;
  onChange: (condition: Condition) => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function ConditionEditor({
  condition,
  onChange,
  onDelete,
  disabled = false
}: ConditionEditorProps) {
  const [valueInput, setValueInput] = useState('');

  const template = conditionTemplates.find(t => t.type === condition.type);

  const handleTypeChange = (newType: ConditionType) => {
    const newTemplate = conditionTemplates.find(t => t.type === newType);
    const defaultOperator = newTemplate?.operators[0] || 'equals';

    onChange({
      ...condition,
      type: newType,
      operator: defaultOperator as any,
      values: []
    });
  };

  const handleOperatorChange = (newOperator: ConditionOperator) => {
    onChange({
      ...condition,
      operator: newOperator,
      values: condition.operator === 'between' && newOperator !== 'between'
        ? condition.values.slice(0, 1)
        : condition.values
    });
  };

  const handleAddValue = () => {
    if (valueInput.trim() && !condition.values.includes(valueInput.trim())) {
      const newValues = [...condition.values, valueInput.trim()];
      onChange({
        ...condition,
        values: newValues
      });
      setValueInput('');
    }
  };

  const handleRemoveValue = (valueToRemove: string) => {
    onChange({
      ...condition,
      values: condition.values.filter(v => v !== valueToRemove)
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddValue();
    }
  };

  const handleAttributeChange = (newAttribute: string) => {
    onChange({
      ...condition,
      attribute: newAttribute
    });
  };

  return (
    <Paper
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: disabled ? 'action.disabledBackground' : 'background.paper'
      }}
    >
      <Box display="flex" alignItems="flex-start" gap={2}>
        <Box flex={1}>
          <Stack spacing={2}>
            {/* Condition Type */}
            <FormControl size="small" disabled={disabled}>
              <InputLabel>Condition Type</InputLabel>
              <Select
                value={condition.type}
                label="Condition Type"
                onChange={(e) => handleTypeChange(e.target.value as ConditionType)}
              >
                {conditionTemplates.map((template) => (
                  <MenuItem key={template.type} value={template.type}>
                    {template.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Custom Attribute Field */}
            {condition.type === 'custom_attribute' && (
              <TextField
                size="small"
                label="Attribute Name"
                value={condition.attribute || ''}
                onChange={(e) => handleAttributeChange(e.target.value)}
                placeholder="e.g., subscription_tier, user_segment"
                disabled={disabled}
                required
              />
            )}

            {/* Operator */}
            {template && (
              <FormControl size="small" disabled={disabled}>
                <InputLabel>Operator</InputLabel>
                <Select
                  value={condition.operator}
                  label="Operator"
                  onChange={(e) => handleOperatorChange(e.target.value as ConditionOperator)}
                >
                  {template.operators.map((op) => (
                    <MenuItem key={op} value={op}>
                      {operatorLabels[op] || op}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Values Input */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  label={template?.placeholder || 'Value'}
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={disabled}
                  sx={{ flex: 1 }}
                />
                <IconButton
                  onClick={handleAddValue}
                  disabled={disabled || !valueInput.trim()}
                  size="small"
                >
                  <Add />
                </IconButton>
              </Stack>

              {/* Display current values */}
              {condition.values.length > 0 && (
                <Box mt={1}>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {condition.values.map((value, index) => (
                      <Chip
                        key={`${value}-${index}`}
                        label={value}
                        onDelete={disabled ? undefined : () => handleRemoveValue(value)}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {condition.operator === 'between' && condition.values.length !== 2 && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Between operator requires exactly 2 values (min and max).
                </Alert>
              )}
            </Box>

            {/* Template description */}
            {template?.description && (
              <Typography variant="caption" color="text.secondary">
                {template.description}
              </Typography>
            )}
          </Stack>
        </Box>

        {/* Delete button */}
        <IconButton
          onClick={onDelete}
          disabled={disabled}
          size="small"
          color="error"
        >
          <Delete />
        </IconButton>
      </Box>
    </Paper>
  );
}