'use client';

import { useState } from 'react';
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
  Stack
} from '@mui/material';
import { Delete, Add } from '@mui/icons-material';
import { RuleCondition, RuleConditionType, RuleOperator } from '@/types/rules';
import { conditionTemplates, operatorLabels, mockCohorts } from './rule-templates';

interface ConditionBuilderProps {
  condition: RuleCondition;
  onChange: (condition: RuleCondition) => void;
  onDelete: () => void;
  canDelete?: boolean;
}

export function ConditionBuilder({ condition, onChange, onDelete, canDelete = true }: ConditionBuilderProps) {
  const template = conditionTemplates.find(t => t.type === condition.type);
  const [valueInput, setValueInput] = useState('');

  const handleTypeChange = (newType: RuleConditionType) => {
    const newTemplate = conditionTemplates.find(t => t.type === newType);
    const defaultOperator = newTemplate?.operators[0] || 'equals';
    
    onChange({
      ...condition,
      type: newType,
      operator: defaultOperator,
      values: []
    });
  };

  const handleOperatorChange = (operator: RuleOperator) => {
    onChange({
      ...condition,
      operator,
      values: []
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
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
        {/* Condition Type */}
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel>Condition</InputLabel>
          <Select
            value={condition.type}
            label="Condition"
            onChange={(e) => handleTypeChange(e.target.value as RuleConditionType)}
          >
            {conditionTemplates.map((template) => (
              <MenuItem key={template.type} value={template.type}>
                {template.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>


{/* Operator - hide for environment since it's always "applies to" */}
        {condition.type !== 'environment' && (
          <FormControl sx={{ minWidth: 150 }}>
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
        )}

        {/* Delete Button */}
        {canDelete && (
          <IconButton onClick={onDelete} color="error" sx={{ mt: 1 }}>
            <Delete />
          </IconButton>
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {condition.type === 'environment' 
          ? 'Select which environments this rule applies to'
          : template.description}
      </Typography>

      {/* Value Input */}
      <Box>
        {template.valueType === 'cohort' ? (
          <Autocomplete
            multiple
            options={mockCohorts}
            value={mockCohorts.filter(cohort => condition.values.includes(cohort.value))}
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
        ) : template.valueType === 'select' ? (
          <Autocomplete
            multiple
            options={template.options || []}
            value={(template.options || []).filter(option => condition.values.includes(option.value))}
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
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                label="Value"
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
      </Box>
    </Box>
  );
}