'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
  Chip,
  Autocomplete,
  IconButton
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { RuleCondition, RuleConditionType, RuleOperator } from '@/types/rules';
import { conditionTemplates, operatorLabels } from '@/components/features/rules/rule-templates';
import { useConditionContext, ConditionContextType } from './conditions-context';
import { generateId } from '@/lib/utils';

interface ConditionBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (condition: RuleCondition) => void;
  existingCondition?: RuleCondition;
  contextType: ConditionContextType;
}

export function ConditionBuilderModal({
  open,
  onClose,
  onSave,
  existingCondition,
  contextType
}: ConditionBuilderModalProps) {
  const { cohorts, loading, error, config } = useConditionContext(contextType);
  
  const [condition, setCondition] = useState<RuleCondition>({
    id: generateId(),
    type: 'app_version',
    operator: 'in',
    values: []
  });
  const [valueInput, setValueInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (existingCondition) {
      setCondition(existingCondition);
    } else {
      // Reset to default condition when opening for new condition
      const defaultType = config.allowedTypes[0] || 'app_version';
      const defaultTemplate = conditionTemplates.find(t => t.type === defaultType);
      const defaultOperator = defaultTemplate?.operators[0] || 'in';
      
      setCondition({
        id: generateId(),
        type: defaultType,
        operator: defaultOperator,
        values: []
      });
    }
    setValueInput('');
    setValidationErrors([]);
  }, [existingCondition, open, config.allowedTypes]);

  const handleTypeChange = (newType: RuleConditionType) => {
    const newTemplate = conditionTemplates.find(t => t.type === newType);
    const defaultOperator = newTemplate?.operators[0] || 'equals';
    
    setCondition({
      ...condition,
      type: newType,
      operator: defaultOperator,
      values: []
    });
  };

  const handleOperatorChange = (operator: RuleOperator) => {
    setCondition({
      ...condition,
      operator,
      values: []
    });
  };

  const handleAddValue = () => {
    if (valueInput.trim()) {
      const newValues = [...condition.values, valueInput.trim()];
      setCondition({
        ...condition,
        values: newValues
      });
      setValueInput('');
    }
  };

  const handleRemoveValue = (index: number) => {
    const newValues = condition.values.filter((_, i) => i !== index);
    setCondition({
      ...condition,
      values: newValues
    });
  };

  const handleValuesChange = (values: string[]) => {
    setCondition({
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

  const validateCondition = (): boolean => {
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
        value => !cohorts.some(cohort => cohort.key === value)
      );
      if (invalidCohorts.length > 0) {
        errors.push(`Invalid cohort(s): ${invalidCohorts.join(', ')}`);
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = () => {
    if (!validateCondition()) return;

    onSave(condition);
    onClose();
  };

  const handleClose = () => {
    setValidationErrors([]);
    onClose();
  };

  const template = conditionTemplates.find(t => t.type === condition.type);
  const availableTemplates = conditionTemplates.filter(t => 
    config.allowedTypes.includes(t.type)
  );

  if (!template) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{config.title}</DialogTitle>
      
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {validationErrors.length > 0 && (
            <Alert severity="error">
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </Alert>
          )}

          {error && (
            <Alert severity="warning">
              {error}
            </Alert>
          )}

          <Alert severity="info">
            {config.description}
          </Alert>

          {/* Condition Type Selection */}
          <FormControl fullWidth>
            <InputLabel>Condition Type</InputLabel>
            <Select
              value={condition.type}
              label="Condition Type"
              onChange={(e) => handleTypeChange(e.target.value as RuleConditionType)}
            >
              {availableTemplates.map((template) => (
                <MenuItem key={template.type} value={template.type}>
                  <Box>
                    <Typography variant="body2">{template.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {template.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Operator Selection */}
          <FormControl fullWidth>
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

          {/* Values Input */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Values
            </Typography>
            
            {template.valueType === 'cohort' ? (
              <Autocomplete
                multiple
                loading={loading}
                options={cohorts.map(c => ({ value: c.key, label: c.name }))}
                value={cohorts.map(c => ({ value: c.key, label: c.name }))
                  .filter(cohort => condition.values.includes(cohort.value))}
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
                value={(template.options || []).filter(option => 
                  condition.values.includes(option.value))}
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
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={validationErrors.length > 0 || loading}
        >
          {existingCondition ? 'Update' : 'Create'} Condition
        </Button>
      </DialogActions>
    </Dialog>
  );
}