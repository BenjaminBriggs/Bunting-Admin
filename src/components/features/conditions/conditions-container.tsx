'use client';

import { useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  Stack,
  Paper
} from '@mui/material';
import { Add, Warning, Info } from '@mui/icons-material';
import { Condition, ConditionType } from '@/types';
import { ConditionEditor } from './condition-editor';

interface ConditionsContainerProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  appId?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

interface ValidationError {
  conditionId: string;
  message: string;
  type: 'error' | 'warning';
}

export function ConditionsContainer({
  conditions,
  onChange,
  appId,
  title = "Conditions",
  description = "Define the criteria that must be met",
  disabled = false,
  emptyMessage = "No conditions defined. All users will match."
}: ConditionsContainerProps) {

  const generateConditionId = () => {
    return `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleAddCondition = () => {
    const newCondition: Condition = {
      id: generateConditionId(),
      type: 'app_version' as ConditionType,
      operator: 'greater_than_or_equal',
      values: []
    };

    onChange([...conditions, newCondition]);
  };

  const handleConditionChange = (conditionId: string, updatedCondition: Condition) => {
    const newConditions = conditions.map(condition =>
      condition.id === conditionId ? updatedCondition : condition
    );
    onChange(newConditions);
  };

  const handleDeleteCondition = (conditionId: string) => {
    const newConditions = conditions.filter(condition => condition.id !== conditionId);
    onChange(newConditions);
  };

  // Validation
  const validationErrors = useMemo((): ValidationError[] => {
    const errors: ValidationError[] = [];

    conditions.forEach((condition, index) => {
      if (condition.values.length === 0) {
        errors.push({
          conditionId: condition.id,
          message: `Condition ${index + 1}: No values specified`,
          type: 'error'
        });
      }

      if (condition.operator === 'between') {
        if (condition.values.length < 2) {
          errors.push({
            conditionId: condition.id,
            message: `Condition ${index + 1}: Between operator requires both min and max values`,
            type: 'error'
          });
        } else if (condition.values[0] === condition.values[1]) {
          errors.push({
            conditionId: condition.id,
            message: `Condition ${index + 1}: Min and max values cannot be the same`,
            type: 'warning'
          });
        }
      }

      // Version validation for version-type conditions
      if (['app_version', 'os_version'].includes(condition.type)) {
        condition.values.forEach((value, valueIndex) => {
          if (value && !/^\d+(\.\d+)*(\.\d+)*$/.test(value)) {
            errors.push({
              conditionId: condition.id,
              message: `Condition ${index + 1}: Invalid version format "${value}". Use semantic versioning (e.g., 1.0.0)`,
              type: 'error'
            });
          }
        });
      }
    });

    return errors;
  }, [conditions]);

  const hasErrors = validationErrors.some(error => error.type === 'error');
  const hasWarnings = validationErrors.some(error => error.type === 'warning');

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>

        <Button
          startIcon={<Add />}
          onClick={handleAddCondition}
          variant="outlined"
          disabled={disabled}
          size="small"
        >
          Add Condition
        </Button>
      </Box>

      {/* Validation Messages */}
      {validationErrors.length > 0 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {validationErrors.map((error, index) => (
            <Alert
              key={index}
              severity={error.type}
              icon={error.type === 'error' ? <Warning /> : <Info />}
            >
              {error.message}
            </Alert>
          ))}
        </Stack>
      )}

      {/* Conditions */}
      <Stack spacing={2}>
        {conditions.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
            <Info sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              {emptyMessage}
            </Typography>
          </Paper>
        ) : (
          <>
            {conditions.length > 1 && (
              <Alert severity="info">
                All conditions must be met (AND logic). Users will only match if they satisfy every condition below.
              </Alert>
            )}
            
            {conditions.map((condition, index) => (
              <Box key={condition.id}>
                {index > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        bgcolor: 'primary.main', 
                        color: 'primary.contrastText',
                        px: 1, 
                        py: 0.5, 
                        borderRadius: 1,
                        fontWeight: 'bold'
                      }}
                    >
                      AND
                    </Typography>
                  </Box>
                )}
                
                <ConditionEditor
                  condition={condition}
                  onChange={(updatedCondition) => handleConditionChange(condition.id, updatedCondition)}
                  onDelete={() => handleDeleteCondition(condition.id)}
                />
              </Box>
            ))}
          </>
        )}
      </Stack>

      {/* Summary */}
      {conditions.length > 0 && (
        <Paper variant="outlined" sx={{ mt: 3, p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Summary: {conditions.length} condition{conditions.length === 1 ? '' : 's'} defined
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {hasErrors ? 'Some conditions need attention before they can be saved.' : 
             hasWarnings ? 'Conditions are valid but have potential issues.' :
             'All conditions are properly configured.'}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}